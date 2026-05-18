import { Injectable } from '@nestjs/common';
import {
  CoachingRecordingCandidatesInput,
  CoachingRecordingCandidatesPageDto,
  CoachingAnalysisQueueInput,
  CoachingQueueStateDto,
  CoachingSessionDto,
  CoachingSessionsInput,
  CoachingSessionsPageDto,
  CreateSalesPlanInput,
  CreateSalesPlanVersionInput,
  LaunchCoachingAnalysisInput,
  ReviewCoachingSessionInput,
  SalesPlanDto,
} from './coaching.dto';
import { CoachingEngineService } from './processing/coaching-engine.service';

type CurrentUser = {
  id: number;
  role: string;
};

@Injectable()
export class CoachingService {
  constructor(private readonly engine: CoachingEngineService) {}

  async getSalesPlans(currentUser: CurrentUser): Promise<SalesPlanDto[]> {
    return this.engine.getSalesPlans(currentUser);
  }

  async createSalesPlan(
    input: CreateSalesPlanInput,
    currentUser: CurrentUser,
  ): Promise<SalesPlanDto> {
    return this.engine.createSalesPlan(input, currentUser);
  }

  async createSalesPlanVersion(
    input: CreateSalesPlanVersionInput,
    currentUser: CurrentUser,
  ): Promise<SalesPlanDto> {
    return this.engine.createSalesPlanVersion(input, currentUser);
  }

  async publishSalesPlanVersion(
    versionId: number,
    currentUser: CurrentUser,
  ): Promise<SalesPlanDto> {
    return this.engine.publishSalesPlanVersion(versionId, currentUser);
  }

  async getRecordingCandidates(
    input: CoachingRecordingCandidatesInput,
    currentUser: CurrentUser,
  ): Promise<CoachingRecordingCandidatesPageDto> {
    return this.engine.getRecordingCandidates(input, currentUser);
  }

  async getCoachingSessions(
    input: CoachingSessionsInput,
    currentUser: CurrentUser,
  ): Promise<CoachingSessionsPageDto> {
    return this.engine.getCoachingSessions(input, currentUser);
  }

  async getAnalysisQueue(
    input: CoachingAnalysisQueueInput,
    currentUser: CurrentUser,
  ): Promise<CoachingQueueStateDto> {
    return this.engine.getAnalysisQueue(input, currentUser);
  }

  async getCoachingSession(
    id: number,
    currentUser: CurrentUser,
  ): Promise<CoachingSessionDto> {
    return this.engine.getCoachingSession(id, currentUser);
  }

  async launchCoachingAnalysis(
    input: LaunchCoachingAnalysisInput,
    currentUser: CurrentUser,
  ): Promise<CoachingSessionDto> {
    return this.engine.launchCoachingAnalysis(input, currentUser);
  }

  async relaunchCoachingAnalysis(
    sessionId: number,
    currentUser: CurrentUser,
  ): Promise<CoachingSessionDto> {
    return this.engine.relaunchCoachingAnalysis(sessionId, currentUser);
  }

  async reviewCoachingSession(
    input: ReviewCoachingSessionInput,
    currentUser: CurrentUser,
  ): Promise<CoachingSessionDto> {
    return this.engine.reviewCoachingSession(input, currentUser);
  }

  async autoQueueLatestPublishedAnalysisForRecording(
    s3KeyOriginal: string,
  ): Promise<void> {
    return this.engine.autoQueueLatestPublishedAnalysisForRecording(
      s3KeyOriginal,
    );
  }

}
