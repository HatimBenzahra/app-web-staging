import { Injectable } from '@nestjs/common';
import type { RemarksAgentResult } from '../agents/remarks/remarks-agent.types';

@Injectable()
export class RemarksValidator {
  validate(result: RemarksAgentResult): { valid: boolean; reasons: string[] } {
    const reasons: string[] = [];
    if (
      result.strengths.length === 0 &&
      result.improvements.length === 0 &&
      result.recommendations.length === 0
    ) {
      reasons.push('empty_remarks');
    }
    return { valid: reasons.length === 0, reasons };
  }
}
