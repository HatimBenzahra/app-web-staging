import { Injectable, Logger } from '@nestjs/common';
import {
  CoachingAgentRequestLog,
  CoachingAgentResponseLog,
  CoachingAgentValidationLog,
} from './coaching-agent.types';

@Injectable()
export class CoachingAgentLogger {
  private readonly logger = new Logger(CoachingAgentLogger.name);

  request(log: CoachingAgentRequestLog): void {
    this.logger.log(
      [
        `agent.${log.agent}.request`,
        `jobId=${log.jobId ?? 'null'}`,
        `candidateWindowOrder=${log.candidateWindowOrder ?? 'null'}`,
        `stage=${log.stage}`,
        `promptVersion=${log.promptVersion}`,
        `inputChars=${log.inputChars ?? 'n/a'}`,
        `inputBlocks=${log.inputBlocks ?? 'n/a'}`,
      ].join(' '),
    );
  }

  response(log: CoachingAgentResponseLog): void {
    this.logger.log(
      [
        `agent.${log.agent}.response`,
        `jobId=${log.jobId ?? 'null'}`,
        `candidateWindowOrder=${log.candidateWindowOrder ?? 'null'}`,
        `stage=${log.stage}`,
        `rawResponseChars=${log.rawResponseChars ?? 'n/a'}`,
        `outputItems=${log.outputItems ?? 'n/a'}`,
      ].join(' '),
    );
  }

  validator(log: CoachingAgentValidationLog): void {
    this.logger.log(
      [
        `agent.${log.agent}.validator`,
        `jobId=${log.jobId ?? 'null'}`,
        `candidateWindowOrder=${log.candidateWindowOrder ?? 'null'}`,
        `stage=${log.stage}`,
        `valid=${log.valid}`,
        `reasons="${log.reasons.join(';')}"`,
      ].join(' '),
    );
  }

  persisted(log: CoachingAgentValidationLog): void {
    this.logger.log(
      [
        `agent.${log.agent}.persisted`,
        `jobId=${log.jobId ?? 'null'}`,
        `candidateWindowOrder=${log.candidateWindowOrder ?? 'null'}`,
        `stage=${log.stage}`,
        `valid=${log.valid}`,
        `reasons="${log.reasons.join(';')}"`,
      ].join(' '),
    );
  }
}
