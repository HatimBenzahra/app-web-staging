import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CoachingStatus, StatutPorte } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { SalesPlanService } from './sales-plan.service';
import { LlmService } from './llm.service';
import { CoachingConfigService } from './coaching-config.service';
import { CoachingQueryService } from './coaching-query.service';
import { CoachingAnalysisDto } from './coaching.dto';

export interface EnqueueCoachingInput {
  s3Key: string;
  porteId?: number | null;
  statut?: string | null;
  durationSec?: number | null;
}

/**
 * Surface de COMMANDES du coaching (pipeline A) : enfilement automatique à
 * l'upload, lancement/relance manuels, favori. La création d'une ligne
 * CoachingAnalysis en PENDING sert de file durable ; le traitement est assuré
 * par AnalysisRunnerService (worker @Cron). Les lectures sont dans
 * CoachingQueryService, la config dans CoachingConfigService.
 */
@Injectable()
export class CoachingService {
  private readonly logger = new Logger(CoachingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly salesPlans: SalesPlanService,
    private readonly llm: LlmService,
    private readonly config: CoachingConfigService,
    private readonly query: CoachingQueryService,
  ) {}

  /**
   * Déclenché automatiquement à l'upload d'un enregistrement (fire-and-forget).
   * Idempotent : une seule analyse par (audio × version de plan).
   */
  async enqueue(input: EnqueueCoachingInput): Promise<void> {
    try {
      if (!this.llm.isConfigured()) {
        this.logger.warn('vLLM non configuré, coaching ignoré');
        return;
      }
      // Auto : on ne coache que les échanges dont le statut porte est configuré.
      const coachable = await this.config.getCoachableStatuts();
      if (!input.statut || !coachable.includes(input.statut)) {
        this.logger.debug(
          `Statut "${input.statut ?? '∅'}" non coachable — auto ignoré pour ${input.s3Key}`,
        );
        return;
      }
      // Auto : audio trop court (< 2 min) → non coaché. La durée vient de la
      // porte (segment d'enregistrement) ; repli sur la durée passée à l'upload.
      const durAgg = await this.prisma.recordingSegment.aggregate({
        _max: { durationSec: true },
        where: { s3KeyOriginal: input.s3Key },
      });
      const durationSec = durAgg._max.durationSec ?? input.durationSec ?? 0;
      const minDuration = await this.config.getMinAutoDurationSec();
      if (durationSec < minDuration) {
        this.logger.debug(
          `Audio ${input.s3Key} trop court (${durationSec}s < ${minDuration}s) — auto ignoré`,
        );
        return;
      }
      const version = await this.salesPlans.getActiveVersion();
      if (!version) {
        this.logger.warn('Aucun plan de vente actif, coaching ignoré');
        return;
      }
      const recording = await this.prisma.recording.findUnique({
        where: { s3Key: input.s3Key },
        select: { id: true, commercialId: true, managerId: true },
      });
      if (!recording) {
        this.logger.warn(
          `Recording introuvable pour ${input.s3Key}, coaching ignoré`,
        );
        return;
      }

      const existing = await this.prisma.coachingAnalysis.findUnique({
        where: {
          s3KeyOriginal_salesPlanVersionId: {
            s3KeyOriginal: input.s3Key,
            salesPlanVersionId: version.id,
          },
        },
        select: { id: true, status: true },
      });
      if (existing) {
        this.logger.debug(
          `Analyse déjà existante (${existing.status}) pour ${input.s3Key}, skip`,
        );
        return;
      }

      const created = await this.prisma.coachingAnalysis.create({
        data: {
          recordingId: recording.id,
          porteId: input.porteId ?? null,
          commercialId: recording.commercialId,
          managerId: recording.managerId,
          s3KeyOriginal: input.s3Key,
          statutPorte: this.asStatut(input.statut),
          salesPlanVersionId: version.id,
          status: CoachingStatus.PENDING,
        },
        select: { id: true },
      });

      // Le job reste en PENDING : le worker de file (AnalysisRunnerService) le traitera.
      this.logger.debug(`Coaching enfilé (#${created.id}) pour ${input.s3Key}`);
    } catch (error) {
      this.logger.error(
        `enqueue coaching échoué pour ${input.s3Key}: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Lancement manuel sur un enregistrement DÉJÀ existant (test / backfill).
   * Porte/statut résolus best-effort depuis un éventuel segment legacy.
   */
  async launch(s3Key: string): Promise<CoachingAnalysisDto> {
    if (!this.llm.isConfigured()) {
      throw new BadRequestException('vLLM non configuré (VLLM_BASE_URL / VLLM_MODEL)');
    }
    const version = await this.salesPlans.getActiveVersion();
    if (!version) throw new NotFoundException('Aucun plan de vente actif');
    const recording = await this.prisma.recording.findUnique({
      where: { s3Key },
      select: { id: true, commercialId: true, managerId: true },
    });
    if (!recording) {
      throw new NotFoundException(`Enregistrement introuvable: ${s3Key}`);
    }

    const seg = await this.prisma.recordingSegment.findFirst({
      where: { s3KeyOriginal: s3Key },
      orderBy: { id: 'desc' },
      select: { porteId: true, statut: true },
    });

    const analysis = await this.prisma.coachingAnalysis.upsert({
      where: {
        s3KeyOriginal_salesPlanVersionId: {
          s3KeyOriginal: s3Key,
          salesPlanVersionId: version.id,
        },
      },
      create: {
        recordingId: recording.id,
        porteId: seg?.porteId ?? null,
        commercialId: recording.commercialId,
        managerId: recording.managerId,
        s3KeyOriginal: s3Key,
        statutPorte: seg?.statut ?? null,
        salesPlanVersionId: version.id,
        status: CoachingStatus.PENDING,
        manual: true,
      },
      update: {
        status: CoachingStatus.PENDING,
        error: null,
        attempts: 0,
        nextRetryAt: null,
        manual: true,
      },
      select: { id: true },
    });

    // Job en PENDING → traité par le worker de file (AnalysisRunnerService).
    return this.query.getAnalysis(analysis.id);
  }

  /**
   * Lancement manuel EN LOT sur des enregistrements existants (interface de
   * gestion). Idempotent ; renvoie le nombre d'audios enfilés. Comme `launch`,
   * ces analyses ignorent le gating durée (manual = true).
   */
  async launchMany(s3Keys: string[]): Promise<number> {
    const keys = [...new Set((s3Keys ?? []).filter(Boolean))];
    let n = 0;
    for (const key of keys) {
      try {
        await this.launch(key);
        n++;
      } catch (e) {
        this.logger.warn(`launchMany: ${key} ignoré (${(e as Error).message})`);
      }
    }
    this.logger.log(`launchMany : ${n}/${keys.length} audios enfilés (manuel)`);
    return n;
  }

  /**
   * Marque/démarque une porte comme favorite. UPDATE SQL brut EXPRÈS : le favori
   * est une métadonnée de coaching, il ne doit PAS bumper `Porte.updatedAt`
   * (sinon la porte remonte à tort dans les KPIs « modifiées aujourd'hui »).
   */
  async setCoachingFavori(porteId: number, favori: boolean): Promise<boolean> {
    await this.prisma.$executeRaw`
      UPDATE "Porte" SET "coachingFavori" = ${favori} WHERE "id" = ${porteId}
    `;
    return favori;
  }

  /** État favori d'une porte (source de vérité DB). */
  async getCoachingFavori(porteId: number): Promise<boolean> {
    const porte = await this.prisma.porte.findUnique({
      where: { id: porteId },
      select: { coachingFavori: true },
    });
    return porte?.coachingFavori ?? false;
  }

  /** Relance manuelle d'une analyse existante (admin/directeur). */
  /**
   * Relance une analyse SUR LE PLAN DE VENTE ACTIF.
   *
   * Une analyse reste épinglée à sa version de plan (`@@unique([s3KeyOriginal,
   * salesPlanVersionId])`) : c'est ce qui rend les scores comparables dans le
   * temps. Mais relancer une ligne épinglée à une version périmée la rejouait sur
   * un référentiel mort — vu en production : un audio rejoué sur le plan v1
   * (version énergie), dont les clés produit `telecom` / `conciergerie` ne
   * correspondent à aucune fiche, donc sans la moindre conformité produit.
   *
   * On ne touche donc pas à la ligne d'origine — elle reste l'historique de ce
   * qu'a valu cet échange sur SON référentiel — et on (re)joue l'audio sur la
   * version active. Le transcript est repris : l'audio n'a pas changé, ça évite
   * de re-payer Whisper (des dizaines de minutes sur un échange long).
   */
  async relaunch(id: number): Promise<CoachingAnalysisDto> {
    const analysis = await this.prisma.coachingAnalysis.findUnique({
      where: { id },
    });
    if (!analysis) throw new NotFoundException('Analyse coaching introuvable');

    const version = await this.salesPlans.getActiveVersion();
    if (!version) throw new NotFoundException('Aucun plan de vente actif');

    const requeue = {
      status: CoachingStatus.PENDING,
      error: null,
      attempts: 0,
      nextRetryAt: null,
      // Relance explicite : l'utilisateur veut cette analyse, quelle que soit la
      // durée de l'échange. Le gating "pas de parole" reste actif.
      manual: true,
    };

    // Déjà sur le plan actif : simple remise en file.
    if (analysis.salesPlanVersionId === version.id) {
      await this.prisma.coachingAnalysis.update({ where: { id }, data: requeue });
      return this.query.getAnalysis(id);
    }

    const existing = await this.prisma.coachingAnalysis.findUnique({
      where: {
        s3KeyOriginal_salesPlanVersionId: {
          s3KeyOriginal: analysis.s3KeyOriginal,
          salesPlanVersionId: version.id,
        },
      },
      select: { id: true, transcript: true },
    });

    if (existing) {
      await this.prisma.coachingAnalysis.update({
        where: { id: existing.id },
        data: {
          ...requeue,
          // On ne remplace un transcript existant que s'il est vide : celui de la
          // cible a été produit avec le profil STT du moment, il fait foi.
          ...(existing.transcript?.trim()
            ? {}
            : {
                transcript: analysis.transcript,
                transcriptDurationSec: analysis.transcriptDurationSec,
              }),
        },
      });
      return this.query.getAnalysis(existing.id);
    }

    const created = await this.prisma.coachingAnalysis.create({
      data: {
        recordingId: analysis.recordingId,
        porteId: analysis.porteId,
        commercialId: analysis.commercialId,
        managerId: analysis.managerId,
        s3KeyOriginal: analysis.s3KeyOriginal,
        statutPorte: analysis.statutPorte,
        salesPlanVersionId: version.id,
        transcript: analysis.transcript,
        transcriptDurationSec: analysis.transcriptDurationSec,
        ...requeue,
      },
      select: { id: true },
    });
    this.logger.log(
      `Analyse ${id} relancée sur le plan actif v${version.version} → nouvelle analyse ${created.id}`,
    );
    return this.query.getAnalysis(created.id);
  }

  private asStatut(value?: string | null): StatutPorte | null {
    if (!value) return null;
    return (StatutPorte as Record<string, StatutPorte>)[value] ?? null;
  }
}
