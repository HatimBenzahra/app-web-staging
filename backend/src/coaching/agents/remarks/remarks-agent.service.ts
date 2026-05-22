import { Injectable } from '@nestjs/common';
import {
  normalizeText,
  normalizeTextArray,
} from '../../utils/evaluation-normalizers.utils';
import { RemarksValidator } from '../../validators/remarks.validator';
import { isRecord } from '../shared/coaching-agent-json.utils';
import { CoachingAgentLogger } from '../shared/coaching-agent-logger.service';
import { CoachingAgentRunner } from '../shared/coaching-agent-runner.service';
import {
  buildRemarksAgentUserPrompt,
  REMARKS_AGENT_PROMPT_VERSION,
  REMARKS_AGENT_SYSTEM_PROMPT,
} from './remarks-agent.prompt';
import { REMARKS_AGENT_JSON_SCHEMA } from './remarks-agent.schema';
import { RemarksAgentInput, RemarksAgentResult } from './remarks-agent.types';

@Injectable()
export class RemarksAgentService {
  constructor(
    private readonly runner: CoachingAgentRunner,
    private readonly logger: CoachingAgentLogger,
    private readonly validator: RemarksValidator,
  ) {}

  async run(input: RemarksAgentInput): Promise<RemarksAgentResult | null> {
    const context = {
      agent: 'remarks' as const,
      jobId: input.jobId,
      candidateWindowOrder: input.candidateWindowOrder,
      stage: 'generate_remarks',
    };
    const userPrompt = buildRemarksAgentUserPrompt({
      status: input.status,
      scores: {
        overallScore: input.scoring.overallScore,
        stepEvaluations: input.scoring.stepEvaluations,
        reviewRequired: input.scoring.reviewRequired,
        reviewReason: input.scoring.reviewReason,
      },
      evidence: {
        criteriaEvidence: input.evidence.criteriaEvidence,
        keyEvents: input.evidence.keyEvents,
        uncertainties: input.evidence.uncertainties,
      },
    });

    this.logger.request({
      ...context,
      promptVersion: REMARKS_AGENT_PROMPT_VERSION,
      inputChars: userPrompt.length,
    });

    const result = await this.runner.runJson(context, {
      systemPrompt: REMARKS_AGENT_SYSTEM_PROMPT,
      userPrompt,
      jsonSchema: REMARKS_AGENT_JSON_SCHEMA,
      maxTokens: 1600,
      temperature: 0.2,
      promptVersion: REMARKS_AGENT_PROMPT_VERSION,
    });

    if (!result) {
      return null;
    }

    const parsedRecord = isRecord(result.parsed) ? result.parsed : {};
    const remarks = {
      summary: normalizeText(parsedRecord.summary),
      strengths: normalizeTextArray(parsedRecord.strengths),
      improvements: normalizeTextArray(parsedRecord.improvements),
      recommendations: [
        ...normalizeTextArray(parsedRecord.recommendations),
        ...normalizeTextArray(parsedRecord.trainingActions),
      ].slice(0, 8),
    };
    const validation = this.validator.validate(remarks);

    this.logger.response({
      ...context,
      rawResponseChars: result.rawResponse.length,
      outputItems:
        remarks.strengths.length +
        remarks.improvements.length +
        remarks.recommendations.length,
    });
    this.logger.validator({
      ...context,
      valid: validation.valid,
      reasons: validation.reasons,
    });
    this.logger.persisted({
      ...context,
      valid: validation.valid,
      reasons: [
        `strengths=${remarks.strengths.length}`,
        `improvements=${remarks.improvements.length}`,
        `recommendations=${remarks.recommendations.length}`,
      ],
    });

    return remarks;
  }
}
