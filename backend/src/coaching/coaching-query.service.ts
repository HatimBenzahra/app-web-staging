import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CoachingQuality,
  CoachingStatus,
  StatutPorte,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { SalesPlanService } from './sales-plan.service';
import { CoachingConfigService } from './coaching-config.service';
import {
  CoachingAnalysesFilter,
  CoachingAnalysisDto,
  CoachingQueueItemDto,
  CoachingManagementFilter,
  CoachingManagementItemDto,
} from './coaching.dto';
import { CriterionScore, StepScore } from './coaching.types';

// Filtre par tranche de durée (secondes) pour la liste de gestion.
function matchDurationTier(sec: number, tier: string): boolean {
  const d = sec ?? 0;
  if (tier === 'lt1') return d < 60;
  if (tier === '1to3') return d >= 60 && d < 180;
  if (tier === 'gt3') return d >= 180;
  return true; // tier inconnu → pas de filtrage
}

/**
 * Lectures du coaching (pipeline A) pour l'UI de gestion : stats, file,
 * analyses, liste de gestion, sujets coachables. DB-only, aucun effet de bord.
 */
@Injectable()
export class CoachingQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly salesPlans: SalesPlanService,
    private readonly config: CoachingConfigService,
  ) {}

  /** État de la file + KPIs pour le dashboard de gestion. */
  async getStats(): Promise<{
    pending: number;
    processing: number;
    ready: number;
    failed: number;
    inexploitable: number;
    total: number;
    avgScore: number | null;
  }> {
    const grouped = await this.prisma.coachingAnalysis.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    const c: Record<string, number> = {};
    for (const g of grouped) c[g.status] = g._count._all;
    const pending = c[CoachingStatus.PENDING] ?? 0;
    const processing =
      (c[CoachingStatus.TRANSCRIBING] ?? 0) + (c[CoachingStatus.ANALYZING] ?? 0);
    const ready = c[CoachingStatus.READY] ?? 0;
    const failed = c[CoachingStatus.FAILED] ?? 0;
    const total = pending + processing + ready + failed;

    const inexploitable = await this.prisma.coachingAnalysis.count({
      where: { quality: CoachingQuality.INEXPLOITABLE },
    });
    const agg = await this.prisma.coachingAnalysis.aggregate({
      _avg: { score: true },
      where: { score: { not: null } },
    });
    const avgScore =
      agg._avg.score != null ? Math.round(agg._avg.score * 10) / 10 : null;

    return {
      pending,
      processing,
      ready,
      failed,
      inexploitable,
      total,
      avgScore,
    };
  }

  async getAnalysis(id: number): Promise<CoachingAnalysisDto> {
    const row = await this.prisma.coachingAnalysis.findUnique({
      where: { id },
      include: {
        salesPlanVersion: { select: { slug: true, version: true } },
        porte: { select: { coachingFavori: true } },
      },
    });
    if (!row) throw new NotFoundException('Analyse coaching introuvable');
    return this.toDto(row);
  }

  async listAnalyses(
    filter: CoachingAnalysesFilter,
  ): Promise<{ items: CoachingAnalysisDto[]; total: number }> {
    const where = {
      ...(filter.commercialId != null
        ? { commercialId: filter.commercialId }
        : {}),
      ...(filter.managerId != null ? { managerId: filter.managerId } : {}),
      ...(filter.porteId != null ? { porteId: filter.porteId } : {}),
      ...(filter.status
        ? { status: filter.status as CoachingStatus }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.coachingAnalysis.findMany({
        where,
        include: {
          salesPlanVersion: { select: { slug: true, version: true } },
          porte: { select: { coachingFavori: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: filter.skip ?? 0,
        take: Math.min(filter.take ?? 20, 100),
      }),
      this.prisma.coachingAnalysis.count({ where }),
    ]);
    const items = rows.map((r) => this.toDto(r));
    const subjects = await this.resolveSubjects(rows);
    for (const it of items) {
      const s = subjects.get(it.id);
      it.subjectName = s?.name ?? null;
      it.subjectRole = s?.role ?? null;
      it.subjectId = s?.id ?? null;
    }
    return { items, total };
  }

  /** Analyses existantes (plan actif) pour un lot de clés S3 — évite le N+1 côté UI. */
  async byS3Keys(s3Keys: string[]): Promise<CoachingAnalysisDto[]> {
    if (!s3Keys?.length) return [];
    const version = await this.salesPlans.getActiveVersion();
    const rows = await this.prisma.coachingAnalysis.findMany({
      where: {
        s3KeyOriginal: { in: s3Keys },
        ...(version ? { salesPlanVersionId: version.id } : {}),
      },
      include: {
        salesPlanVersion: { select: { slug: true, version: true } },
        porte: { select: { coachingFavori: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toDto(r));
  }

  /**
   * File interrogeable : audios en attente / en cours (PENDING, TRANSCRIBING,
   * ANALYZING), avec le sujet (commercial/manager) et la durée. Prochain d'abord.
   */
  async coachingQueue(): Promise<CoachingQueueItemDto[]> {
    const rows = await this.prisma.coachingAnalysis.findMany({
      where: {
        status: {
          in: [
            CoachingStatus.PENDING,
            CoachingStatus.TRANSCRIBING,
            CoachingStatus.ANALYZING,
          ],
        },
      },
      select: {
        id: true,
        status: true,
        s3KeyOriginal: true,
        statutPorte: true,
        commercialId: true,
        managerId: true,
        transcriptDurationSec: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' }, // le prochain à passer en premier
    });
    if (!rows.length) return [];

    // Durée : agrégée depuis les segments (non stockée sur l'analyse avant transcription).
    const keys = [...new Set(rows.map((r) => r.s3KeyOriginal))];
    const durs = await this.prisma.recordingSegment.groupBy({
      by: ['s3KeyOriginal'],
      where: { s3KeyOriginal: { in: keys } },
      _max: { durationSec: true },
    });
    const durByKey = new Map<string, number | null>();
    for (const d of durs) durByKey.set(d.s3KeyOriginal, d._max.durationSec ?? null);

    const subjects = await this.resolveSubjects(rows);

    return rows.map((r) => {
      const s = subjects.get(r.id);
      return {
        id: r.id,
        status: r.status,
        s3KeyOriginal: r.s3KeyOriginal,
        subjectName: s?.name ?? null,
        subjectRole: s?.role ?? null,
        subjectId: s?.id ?? null,
        statutPorte: r.statutPorte ?? null,
        durationSec: r.transcriptDurationSec ?? durByKey.get(r.s3KeyOriginal) ?? null,
        createdAt: r.createdAt.toISOString(),
      };
    });
  }

  /**
   * Résout nom/rôle/id du sujet (commercial ou manager) pour un lot de lignes,
   * en 2 requêtes batch max (pas de N+1). Clé de la map = id de l'analyse.
   */
  private async resolveSubjects(
    rows: { id: number; commercialId: number | null; managerId: number | null }[],
  ): Promise<
    Map<number, { name: string; role: 'commercial' | 'manager'; id: number }>
  > {
    const commercialIds = [
      ...new Set(
        rows.map((r) => r.commercialId).filter((x): x is number => x != null),
      ),
    ];
    const managerIds = [
      ...new Set(
        rows.map((r) => r.managerId).filter((x): x is number => x != null),
      ),
    ];
    type NameRow = { id: number; nom: string; prenom: string };
    const [commercials, managers] = await Promise.all([
      commercialIds.length
        ? this.prisma.commercial.findMany({
            where: { id: { in: commercialIds } },
            select: { id: true, nom: true, prenom: true },
          })
        : Promise.resolve([] as NameRow[]),
      managerIds.length
        ? this.prisma.manager.findMany({
            where: { id: { in: managerIds } },
            select: { id: true, nom: true, prenom: true },
          })
        : Promise.resolve([] as NameRow[]),
    ]);
    const cMap = new Map<number, string>(
      commercials.map((c) => [c.id, `${c.prenom} ${c.nom}`.trim()]),
    );
    const mMap = new Map<number, string>(
      managers.map((m) => [m.id, `${m.prenom} ${m.nom}`.trim()]),
    );

    const out = new Map<
      number,
      { name: string; role: 'commercial' | 'manager'; id: number }
    >();
    for (const r of rows) {
      if (r.commercialId != null && cMap.has(r.commercialId)) {
        out.set(r.id, {
          name: cMap.get(r.commercialId)!,
          role: 'commercial',
          id: r.commercialId,
        });
      } else if (r.managerId != null && mMap.has(r.managerId)) {
        out.set(r.id, {
          name: mMap.get(r.managerId)!,
          role: 'manager',
          id: r.managerId,
        });
      }
    }
    return out;
  }

  /**
   * Interface de gestion : enregistrements coachables (statut porte coachable +
   * propriétaire ACTIF) avec l'état d'analyse et le favori. DB-only, paginé.
   */
  async coachingManagementList(
    filter: CoachingManagementFilter,
  ): Promise<{ items: CoachingManagementItemDto[]; total: number }> {
    const coachable = await this.config.getCoachableStatuts();
    const allowed = (
      filter.statut && coachable.includes(filter.statut)
        ? [filter.statut]
        : coachable
    ) as StatutPorte[];
    if (!allowed.length) return { items: [], total: 0 };

    const portes = await this.prisma.porte.findMany({
      where: { statut: { in: allowed }, recordingSegments: { some: {} } },
      select: {
        id: true,
        numero: true,
        etage: true,
        statut: true,
        coachingFavori: true,
        immeuble: { select: { adresse: true } },
        recordingSegments: {
          select: {
            s3KeyOriginal: true,
            durationSec: true,
            id: true,
            commercialId: true,
            managerId: true,
          },
        },
      },
    });

    // 1 entrée par clé S3 (1 audio = 1 porte).
    type Row = {
      s3Key: string;
      porteId: number;
      statutPorte: string;
      favori: boolean;
      adresse: string | null;
      porteNumero: string;
      porteEtage: number;
      durationSec: number;
      commercialId: number | null;
      managerId: number | null;
      maxId: number;
    };
    const byKey = new Map<string, Row>();
    for (const p of portes) {
      for (const seg of p.recordingSegments) {
        const prev = byKey.get(seg.s3KeyOriginal);
        if (!prev) {
          byKey.set(seg.s3KeyOriginal, {
            s3Key: seg.s3KeyOriginal,
            porteId: p.id,
            statutPorte: p.statut,
            favori: p.coachingFavori,
            adresse: p.immeuble?.adresse ?? null,
            porteNumero: p.numero,
            porteEtage: p.etage,
            durationSec: seg.durationSec ?? 0,
            commercialId: seg.commercialId,
            managerId: seg.managerId,
            maxId: seg.id,
          });
        } else {
          if ((seg.durationSec ?? 0) > prev.durationSec)
            prev.durationSec = seg.durationSec ?? 0;
          if (seg.id > prev.maxId) prev.maxId = seg.id;
          if (prev.commercialId == null && seg.commercialId != null)
            prev.commercialId = seg.commercialId;
          if (prev.managerId == null && seg.managerId != null)
            prev.managerId = seg.managerId;
        }
      }
    }

    // Propriétaire (nom + statut) — ne garder que les ACTIF.
    const rows = [...byKey.values()];
    type OwnerRow = { id: number; nom: string; prenom: string; status: UserStatus };
    const commercialIds = [
      ...new Set(rows.map((r) => r.commercialId).filter((x): x is number => x != null)),
    ];
    const managerIds = [
      ...new Set(rows.map((r) => r.managerId).filter((x): x is number => x != null)),
    ];
    const [commercials, managers] = await Promise.all([
      commercialIds.length
        ? this.prisma.commercial.findMany({
            where: { id: { in: commercialIds } },
            select: { id: true, nom: true, prenom: true, status: true },
          })
        : Promise.resolve([] as OwnerRow[]),
      managerIds.length
        ? this.prisma.manager.findMany({
            where: { id: { in: managerIds } },
            select: { id: true, nom: true, prenom: true, status: true },
          })
        : Promise.resolve([] as OwnerRow[]),
    ]);
    const cMap = new Map(commercials.map((c) => [c.id, c]));
    const mMap = new Map(managers.map((m) => [m.id, m]));

    const withOwner = rows
      .map((r) => {
        let name: string | null = null;
        let role: 'commercial' | 'manager' | null = null;
        let sid: number | null = null;
        let active = false;
        if (r.commercialId != null && cMap.has(r.commercialId)) {
          const c = cMap.get(r.commercialId)!;
          name = `${c.prenom} ${c.nom}`.trim();
          role = 'commercial';
          sid = r.commercialId;
          active = c.status === UserStatus.ACTIF;
        } else if (r.managerId != null && mMap.has(r.managerId)) {
          const m = mMap.get(r.managerId)!;
          name = `${m.prenom} ${m.nom}`.trim();
          role = 'manager';
          sid = r.managerId;
          active = m.status === UserStatus.ACTIF;
        }
        return { ...r, subjectName: name, subjectRole: role, subjectId: sid, active };
      })
      .filter((r) => r.active);

    // État d'analyse (plan actif) pour TOUS les candidats — requis pour le filtre
    // "non analysés uniquement" et pour l'indicateur, sans requête par page.
    const version = await this.salesPlans.getActiveVersion();
    const analysisByKey = new Map<
      string,
      { id: number; status: string; quality: string | null; score: number | null }
    >();
    if (version && withOwner.length) {
      const analyses = await this.prisma.coachingAnalysis.findMany({
        where: {
          s3KeyOriginal: { in: withOwner.map((r) => r.s3Key) },
          salesPlanVersionId: version.id,
        },
        select: { s3KeyOriginal: true, id: true, status: true, quality: true, score: true },
      });
      for (const a of analyses) {
        analysisByKey.set(a.s3KeyOriginal, {
          id: a.id,
          status: a.status,
          quality: a.quality,
          score: a.score,
        });
      }
    }

    // Filtres : favori, sujet, durée, non-analysés, recherche.
    let list = withOwner;
    if (filter.favorisOnly) list = list.filter((r) => r.favori);
    if (filter.subjectId != null)
      list = list.filter((r) => r.subjectId === filter.subjectId);
    if (filter.durationTier)
      list = list.filter((r) => matchDurationTier(r.durationSec, filter.durationTier!));
    if (filter.notAnalyzedOnly)
      list = list.filter((r) => !analysisByKey.has(r.s3Key)); // aucune analyse encore
    if (filter.search?.trim()) {
      const q = filter.search.trim().toLowerCase();
      list = list.filter(
        (r) =>
          (r.subjectName ?? '').toLowerCase().includes(q) ||
          (r.adresse ?? '').toLowerCase().includes(q) ||
          (r.porteNumero ?? '').toLowerCase().includes(q),
      );
    }
    // Tri : favoris d'abord, puis récent.
    list.sort(
      (a, b) => Number(b.favori) - Number(a.favori) || b.maxId - a.maxId,
    );

    const total = list.length;
    const skip = filter.skip ?? 0;
    const take = Math.min(filter.take ?? 15, 100);
    const page = list.slice(skip, skip + take);

    const items = page.map((r) => {
      const a = analysisByKey.get(r.s3Key);
      return {
        s3Key: r.s3Key,
        porteId: r.porteId,
        subjectName: r.subjectName,
        subjectRole: r.subjectRole,
        subjectId: r.subjectId,
        statutPorte: r.statutPorte,
        durationSec: r.durationSec,
        adresse: r.adresse,
        porteNumero: r.porteNumero,
        porteEtage: r.porteEtage,
        favori: r.favori,
        analysisId: a?.id ?? null,
        analysisStatus: a?.status ?? null,
        quality: a?.quality ?? null,
        score: a?.score ?? null,
      };
    });
    return { items, total };
  }

  /**
   * Sujets (commerciaux/managers actifs) ayant des enregistrements coachables —
   * pour le menu déroulant de filtre de la liste de gestion.
   */
  async coachableSubjects(): Promise<
    { subjectId: number; subjectName: string; subjectRole: string }[]
  > {
    const coachable = await this.config.getCoachableStatuts();
    if (!coachable.length) return [];
    const portes = await this.prisma.porte.findMany({
      where: { statut: { in: coachable as StatutPorte[] }, recordingSegments: { some: {} } },
      select: {
        recordingSegments: { select: { commercialId: true, managerId: true } },
      },
    });
    const commIds = new Set<number>();
    const mgrIds = new Set<number>();
    for (const p of portes) {
      for (const s of p.recordingSegments) {
        if (s.commercialId != null) commIds.add(s.commercialId);
        else if (s.managerId != null) mgrIds.add(s.managerId);
      }
    }
    const [comms, mgrs] = await Promise.all([
      commIds.size
        ? this.prisma.commercial.findMany({
            where: { id: { in: [...commIds] }, status: UserStatus.ACTIF },
            select: { id: true, nom: true, prenom: true },
          })
        : Promise.resolve([] as { id: number; nom: string; prenom: string }[]),
      mgrIds.size
        ? this.prisma.manager.findMany({
            where: { id: { in: [...mgrIds] }, status: UserStatus.ACTIF },
            select: { id: true, nom: true, prenom: true },
          })
        : Promise.resolve([] as { id: number; nom: string; prenom: string }[]),
    ]);
    const out = [
      ...comms.map((c) => ({
        subjectId: c.id,
        subjectName: `${c.prenom} ${c.nom}`.trim(),
        subjectRole: 'commercial',
      })),
      ...mgrs.map((m) => ({
        subjectId: m.id,
        subjectName: `${m.prenom} ${m.nom}`.trim(),
        subjectRole: 'manager',
      })),
    ];
    out.sort((a, b) => a.subjectName.localeCompare(b.subjectName));
    return out;
  }

  private toDto(row: any): CoachingAnalysisDto {
    return {
      id: row.id,
      recordingId: row.recordingId,
      porteId: row.porteId,
      commercialId: row.commercialId,
      managerId: row.managerId,
      s3KeyOriginal: row.s3KeyOriginal,
      statutPorte: row.statutPorte ?? null,
      status: row.status,
      quality: row.quality ?? null,
      score: row.score ?? null,
      confidence: row.confidence ?? null,
      summary: row.summary ?? null,
      strengths: (row.strengths as string[]) ?? [],
      improvements: (row.improvements as string[]) ?? [],
      recommendations: (row.recommendations as string[]) ?? [],
      subScores: (row.subScores as StepScore[]) ?? [],
      criterionResults: (row.criterionResults as CriterionScore[]) ?? [],
      transcript: row.transcript ?? null,
      transcriptDurationSec: row.transcriptDurationSec ?? null,
      error: row.error ?? null,
      planSlug: row.salesPlanVersion?.slug ?? '',
      planVersion: row.salesPlanVersion?.version ?? 0,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      favori: row.porte?.coachingFavori ?? false,
      // Enrichi après coup par resolveSubjects (listAnalyses).
      subjectName: null,
      subjectRole: null,
      subjectId: null,
    };
  }
}
