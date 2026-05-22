import { Injectable } from '@nestjs/common';
import type { SalesPlanApplicationPayload } from '../scoring/coaching-scoring.types';

@Injectable()
export class SalesPlanValidator {
  validate(application: SalesPlanApplicationPayload): {
    valid: boolean;
    reasons: string[];
  } {
    const reasons: string[] = [];
    if (application.steps.length === 0) {
      reasons.push('no_steps');
    }
    const evidenceCount = application.steps.reduce(
      (sum, step) => sum + step.evidence.length,
      0,
    );
    if (evidenceCount === 0) {
      reasons.push('no_evidence');
    }
    return { valid: reasons.length === 0, reasons };
  }
}
