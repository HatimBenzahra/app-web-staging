import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import type { CurrentUser } from './coaching-engine.types';
import { CoachingQueueService } from './coaching-queue.service';

@Injectable()
export class CoachingAnalysisJobService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: CoachingQueueService,
  ) {}

  async enqueueAnalysisJob(
    sessionId: number,
    currentUser: CurrentUser,
    priority: number,
  ): Promise<void> {
    await this.prisma.coachingAnalysisJob.upsert({
      where: { coachingSessionId: sessionId },
      create: {
        coachingSessionId: sessionId,
        priority,
        status: 'QUEUED',
        currentStep: 'En attente dans la file',
        createdByRole: currentUser.role,
        createdByUserId: currentUser.id,
      },
      update: {
        priority,
        status: 'QUEUED',
        attempts: 0,
        queuedAt: new Date(),
        startedAt: null,
        completedAt: null,
        failedAt: null,
        nextRunAt: null,
        lastHeartbeatAt: null,
        currentStep: 'En attente dans la file',
        failureReason: null,
      },
    });
    this.queueService.triggerPump();
  }

  async updateAnalysisJobStep(
    jobId: number | undefined,
    currentStep: string,
  ): Promise<void> {
    if (!jobId) return;
    await this.prisma.coachingAnalysisJob.update({
      where: { id: jobId },
      data: {
        currentStep,
        lastHeartbeatAt: new Date(),
      },
    });
  }
}
