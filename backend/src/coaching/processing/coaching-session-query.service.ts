import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { CoachingSessionStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { RecordingService } from '../../recording/recording.service';
import {
  CoachingAnalysisQueueInput,
  CoachingQueueStateDto,
  CoachingSessionDto,
  CoachingSessionsInput,
  CoachingSessionsPageDto,
} from '../coaching.dto';
import { assertAdminOrDirecteur } from '../utils/coaching-common.utils';
import { mapAnalysisJob, mapSession, secondsSince } from '../utils/coaching-mapping.utils';
import type { CurrentUser } from './coaching-engine.types';

@Injectable()
export class CoachingSessionQueryService {
  private readonly logger = new Logger(CoachingSessionQueryService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => RecordingService))
    private readonly recordingService: RecordingService,
  ) {}

  async getCoachingSessions(
    input: CoachingSessionsInput | undefined,
    currentUser: CurrentUser,
  ): Promise<CoachingSessionsPageDto> {
    assertAdminOrDirecteur(currentUser);
    const limit = Math.min(Math.max(input?.limit ?? 20, 1), 100);
    const offset = Math.max(input?.offset ?? 0, 0);
    const where = this.buildCoachingSessionsWhere(input, currentUser);
    const [sessions, total] = await Promise.all([
      this.prisma.coachingSession.findMany({
        where,
        include: {
          commercial: true,
          salesPlanVersion: { include: { salesPlan: true } },
          analysisJobs: { orderBy: { updatedAt: 'desc' }, take: 1 },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.coachingSession.count({ where }),
    ]);
    return { items: sessions.map((session) => mapSession(session)), total, limit, offset };
  }

  async getAnalysisQueue(
    input: CoachingAnalysisQueueInput | undefined,
    currentUser: CurrentUser,
  ): Promise<CoachingQueueStateDto> {
    assertAdminOrDirecteur(currentUser);
    const limit = Math.min(Math.max(input?.limit ?? 20, 1), 100);
    const offset = Math.max(input?.offset ?? 0, 0);
    const sessionWhere = this.buildAccessWhere(currentUser);
    const [jobs, grouped, total] = await Promise.all([
      this.prisma.coachingAnalysisJob.findMany({
        where: { coachingSession: sessionWhere },
        orderBy: [{ status: 'asc' }, { priority: 'desc' }, { queuedAt: 'asc' }],
        take: limit,
        skip: offset,
      }),
      this.prisma.coachingAnalysisJob.groupBy({
        by: ['status'],
        where: { coachingSession: sessionWhere },
        _count: { _all: true },
      }),
      this.prisma.coachingAnalysisJob.count({
        where: { coachingSession: sessionWhere },
      }),
    ]);
    const counts = new Map(grouped.map((entry) => [entry.status, entry._count._all]));
    const oldestQueued = jobs
      .filter((job) => job.status === 'QUEUED')
      .sort((a, b) => a.queuedAt.getTime() - b.queuedAt.getTime())[0];
    return {
      summary: {
        queued: counts.get('QUEUED') ?? 0,
        processing: counts.get('PROCESSING') ?? 0,
        completed: counts.get('COMPLETED') ?? 0,
        failed: counts.get('FAILED') ?? 0,
        cancelled: counts.get('CANCELLED') ?? 0,
        concurrency: 1,
        oldestQueuedAgeSeconds: oldestQueued
          ? secondsSince(oldestQueued.queuedAt)
          : undefined,
      },
      jobs: jobs.map((job) => mapAnalysisJob(job)),
      total,
      limit,
      offset,
    };
  }

  async getCoachingSession(
    id: number,
    currentUser: CurrentUser,
  ): Promise<CoachingSessionDto> {
    assertAdminOrDirecteur(currentUser);
    const session = await this.prisma.coachingSession.findUnique({
      where: { id },
      include: {
        commercial: true,
        salesPlanVersion: {
          include: { salesPlan: true, steps: { orderBy: { ordre: 'asc' } } },
        },
        analysisJobs: { orderBy: { updatedAt: 'desc' }, take: 1 },
        stepEvaluations: { orderBy: { ordre: 'asc' } },
        conversationEvaluations: { orderBy: { ordre: 'asc' } },
        keyMoments: { orderBy: [{ importance: 'desc' }, { startTime: 'asc' }] },
      },
    });
    if (!session) throw new NotFoundException('Session coaching introuvable');
    await this.assertSessionAccess(session, currentUser);
    let audioUrl: string | undefined;
    try {
      audioUrl =
        (await this.recordingService.getStreamingUrl(
          session.s3KeyOriginal,
          currentUser,
        )) || undefined;
    } catch (error) {
      this.logger.warn(
        `Impossible de signer l'audio de la session ${session.id}: ${error?.message || error}`,
      );
    }
    return mapSession(session, audioUrl);
  }

  async assertSessionAccess(
    session: { directeurId?: number | null; commercial?: { directeurId?: number | null } | null },
    currentUser: CurrentUser,
  ): Promise<void> {
    assertAdminOrDirecteur(currentUser);
    if (currentUser.role === 'admin') return;
    if (
      session.directeurId !== currentUser.id &&
      session.commercial?.directeurId !== currentUser.id
    ) {
      throw new ForbiddenException("Vous n'avez pas accès à cette session");
    }
  }

  private buildCoachingSessionsWhere(
    input: CoachingSessionsInput | undefined,
    currentUser: CurrentUser,
  ): Prisma.CoachingSessionWhereInput {
    const andConditions: Prisma.CoachingSessionWhereInput[] = [];
    if (currentUser.role !== 'admin') andConditions.push(this.buildAccessWhere(currentUser));
    const search = input?.search?.trim();
    if (search) andConditions.push({ OR: this.buildSearchConditions(search) });
    if (input?.status && input.status !== 'ALL') {
      andConditions.push(
        input.status === 'ACTIVE'
          ? { status: { in: ['PENDING', 'PROCESSING'] } }
          : { status: input.status as CoachingSessionStatus },
      );
    }
    if (input?.reviewStatus) andConditions.push({ reviewStatus: input.reviewStatus });
    if (input?.scoreLevel && input.scoreLevel !== 'ALL') {
      andConditions.push(this.buildScoreWhere(input.scoreLevel));
    }
    return andConditions.length > 0 ? { AND: andConditions } : {};
  }

  private buildAccessWhere(currentUser: CurrentUser): Prisma.CoachingSessionWhereInput {
    return currentUser.role === 'admin'
      ? {}
      : {
          OR: [
            { directeurId: currentUser.id },
            { commercial: { directeurId: currentUser.id } },
          ],
        };
  }

  private buildSearchConditions(search: string): Prisma.CoachingSessionWhereInput[] {
    const numericSearch = Number(search.replace(/^#/, ''));
    const conditions: Prisma.CoachingSessionWhereInput[] = [
      {
        commercial: {
          OR: [
            { nom: { contains: search, mode: 'insensitive' } },
            { prenom: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        },
      },
      { roomName: { contains: search, mode: 'insensitive' } },
      { s3KeyOriginal: { contains: search, mode: 'insensitive' } },
      { salesPlanVersion: { salesPlan: { nom: { contains: search, mode: 'insensitive' } } } },
    ];
    if (Number.isInteger(numericSearch) && numericSearch > 0) {
      conditions.push({ id: numericSearch });
    }
    return conditions;
  }

  private buildScoreWhere(scoreLevel: string): Prisma.CoachingSessionWhereInput {
    if (scoreLevel === 'HIGH') return { overallScore: { gte: 80 } };
    if (scoreLevel === 'MEDIUM') return { overallScore: { gte: 50, lt: 80 } };
    return { OR: [{ overallScore: { lt: 50 } }, { overallScore: null }] };
  }
}
