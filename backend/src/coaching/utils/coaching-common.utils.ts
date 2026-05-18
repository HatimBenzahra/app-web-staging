/**
 * Validation and normalization helpers shared across coaching services.
 * Pure functions, no DI.
 */

import { ForbiddenException } from '@nestjs/common';
import type { CurrentUser } from '../types/coaching-pipeline.types';
import type { CreateSalesPlanInput } from '../coaching.dto';

export function cleanOptionalText(value?: string | null): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function assertAdminOrDirecteur(currentUser: CurrentUser): void {
  if (currentUser.role !== 'admin' && currentUser.role !== 'directeur') {
    throw new ForbiddenException('Accès réservé admin/directeur');
  }
}

export function assertSharedPlanAccess(currentUser: CurrentUser): void {
  assertAdminOrDirecteur(currentUser);
}

export function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002',
  );
}

export function normalizeWeight(value?: number | null): number {
  const numeric = Number(value ?? 20);
  if (!Number.isFinite(numeric)) {
    return 20;
  }
  return Math.max(1, Math.min(100, Math.round(numeric)));
}

export function normalizeSteps(steps: CreateSalesPlanInput['steps']) {
  const normalized = steps
    .map((step, index) => ({
      ordre: step.ordre ?? index + 1,
      titre: step.titre.trim(),
      description: cleanOptionalText(step.description),
      expectedSignals: cleanOptionalText(step.expectedSignals),
      poids: normalizeWeight(step.poids),
    }))
    .filter((step) => step.titre.length > 0);

  if (normalized.length === 0) {
    throw new ForbiddenException(
      'Le plan de vente doit contenir au moins une étape nommée',
    );
  }

  return normalized.map((step, index) => ({
    ...step,
    ordre: index + 1,
  }));
}
