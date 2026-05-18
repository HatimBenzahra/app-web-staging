import { ForbiddenException, forwardRef, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { RecordingService } from '../../recording/recording.service';
import {
  CoachingRecordingCandidatesInput,
  CoachingRecordingCandidatesPageDto,
} from '../coaching.dto';
import { scoreRecordingExploitability } from './coaching-recording-catalog.utils';

type CurrentUser = {
  id: number;
  role: string;
};

type RecordingsListCacheEntry = {
  result: Awaited<ReturnType<RecordingService['listAllRecordings']>>;
  expiresAt: number;
};

@Injectable()
export class CoachingRecordingCatalogService {
  private readonly prefix = process.env.S3_PREFIX || 'recordings/';
  private readonly recordingsListCacheTtlMs = 60_000;
  private readonly recordingsListCache = new Map<string, RecordingsListCacheEntry>();
  private readonly recordingsListInflight = new Map<
    string,
    Promise<Awaited<ReturnType<RecordingService['listAllRecordings']>>>
  >();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => RecordingService))
    private readonly recordingService: RecordingService,
  ) {}

  private async getRecordingsListCached(
    roomNames: string[],
    currentUser: CurrentUser,
  ): Promise<Awaited<ReturnType<RecordingService['listAllRecordings']>>> {
    const cacheKey = `${currentUser.role}:${currentUser.id}:${[...roomNames].sort().join(',')}`;
    const now = Date.now();

    const cached = this.recordingsListCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.result;
    }

    const inflight = this.recordingsListInflight.get(cacheKey);
    if (inflight) {
      return inflight;
    }

    const promise = this.recordingService
      .listAllRecordings(roomNames, currentUser)
      .then((result) => {
        this.recordingsListCache.set(cacheKey, {
          result,
          expiresAt: Date.now() + this.recordingsListCacheTtlMs,
        });
        return result;
      })
      .finally(() => {
        this.recordingsListInflight.delete(cacheKey);
      });

    this.recordingsListInflight.set(cacheKey, promise);
    return promise;
  }

  invalidateRecordingsListCache(): void {
    this.recordingsListCache.clear();
  }

  async getRecordingCandidates(
    input: CoachingRecordingCandidatesInput | undefined,
    currentUser: CurrentUser,
  ): Promise<CoachingRecordingCandidatesPageDto> {
    this.assertAdminOrDirecteur(currentUser);

    const limit = this.clampPositiveInt(input?.limit, 20, 100);
    const offset = this.clampNonNegativeInt(input?.offset, 0);
    const search = this.cleanOptionalText(input?.search)?.toLowerCase() ?? '';
    const commercialFilter = input?.commercialId;
    const analysisStatusFilter = this.cleanOptionalText(input?.analysisStatus);
    const speechLevelFilter = this.cleanOptionalText(input?.speechLevel);
    const periodRange = this.resolveRecordingPeriod(input);

    const commercials = await this.getAccessibleCommercials(currentUser);
    if (commercials.length === 0) {
      return { items: [], total: 0, limit, offset };
    }

    const commercialById = new Map(
      commercials.map((commercial) => [commercial.id, commercial]),
    );

    const roomNames = commercials.map(
      (commercial) => `room:commercial:${commercial.id}`,
    );

    const recordings = await this.getRecordingsListCached(
      roomNames,
      currentUser,
    );

    const items = recordings.items.filter(
      (item) =>
        item.key.toLowerCase().endsWith('.mp4') &&
        !item.key.toLowerCase().endsWith('_conv.mp4'),
    );

    const mappedItems = items.map((item) => {
      const roomName = this.extractRoomFromKey(item.key);
      const commercialId = this.extractCommercialIdFromRoomName(roomName);
      const commercial = commercialId
        ? commercialById.get(commercialId)
        : undefined;

      return {
        key: item.key,
        roomName: roomName ?? undefined,
        commercialId: commercial?.id,
        commercialNom: commercial
          ? `${commercial.prenom} ${commercial.nom}`
          : undefined,
        commercialEmail: commercial?.email ?? undefined,
        lastModified: item.lastModified ?? undefined,
        size: item.size ?? undefined,
      };
    });

    const periodItems = mappedItems.filter((item) => {
      if (!periodRange.from && !periodRange.to) {
        return true;
      }
      if (!item.lastModified) {
        return false;
      }
      const timestamp = item.lastModified.getTime();
      if (periodRange.from && timestamp < periodRange.from.getTime()) {
        return false;
      }
      if (periodRange.to && timestamp > periodRange.to.getTime()) {
        return false;
      }
      return true;
    });

    const searchedItems = search
      ? periodItems.filter((item) =>
          [
            item.key,
            item.roomName,
            item.commercialNom,
            item.commercialEmail,
            item.commercialId ? String(item.commercialId) : undefined,
          ]
            .filter(Boolean)
            .some((value) => value!.toLowerCase().includes(search)),
        )
      : periodItems;

    const speechScores = this.recordingService.getSpeechScores(
      searchedItems.map((item) => item.key),
    );
    const speechByKey = new Map(speechScores.map((score) => [score.key, score]));

    const latestSessions = await this.prisma.coachingSession.findMany({
      where: {
        s3KeyOriginal: {
          in: searchedItems.map((item) => item.key),
        },
      },
      include: {
        analysisJobs: {
          orderBy: { updatedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: [{ updatedAt: 'desc' }],
    });

    const latestByKey = new Map<string, (typeof latestSessions)[number]>();
    for (const session of latestSessions) {
      if (!latestByKey.has(session.s3KeyOriginal)) {
        latestByKey.set(session.s3KeyOriginal, session);
      }
    }

    const enrichedItems = searchedItems
      .map((item) => {
        const latestSession = latestByKey.get(item.key);
        const latestJob = latestSession?.analysisJobs?.[0];
        const speechScore = speechByKey.get(item.key);
        const exploitability = scoreRecordingExploitability({
          item,
          speechScore,
          latestSessionStatus: latestSession?.status ?? null,
        });

        return {
          ...item,
          latestSessionId: latestSession?.id,
          latestSessionStatus: latestSession?.status as any,
          speechScore: speechScore?.score,
          speechScoreStatus: speechScore?.status,
          totalDurationSec: speechScore?.totalDurationSec,
          speechDurationSec: speechScore?.speechDurationSec,
          exploitabilityScore: exploitability.score,
          exploitabilityStatus: exploitability.status as any,
          exploitabilityReasons: exploitability.reasons,
          analysisJobId: latestJob?.id,
          analysisJobStatus: latestJob?.status as any,
          analysisQueuedAt: latestJob?.queuedAt ?? undefined,
          analysisStartedAt: latestJob?.startedAt ?? undefined,
        };
      })
      .filter(
        (item) =>
          input?.includeLowValue ||
          !['LOW_VALUE', 'ALREADY_ANALYZED'].includes(
            item.exploitabilityStatus,
          ),
      )
      .filter((item) => {
        if (commercialFilter && item.commercialId !== commercialFilter) {
          return false;
        }
        if (
          analysisStatusFilter &&
          analysisStatusFilter !== 'ALL' &&
          item.latestSessionStatus !== analysisStatusFilter &&
          item.analysisJobStatus !== analysisStatusFilter
        ) {
          return false;
        }
        if (!speechLevelFilter || speechLevelFilter === 'ALL') {
          return true;
        }
        const score = item.speechScore;
        if (speechLevelFilter === 'HIGH') {
          return typeof score === 'number' && score >= 65;
        }
        if (speechLevelFilter === 'MEDIUM') {
          return typeof score === 'number' && score >= 45 && score < 65;
        }
        if (speechLevelFilter === 'LOW') {
          return typeof score === 'number' && score < 45;
        }
        if (speechLevelFilter === 'PENDING') {
          return item.speechScoreStatus !== 'ready';
        }
        return true;
      })
      .sort((a, b) => {
        const scoreDelta = b.exploitabilityScore - a.exploitabilityScore;
        if (scoreDelta !== 0) {
          return scoreDelta;
        }
        return (
          (b.lastModified?.getTime() || 0) -
          (a.lastModified?.getTime() || 0)
        );
      });

    return {
      items: enrichedItems.slice(offset, offset + limit),
      total: enrichedItems.length,
      limit,
      offset,
    };
  }

  private assertAdminOrDirecteur(currentUser: CurrentUser): void {
    if (currentUser.role !== 'admin' && currentUser.role !== 'directeur') {
      throw new ForbiddenException('Accès réservé admin/directeur');
    }
  }

  private cleanOptionalText(value?: string | null): string | null {
    if (!value) {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private clampPositiveInt(value: unknown, fallback: number, max: number): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }
    return Math.min(Math.max(Math.floor(parsed), 1), max);
  }

  private clampNonNegativeInt(value: unknown, fallback: number): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }
    return Math.max(Math.floor(parsed), 0);
  }

  private resolveRecordingPeriod(
    input?: CoachingRecordingCandidatesInput,
  ): { from?: Date; to?: Date } {
    const now = new Date();
    const period = input?.period ?? 'LAST_7_DAYS';

    if (period === 'ALL') {
      return {};
    }

    if (period === 'CUSTOM') {
      return {
        from: input?.from,
        to: input?.to,
      };
    }

    if (period === 'TODAY') {
      const from = new Date(now);
      from.setHours(0, 0, 0, 0);
      return { from, to: now };
    }

    const days = period === 'LAST_30_DAYS' ? 30 : 7;
    const from = new Date(now);
    from.setDate(from.getDate() - days);
    return { from, to: now };
  }

  private async getAccessibleCommercials(currentUser: CurrentUser) {
    if (currentUser.role === 'admin') {
      return this.prisma.commercial.findMany({
        select: {
          id: true,
          nom: true,
          prenom: true,
          email: true,
          directeurId: true,
        },
        orderBy: [{ prenom: 'asc' }, { nom: 'asc' }],
      });
    }

    return this.prisma.commercial.findMany({
      where: {
        directeurId: currentUser.id,
      },
      select: {
        id: true,
        nom: true,
        prenom: true,
        email: true,
        directeurId: true,
      },
      orderBy: [{ prenom: 'asc' }, { nom: 'asc' }],
    });
  }

  private extractRoomFromKey(key: string): string | null {
    if (!key.startsWith(this.prefix)) {
      return null;
    }
    const remainder = key.slice(this.prefix.length);
    const [safeRoom] = remainder.split('/');
    if (!safeRoom) {
      return null;
    }
    return safeRoom.replace(/_/g, ':');
  }

  private extractCommercialIdFromRoomName(
    roomName?: string | null,
  ): number | null {
    if (!roomName) {
      return null;
    }
    const parts = roomName.split(':');
    if (parts.length !== 3) {
      return null;
    }
    if (parts[1]?.toUpperCase() !== 'COMMERCIAL') {
      return null;
    }
    const commercialId = Number(parts[2]);
    return Number.isFinite(commercialId) ? commercialId : null;
  }
}
