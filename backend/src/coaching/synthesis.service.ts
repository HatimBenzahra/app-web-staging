import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CoachingStatus, UserType } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { LlmService } from './llm.service';
import { CoachingSynthesisDto } from './coaching.dto';
import {
  buildSynthesisSystemPrompt,
  buildSynthesisUserPrompt,
  parseSynthesisOutput,
} from './synthesis-prompt';

type SubjectType = 'commercial' | 'manager';
const RECENT_SESSIONS = 12; // sessions détaillées passées au LLM

@Injectable()
export class SynthesisService {
  private readonly logger = new Logger(SynthesisService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
  ) {}

  // ---------------------------------------------------------------------------
  // Lecture
  // ---------------------------------------------------------------------------

  async getSynthesis(
    subjectType: SubjectType,
    subjectId: number,
  ): Promise<CoachingSynthesisDto | null> {
    const row = await this.prisma.coachingSynthesis.findUnique({
      where: { subjectKey: `${subjectType}:${subjectId}` },
    });
    if (!row) return null;
    // Période couverte = min/max du createdAt (BD) des enregistrements analysés
    // (status READY) du sujet, recalculée à chaque affichage (pas figée).
    const where =
      subjectType === 'commercial'
        ? { commercialId: subjectId }
        : { managerId: subjectId };
    const period = await this.prisma.recording.aggregate({
      where: {
        coachingAnalyses: { some: { ...where, status: CoachingStatus.READY } },
      },
      _min: { createdAt: true },
      _max: { createdAt: true },
    });
    return this.toDto(row, {
      periodStart: period._min.createdAt?.toISOString() ?? null,
      periodEnd: period._max.createdAt?.toISOString() ?? null,
    });
  }

  // ---------------------------------------------------------------------------
  // Génération (manuelle : non bloquante + poll côté UI)
  // ---------------------------------------------------------------------------

  /** Passe la synthèse en ANALYZING et lance la génération en fond. */
  async requestGenerate(
    subjectType: SubjectType,
    subjectId: number,
  ): Promise<CoachingSynthesisDto> {
    if (!this.llm.isConfigured()) {
      throw new BadRequestException('vLLM non configuré');
    }
    const subjectKey = `${subjectType}:${subjectId}`;
    const row = await this.prisma.coachingSynthesis.upsert({
      where: { subjectKey },
      create: {
        subjectKey,
        subjectType,
        commercialId: subjectType === 'commercial' ? subjectId : null,
        managerId: subjectType === 'manager' ? subjectId : null,
        status: CoachingStatus.ANALYZING,
      },
      update: { status: CoachingStatus.ANALYZING, error: null },
    });
    void this.runGenerate(subjectType, subjectId);
    return this.toDto(row);
  }

  /** Pipeline de génération : snapshot → LLM → stockage. */
  async runGenerate(subjectType: SubjectType, subjectId: number): Promise<void> {
    const subjectKey = `${subjectType}:${subjectId}`;
    try {
      const snapshot = await this.buildSnapshot(subjectType, subjectId);
      const raw = await this.llm.chatJson(
        buildSynthesisSystemPrompt(),
        buildSynthesisUserPrompt(snapshot),
      );
      const out = parseSynthesisOutput(raw);
      await this.prisma.coachingSynthesis.update({
        where: { subjectKey },
        data: {
          status: CoachingStatus.READY,
          sections: out as unknown as object, // { bilan, performanceTerrain, contrats, forces, axes, planAction }
          // Tendance & score = source de vérité backend (le LLM ne fait que rédiger).
          trend: snapshot.tendance.direction,
          scoreMoyen: snapshot.coaching.scoreMoyen,
          nbAnalyses: snapshot.coaching.nbAnalyses,
          stats: snapshot as unknown as object,
          error: null,
          generatedAt: new Date(),
        },
      });
      this.logger.log(`Synthèse ${subjectKey} générée (${snapshot.coaching.nbAnalyses} analyses)`);
    } catch (e) {
      this.logger.error(`Synthèse ${subjectKey} échouée: ${(e as Error).message}`);
      await this.prisma.coachingSynthesis
        .update({
          where: { subjectKey },
          data: { status: CoachingStatus.FAILED, error: (e as Error).message },
        })
        .catch(() => undefined);
    }
  }

  // ---------------------------------------------------------------------------
  // Cron configurable (tick régulier qui lit la planif en base)
  // ---------------------------------------------------------------------------

  /**
   * Tick toutes les 10 min : régénère si l'échéance planifiée (rythme + heure,
   * config éditable) est passée depuis la dernière exécution. Robuste (pas de
   * reprogrammation dynamique du scheduler), exécuté au plus une fois par créneau.
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async synthesisTick(): Promise<void> {
    if (!this.llm.isConfigured()) return;
    const cfg = await this.prisma.coachingConfig.findUnique({ where: { id: 1 } });
    if (!cfg || (cfg.synthesisCronFrequency ?? 'daily') === 'off') return;

    const now = new Date();
    const scheduled = mostRecentScheduled(
      cfg.synthesisCronFrequency ?? 'daily',
      cfg.synthesisCronHour ?? 3,
      cfg.synthesisCronMinute ?? 0,
      cfg.synthesisCronWeekday ?? 1,
      now,
    );
    if (!scheduled) return;
    // Déjà exécuté pour ce créneau ?
    if (cfg.synthesisCronLastRunAt && cfg.synthesisCronLastRunAt >= scheduled) return;

    this.logger.log(
      `Cron synthèse déclenché (créneau ${scheduled.toISOString()})`,
    );
    try {
      await this.regenerateAllActive();
    } finally {
      await this.prisma.coachingConfig
        .update({ where: { id: 1 }, data: { synthesisCronLastRunAt: new Date() } })
        .catch(() => undefined);
    }
  }

  /** Met à jour la planif du cron de synthèse (Réglages). */
  async setCron(input: {
    frequency: string;
    hour: number;
    minute: number;
    weekday: number;
  }): Promise<void> {
    const frequency = ['daily', 'weekly', 'off'].includes(input.frequency)
      ? input.frequency
      : 'daily';
    const hour = Math.max(0, Math.min(23, Math.round(input.hour ?? 3)));
    const minute = Math.max(0, Math.min(59, Math.round(input.minute ?? 0)));
    const weekday = Math.max(0, Math.min(6, Math.round(input.weekday ?? 1)));
    await this.prisma.coachingConfig.upsert({
      where: { id: 1 },
      create: {
        id: 1,
        coachableStatuts: [],
        synthesisCronFrequency: frequency,
        synthesisCronHour: hour,
        synthesisCronMinute: minute,
        synthesisCronWeekday: weekday,
      },
      update: {
        synthesisCronFrequency: frequency,
        synthesisCronHour: hour,
        synthesisCronMinute: minute,
        synthesisCronWeekday: weekday,
      },
    });
  }

  /** Régénère les synthèses des sujets actifs ayant de nouvelles analyses. */
  async regenerateAllActive(): Promise<number> {
    const subjects = await this.activeSubjectsWithAnalyses();
    let n = 0;
    for (const s of subjects) {
      const needed = await this.needsRegeneration(s.type, s.id);
      if (!needed) continue;
      await this.runGenerate(s.type, s.id); // séquentiel (nuit)
      n++;
    }
    this.logger.log(`Cron synthèses : ${n}/${subjects.length} régénérées`);
    return n;
  }

  private async activeSubjectsWithAnalyses(): Promise<
    { type: SubjectType; id: number }[]
  > {
    const [comm, mgr] = await Promise.all([
      this.prisma.coachingAnalysis.findMany({
        where: { status: CoachingStatus.READY, commercialId: { not: null } },
        distinct: ['commercialId'],
        select: { commercialId: true },
      }),
      this.prisma.coachingAnalysis.findMany({
        where: { status: CoachingStatus.READY, managerId: { not: null } },
        distinct: ['managerId'],
        select: { managerId: true },
      }),
    ]);
    const commIds = comm.map((c) => c.commercialId!).filter((x) => x != null);
    const mgrIds = mgr.map((m) => m.managerId!).filter((x) => x != null);
    const [activeComm, activeMgr] = await Promise.all([
      commIds.length
        ? this.prisma.commercial.findMany({
            where: { id: { in: commIds }, status: 'ACTIF' },
            select: { id: true },
          })
        : Promise.resolve([]),
      mgrIds.length
        ? this.prisma.manager.findMany({
            where: { id: { in: mgrIds }, status: 'ACTIF' },
            select: { id: true },
          })
        : Promise.resolve([]),
    ]);
    return [
      ...activeComm.map((c) => ({ type: 'commercial' as const, id: c.id })),
      ...activeMgr.map((m) => ({ type: 'manager' as const, id: m.id })),
    ];
  }

  /** True si aucune synthèse READY, ou si de nouvelles analyses depuis generatedAt. */
  private async needsRegeneration(
    subjectType: SubjectType,
    subjectId: number,
  ): Promise<boolean> {
    const existing = await this.prisma.coachingSynthesis.findUnique({
      where: { subjectKey: `${subjectType}:${subjectId}` },
      select: { status: true, generatedAt: true },
    });
    if (!existing || existing.status !== CoachingStatus.READY || !existing.generatedAt) {
      return true;
    }
    const where =
      subjectType === 'commercial'
        ? { commercialId: subjectId }
        : { managerId: subjectId };
    const last = await this.prisma.coachingAnalysis.findFirst({
      where: { ...where, status: CoachingStatus.READY },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    return !!last && last.createdAt > existing.generatedAt;
  }

  // ---------------------------------------------------------------------------
  // Snapshot agrégé (entrée du LLM) — 100 % DB
  // ---------------------------------------------------------------------------

  private async buildSnapshot(subjectType: SubjectType, subjectId: number) {
    const isCommercial = subjectType === 'commercial';
    const where = isCommercial
      ? { commercialId: subjectId }
      : { managerId: subjectId };
    const userType = isCommercial ? UserType.COMMERCIAL : UserType.MANAGER;

    const subject = isCommercial
      ? await this.prisma.commercial.findUnique({
          where: { id: subjectId },
          select: { nom: true, prenom: true },
        })
      : await this.prisma.manager.findUnique({
          where: { id: subjectId },
          select: { nom: true, prenom: true },
        });

    const analyses = await this.prisma.coachingAnalysis.findMany({
      where: { ...where, status: CoachingStatus.READY },
      select: {
        id: true,
        score: true,
        statutPorte: true,
        summary: true,
        strengths: true,
        improvements: true,
        criterionResults: true,
        transcriptDurationSec: true,
        porteId: true,
        s3KeyOriginal: true,
        createdAt: true,
        recording: { select: { createdAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Date RÉELLE de l'échange = timestamp de la clé S3 (capture mobile),
    // pas la date de lancement de l'analyse. Repli sur createdAt si non parsable.
    const recDateOf = (a: { s3KeyOriginal: string; createdAt: Date }): Date =>
      parseRecordingDate(a.s3KeyOriginal) ?? a.createdAt;

    // Agrégats scores
    const scores = analyses
      .map((a) => a.score)
      .filter((n): n is number => typeof n === 'number');
    const round = (n: number) => Math.round(n * 10) / 10;
    const scoreMoyen = scores.length
      ? round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : null;

    // Agrégat par critère (atteint / partiel / absent)
    const critMap = new Map<
      string,
      { titre: string; atteint: number; partiel: number; absent: number }
    >();
    for (const a of analyses) {
      const crits = (a.criterionResults as any[]) ?? [];
      for (const c of crits) {
        if (c.status === 'non_applicable') continue;
        const key = c.criterionKey || c.title;
        const cur =
          critMap.get(key) ??
          { titre: c.title, atteint: 0, partiel: 0, absent: 0 };
        if (c.status === 'atteint') cur.atteint++;
        else if (c.status === 'partiel') cur.partiel++;
        else cur.absent++;
        critMap.set(key, cur);
      }
    }

    // Répartition des statuts COACHÉS (uniquement les échanges analysés)
    const statutsCoaches: Record<string, number> = {};
    for (const a of analyses) {
      if (!a.statutPorte) continue;
      statutsCoaches[a.statutPorte] = (statutsCoaches[a.statutPorte] ?? 0) + 1;
    }

    // Répartition GLOBALE des statuts + DURÉE par porte (TOUTES ses portes
    // enregistrées, y compris ABSENT / NON_VISITE / À repasser). 1 porte = 1 fois,
    // durée = max des segments de la porte (cohérent avec le pré-gating).
    const segs = await this.prisma.recordingSegment.findMany({
      where,
      select: {
        porteId: true,
        durationSec: true,
        porte: { select: { statut: true } },
      },
    });
    const porteAgg = new Map<
      number,
      { statut: string | null; duree: number }
    >();
    for (const s of segs) {
      if (s.porteId == null) continue;
      const prev = porteAgg.get(s.porteId);
      const d = s.durationSec ?? 0;
      if (!prev) {
        porteAgg.set(s.porteId, { statut: s.porte?.statut ?? null, duree: d });
      } else if (d > prev.duree) {
        prev.duree = d;
      }
    }
    const seenPortes = new Set<number>(porteAgg.keys());
    const statutsGlobal: Record<string, number> = {};
    const dureeSumParStatut: Record<string, { sum: number; n: number }> = {};
    let dureeSumGlobal = 0;
    let dureeNGlobal = 0;
    for (const { statut, duree } of porteAgg.values()) {
      if (statut) statutsGlobal[statut] = (statutsGlobal[statut] ?? 0) + 1;
      if (duree > 0) {
        dureeSumGlobal += duree;
        dureeNGlobal++;
        if (statut) {
          const cur = dureeSumParStatut[statut] ?? { sum: 0, n: 0 };
          cur.sum += duree;
          cur.n++;
          dureeSumParStatut[statut] = cur;
        }
      }
    }
    const dureeMoyenneSec = dureeNGlobal
      ? Math.round(dureeSumGlobal / dureeNGlobal)
      : null;
    const dureeMoyenneParStatut: Record<string, number> = {};
    for (const [st, v] of Object.entries(dureeSumParStatut)) {
      dureeMoyenneParStatut[st] = Math.round(v.sum / v.n);
    }

    // Tendance : score moyen par semaine ISO (basée sur la date d'échange réelle)
    const weekAgg = new Map<string, { sum: number; n: number }>();
    for (const a of analyses) {
      if (typeof a.score !== 'number') continue;
      const w = isoWeek(recDateOf(a));
      const cur = weekAgg.get(w) ?? { sum: 0, n: 0 };
      cur.sum += a.score;
      cur.n++;
      weekAgg.set(w, cur);
    }
    const scoreParSemaine = [...weekAgg.entries()]
      .map(([s, v]) => ({ s, score: round(v.sum / v.n) }))
      .sort((a, b) => a.s.localeCompare(b.s));
    const direction = trendDirection(scoreParSemaine.map((x) => x.score));

    // Sessions détaillées récentes (verdict + commentaire par critère, sans transcript)
    const sessionsRecentes = analyses.slice(0, RECENT_SESSIONS).map((a) => ({
      date: recDateOf(a).toISOString().slice(0, 10),
      statutPorte: a.statutPorte ?? null,
      score: typeof a.score === 'number' ? Math.round(a.score) : null,
      dureeSec:
        typeof a.transcriptDurationSec === 'number'
          ? Math.round(a.transcriptDurationSec)
          : null,
      resume: a.summary ?? null,
      forces: (a.strengths as string[]) ?? [],
      axes: (a.improvements as string[]) ?? [],
      criteres: ((a.criterionResults as any[]) ?? [])
        .filter((c) => c.status !== 'non_applicable')
        .map((c) => ({
          titre: c.title,
          verdict: c.status,
          commentaire: c.comment ?? null,
        })),
    }));

    // Contrats signés (type via Offre)
    const contrats = await this.prisma.contratValide.findMany({
      where,
      select: {
        periodMonth: true,
        offre: { select: { nom: true, categorie: true, badgeProductKey: true } },
      },
    });
    const parTypeMap = new Map<string, { categorie: string; offre: string; count: number }>();
    const parMois: Record<string, number> = {};
    for (const c of contrats) {
      const categorie = c.offre?.categorie ?? 'Inconnu';
      const offre = c.offre?.nom ?? c.offre?.badgeProductKey ?? 'Inconnu';
      const key = `${categorie}|${offre}`;
      const cur = parTypeMap.get(key) ?? { categorie, offre, count: 0 };
      cur.count++;
      parTypeMap.set(key, cur);
      if (c.periodMonth) parMois[c.periodMonth] = (parMois[c.periodMonth] ?? 0) + 1;
    }

    // Zone de terrain : zone assignée + quartiers + terrain réel (immeubles coachés)
    const zoneEnCours = await this.prisma.zoneEnCours.findFirst({
      where: { userId: subjectId, userType },
      select: { zone: { select: { nom: true } } },
    });
    const quartiersAssignes = await this.prisma.quartier.findMany({
      where,
      select: { nom: true },
    });
    const porteIds = analyses
      .map((a) => a.porteId)
      .filter((x): x is number => x != null);
    const portes = porteIds.length
      ? await this.prisma.porte.findMany({
          where: { id: { in: porteIds } },
          select: {
            immeuble: {
              select: {
                adresse: true,
                typeHabitat: true,
                zone: { select: { nom: true } },
                quartier: { select: { nom: true } },
              },
            },
          },
        })
      : [];
    const villes = new Set<string>();
    const zonesReelles = new Set<string>();
    const quartiersReels = new Set<string>();
    const habitatCount: Record<string, number> = {};
    for (const p of portes) {
      const imm = p.immeuble;
      if (!imm) continue;
      const ville = extractVille(imm.adresse);
      if (ville) villes.add(ville);
      if (imm.zone?.nom) zonesReelles.add(imm.zone.nom);
      if (imm.quartier?.nom) quartiersReels.add(imm.quartier.nom);
      if (imm.typeHabitat)
        habitatCount[imm.typeHabitat] = (habitatCount[imm.typeHabitat] ?? 0) + 1;
    }

    return {
      sujet: {
        type: subjectType,
        nom: subject ? `${subject.prenom} ${subject.nom}`.trim() : null,
      },
      coaching: {
        nbAnalyses: analyses.length,
        scoreMoyen,
        scoreMin: scores.length ? Math.min(...scores) : null,
        scoreMax: scores.length ? Math.max(...scores) : null,
        criteres: [...critMap.values()],
        statutsCoaches,
      },
      activite: {
        // Tous les statuts de ses portes enregistrées (coachés ou non).
        statutsTousAudios: statutsGlobal,
        nbPortes: seenPortes.size,
        // Temps passé par porte (durée max par porte, en secondes).
        duree: {
          moyenneSec: dureeMoyenneSec,
          parStatut: dureeMoyenneParStatut,
        },
      },
      sessionsRecentes,
      contrats: {
        // Déclarés sur le terrain (statut porte CONTRAT_SIGNE) vs réellement
        // validés côté back-office (ContratValide). Écart = fiabilité.
        signesDeclares: statutsGlobal['CONTRAT_SIGNE'] ?? 0,
        valides: contrats.length,
        tauxValidation: statutsGlobal['CONTRAT_SIGNE']
          ? Math.round((contrats.length / statutsGlobal['CONTRAT_SIGNE']) * 100) / 100
          : null,
        parType: [...parTypeMap.values()].sort((a, b) => b.count - a.count),
        parMois,
      },
      zone: {
        zoneAssignee: zoneEnCours?.zone?.nom ?? null,
        quartiersAssignes: quartiersAssignes.map((q) => q.nom),
        villes: [...villes],
        zonesReelles: [...zonesReelles],
        quartiersReels: [...quartiersReels],
        typesHabitat: habitatCount,
      },
      tendance: { scoreParSemaine, direction },
      // Période couverte : min → max du createdAt (BD) des enregistrements
      // analysés. Cohérent avec le recalcul live de getSynthesis().
      periode: (() => {
        if (!analyses.length) return { start: null, end: null, nb: 0 };
        const times = analyses.map((a) => a.recording.createdAt.getTime());
        return {
          start: new Date(Math.min(...times)).toISOString(),
          end: new Date(Math.max(...times)).toISOString(),
          nb: analyses.length,
        };
      })(),
    };
  }

  private toDto(
    row: any,
    period?: { periodStart: string | null; periodEnd: string | null },
  ): CoachingSynthesisDto {
    const s = (row.sections as Record<string, string[]>) ?? {};
    const arr = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);
    return {
      subjectType: row.subjectType,
      subjectId: row.commercialId ?? row.managerId ?? null,
      status: row.status,
      analyse: arr(s.analyse),
      strengths: arr(s.strengths),
      improvements: arr(s.improvements),
      priorities: arr(s.priorities),
      trend: row.trend ?? null,
      scoreMoyen: row.scoreMoyen ?? null,
      nbAnalyses: row.nbAnalyses ?? 0,
      periodStart: period?.periodStart ?? null,
      periodEnd: period?.periodEnd ?? null,
      error: row.error ?? null,
      generatedAt: row.generatedAt ? row.generatedAt.toISOString() : null,
    };
  }
}

// --- Helpers ---------------------------------------------------------------

/** Semaine ISO "YYYY-Www". */
function isoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Compare la moyenne de la 1ère moitié vs 2nde moitié des points. */
function trendDirection(points: number[]): string {
  if (points.length < 2) return 'stagne';
  const mid = Math.floor(points.length / 2);
  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / (arr.length || 1);
  const first = avg(points.slice(0, mid));
  const second = avg(points.slice(mid));
  const delta = second - first;
  if (delta >= 5) return 'progresse';
  if (delta <= -5) return 'regresse';
  return 'stagne';
}

/**
 * Date de capture d'un enregistrement, extraite du suffixe de la clé S3
 * (ex. "…_2026-07-20T13-35-30.679Z.mp4" ou epoch). Null si non parsable.
 * Miroir de parseRecordingKey côté front.
 */
function parseRecordingDate(s3Key: string | null | undefined): Date | null {
  if (!s3Key) return null;
  const file = (s3Key.split('/').pop() ?? '').replace(/\.mp4$/i, '');
  const i = file.lastIndexOf('_');
  if (i < 0) return null;
  const raw = file.slice(i + 1);
  const epoch = Number(raw);
  if (Number.isFinite(epoch) && epoch > 0) {
    return new Date(epoch > 1e12 ? epoch : epoch * 1000);
  }
  // ISO avec tirets dans l'heure : 2026-07-20T13-35-30.679Z → 13:35:30
  const iso = raw.replace(/T(\d{2})-(\d{2})-(\d{2})/, 'T$1:$2:$3');
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Extrait "CP Ville" d'une adresse ("16 Rue X 93100 Montreuil" → "93100 Montreuil"). */
function extractVille(adresse: string): string | null {
  const m = /(\d{5})\s+([A-Za-zÀ-ÿ'\- ]+)$/.exec((adresse ?? '').trim());
  return m ? `${m[1]} ${m[2].trim()}` : null;
}

/**
 * Dernière échéance planifiée <= now, selon rythme + heure (config).
 * daily : aujourd'hui à HH:MM, sinon hier. weekly : dernière occurrence du
 * jour choisi à HH:MM. Renvoie null si 'off'.
 */
export function mostRecentScheduled(
  frequency: string,
  hour: number,
  minute: number,
  weekday: number,
  now: Date,
): Date | null {
  if (frequency === 'off') return null;
  const cand = new Date(now);
  cand.setHours(hour, minute, 0, 0);
  if (frequency === 'weekly') {
    const diff = (cand.getDay() - weekday + 7) % 7; // jours depuis le dernier jour cible
    cand.setDate(cand.getDate() - diff);
    if (cand > now) cand.setDate(cand.getDate() - 7);
    return cand;
  }
  // daily (défaut)
  if (cand > now) cand.setDate(cand.getDate() - 1);
  return cand;
}

const WEEKDAYS_FR = [
  'dimanche',
  'lundi',
  'mardi',
  'mercredi',
  'jeudi',
  'vendredi',
  'samedi',
];

/** Libellé lisible de la planif (ex. « Chaque jour à 03:00 », « Chaque lundi à 09:30 »). */
export function synthesisScheduleLabel(
  frequency: string,
  hour: number,
  minute: number,
  weekday: number,
): string {
  if (frequency === 'off') return 'Désactivé';
  const hhmm = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  if (frequency === 'weekly') {
    return `Chaque ${WEEKDAYS_FR[weekday] ?? 'jour'} à ${hhmm}`;
  }
  return `Chaque jour à ${hhmm}`;
}
