import { Injectable } from '@nestjs/common';
import type { SalesPlanCriterion } from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { SalesPlanCriterionDefinition } from './coaching-scoring.types';

type SalesPlanStepLike = {
  id?: number;
  ordre: number;
  titre: string;
  description: string | null;
  expectedSignals: string | null;
  poids: number;
};

@Injectable()
export class SalesPlanCriterionService {
  constructor(private readonly prisma: PrismaService) {}

  async getCriteriaForSteps(
    steps: SalesPlanStepLike[],
    status?: string | null,
  ): Promise<SalesPlanCriterionDefinition[]> {
    const stepIds = steps
      .map((step) => step.id)
      .filter((id): id is number => Number.isInteger(id));
    const explicitCriteria =
      stepIds.length > 0
        ? await this.prisma.salesPlanCriterion.findMany({
            where: { salesPlanStepId: { in: stepIds } },
            orderBy: [{ salesPlanStepId: 'asc' }, { order: 'asc' }],
          })
        : [];

    if (explicitCriteria.length > 0) {
      const stepById = new Map(steps.map((step) => [step.id, step]));
      return explicitCriteria
        .map((criterion: SalesPlanCriterion): SalesPlanCriterionDefinition | null => {
          const step = stepById.get(criterion.salesPlanStepId);
          if (!step) return null;
          return {
            id: criterion.id,
            salesPlanStepId: criterion.salesPlanStepId,
            stepOrder: step.ordre,
            stepTitle: step.titre,
            key: criterion.key,
            label: criterion.label,
            description: criterion.description,
            weight: this.normalizeWeight(criterion.weight),
            required: Boolean(criterion.required),
            applicableStatuses: criterion.applicableStatuses ?? [],
            expectedEvidence: criterion.expectedEvidence,
            negativeSignals: criterion.negativeSignals,
            order: criterion.order ?? 0,
          };
        })
        .filter(
          (criterion): criterion is SalesPlanCriterionDefinition =>
            Boolean(criterion) && this.appliesToStatus(criterion!, status),
        );
    }

    return steps.flatMap((step) => this.buildFallbackCriteria(step, status));
  }

  private buildFallbackCriteria(
    step: SalesPlanStepLike,
    status?: string | null,
  ): SalesPlanCriterionDefinition[] {
    const criteria = this.criteriaFromSignals(step);

    return criteria.map((criterion, index) => ({
      salesPlanStepId: step.id ?? null,
      stepOrder: step.ordre,
      stepTitle: step.titre,
      key: criterion.key,
      label: criterion.label,
      description: criterion.description ?? step.description,
      weight: criterion.weight,
      required: criterion.required,
      applicableStatuses: criterion.applicableStatuses,
      expectedEvidence: criterion.expectedEvidence ?? step.expectedSignals,
      negativeSignals: criterion.negativeSignals ?? null,
      order: index + 1,
    })).filter((criterion) => this.appliesToStatus(criterion, status));
  }

  private criteriaFromSignals(
    step: SalesPlanStepLike,
  ): Array<{
    key: string;
    label: string;
    description?: string;
    weight: number;
    required: boolean;
    applicableStatuses: string[];
    expectedEvidence?: string;
    negativeSignals?: string;
  }> {
    const signals = (step.expectedSignals ?? '')
      .split(/\n|;|,/)
      .map((signal) => signal.trim())
      .filter(Boolean)
      .slice(0, 6);
    if (signals.length === 0) {
      return [
        this.criterion(
          `step_${step.ordre}_evidence`,
          `Preuve observable: ${step.titre}`,
          100,
          true,
          [],
          step.expectedSignals ?? step.description ?? undefined,
        ),
      ];
    }
    const weight = Math.max(1, Math.floor(100 / signals.length));
    return signals.map((signal, index) =>
      this.criterion(
        `signal_${step.ordre}_${index + 1}`,
        signal,
        weight,
        index === 0,
        [],
        signal,
      ),
    );
  }

  private criterion(
    key: string,
    label: string,
    weight: number,
    required: boolean,
    applicableStatuses: string[] = [],
    expectedEvidence?: string,
    negativeSignals?: string,
  ) {
    return {
      key,
      label,
      weight,
      required,
      applicableStatuses,
      expectedEvidence,
      negativeSignals,
    };
  }

  private appliesToStatus(
    criterion: SalesPlanCriterionDefinition,
    status?: string | null,
  ): boolean {
    if (!criterion.applicableStatuses?.length || !status) {
      return true;
    }
    return criterion.applicableStatuses.includes(status);
  }

  private normalizeWeight(weight: unknown): number {
    const numeric = Number(weight);
    return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : 10;
  }
}
