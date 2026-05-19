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
    const title = step.titre.toLowerCase();
    const defaults = this.defaultCriteriaForTitle(title);
    const criteria = defaults.length > 0 ? defaults : this.criteriaFromSignals(step);

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

  private defaultCriteriaForTitle(
    title: string,
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
    if (title.includes('ouverture') || title.includes('cadrage')) {
      return [
        this.criterion('salutation', 'Salue clairement le prospect', 15, true),
        this.criterion('presentation', 'Se présente ou présente la société', 20, true),
        this.criterion('motif', 'Explique le motif du passage', 25, true),
        this.criterion('disponibilite', 'Demande si la personne est disponible', 20, false),
        this.criterion('duree_courte', 'Annonce un échange court', 20, false),
      ];
    }
    if (title.includes('découverte') || title.includes('decouverte')) {
      return [
        this.criterion('question_contexte', 'Pose une question sur la situation actuelle', 25, true),
        this.criterion('besoin', 'Identifie un besoin ou irritant', 25, true),
        this.criterion('ecoute', 'Laisse le prospect répondre', 20, true),
        this.criterion('reformulation', 'Reformule la situation du prospect', 15, false),
        this.criterion('qualification', 'Qualifie le potentiel commercial', 15, false),
      ];
    }
    if (title.includes('valeur') || title.includes('proposition')) {
      return [
        this.criterion('benefice', 'Présente un bénéfice concret', 35, true),
        this.criterion('lien_besoin', 'Relie l’offre au besoin détecté', 30, true),
        this.criterion('clarte', 'Explique simplement la proposition', 20, true),
        this.criterion('preuve', 'Apporte une preuve ou comparaison', 15, false),
      ];
    }
    if (title.includes('objection')) {
      return [
        this.criterion('objection_identifiee', 'Identifie l’objection', 20, true, ['REFUS']),
        this.criterion('reformulation_objection', 'Reformule ou accuse réception', 20, true, ['REFUS']),
        this.criterion('reponse_adaptee', 'Répond avec un argument adapté', 35, true, ['REFUS']),
        this.criterion('alternative', 'Propose une alternative ou prochaine étape', 15, false, ['REFUS']),
        this.criterion('ton', 'Garde un ton professionnel', 10, true),
      ];
    }
    if (title.includes('closing') || title.includes('prochaine')) {
      return [
        this.criterion('prochaine_etape', 'Propose une prochaine étape claire', 35, true, ['RDV_PRIS', 'CONTRAT_SIGNE', 'REFUS']),
        this.criterion('confirmation', 'Confirme l’accord ou la décision', 25, true, ['RDV_PRIS', 'CONTRAT_SIGNE']),
        this.criterion('recapitulatif', 'Récapitule les éléments importants', 20, false, ['RDV_PRIS', 'CONTRAT_SIGNE']),
        this.criterion('cloture_polie', 'Clôture poliment', 20, true),
      ];
    }
    return [];
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
