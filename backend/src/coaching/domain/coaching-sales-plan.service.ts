import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import {
  CreateSalesPlanInput,
  CreateSalesPlanVersionInput,
  SalesPlanDto,
} from '../coaching.dto';
import type { CurrentUser } from '../types/coaching-pipeline.types';
import {
  assertAdminOrDirecteur,
  assertSharedPlanAccess,
  cleanOptionalText,
  normalizeSteps,
} from '../utils/coaching-common.utils';

/**
 * CRUD pour les plans de vente : SalesPlan + SalesPlanVersion + steps.
 */
@Injectable()
export class CoachingSalesPlanService {
  constructor(private readonly prisma: PrismaService) {}

  async getSalesPlans(currentUser: CurrentUser): Promise<SalesPlanDto[]> {
    assertAdminOrDirecteur(currentUser);

    const plans = await this.prisma.salesPlan.findMany({
      where: {},
      include: {
        versions: {
          include: {
            steps: { orderBy: { ordre: 'asc' } },
          },
          orderBy: { versionNumber: 'desc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return plans as SalesPlanDto[];
  }

  async createSalesPlan(
    input: CreateSalesPlanInput,
    currentUser: CurrentUser,
  ): Promise<SalesPlanDto> {
    assertAdminOrDirecteur(currentUser);

    const steps = normalizeSteps(input.steps);
    const publishNow = Boolean(input.publishNow);

    const plan = await this.prisma.salesPlan.create({
      data: {
        nom: input.nom.trim(),
        description: cleanOptionalText(input.description),
        createdByRole: currentUser.role,
        createdByUserId: currentUser.id,
        versions: {
          create: {
            versionNumber: 1,
            label: cleanOptionalText(input.versionLabel) || 'Version 1',
            status: publishNow ? 'PUBLISHED' : 'DRAFT',
            promptInstructions: cleanOptionalText(input.promptInstructions),
            createdByRole: currentUser.role,
            createdByUserId: currentUser.id,
            publishedAt: publishNow ? new Date() : null,
            steps: {
              create: steps.map((step) => ({
                ordre: step.ordre,
                titre: step.titre,
                description: step.description,
                expectedSignals: step.expectedSignals,
                poids: step.poids,
              })),
            },
          },
        },
      },
      include: {
        versions: {
          include: {
            steps: { orderBy: { ordre: 'asc' } },
          },
          orderBy: { versionNumber: 'desc' },
        },
      },
    });

    return plan as SalesPlanDto;
  }

  async createSalesPlanVersion(
    input: CreateSalesPlanVersionInput,
    currentUser: CurrentUser,
  ): Promise<SalesPlanDto> {
    assertAdminOrDirecteur(currentUser);

    const plan = await this.prisma.salesPlan.findUnique({
      where: { id: input.salesPlanId },
      include: {
        versions: { orderBy: { versionNumber: 'desc' }, take: 1 },
      },
    });

    if (!plan) {
      throw new NotFoundException('Plan de vente introuvable');
    }

    assertSharedPlanAccess(currentUser);

    const nextVersion = (plan.versions[0]?.versionNumber || 0) + 1;
    const steps = normalizeSteps(input.steps);
    const publishNow = Boolean(input.publishNow);

    await this.prisma.$transaction(async (tx) => {
      if (publishNow) {
        await tx.salesPlanVersion.updateMany({
          where: { salesPlanId: plan.id, status: 'PUBLISHED' },
          data: { status: 'ARCHIVED' },
        });
      }

      await tx.salesPlanVersion.create({
        data: {
          salesPlanId: plan.id,
          versionNumber: nextVersion,
          label: cleanOptionalText(input.label) || `Version ${nextVersion}`,
          status: publishNow ? 'PUBLISHED' : 'DRAFT',
          promptInstructions: cleanOptionalText(input.promptInstructions),
          createdByRole: currentUser.role,
          createdByUserId: currentUser.id,
          publishedAt: publishNow ? new Date() : null,
          steps: {
            create: steps.map((step) => ({
              ordre: step.ordre,
              titre: step.titre,
              description: step.description,
              expectedSignals: step.expectedSignals,
              poids: step.poids,
            })),
          },
        },
      });
    });

    const refreshed = await this.prisma.salesPlan.findUnique({
      where: { id: plan.id },
      include: {
        versions: {
          include: { steps: { orderBy: { ordre: 'asc' } } },
          orderBy: { versionNumber: 'desc' },
        },
      },
    });

    return refreshed as SalesPlanDto;
  }

  async publishSalesPlanVersion(
    versionId: number,
    currentUser: CurrentUser,
  ): Promise<SalesPlanDto> {
    assertAdminOrDirecteur(currentUser);

    const version = await this.prisma.salesPlanVersion.findUnique({
      where: { id: versionId },
      include: { salesPlan: true },
    });

    if (!version) {
      throw new NotFoundException('Version de plan introuvable');
    }

    assertSharedPlanAccess(currentUser);

    await this.prisma.$transaction(async (tx) => {
      await tx.salesPlanVersion.updateMany({
        where: { salesPlanId: version.salesPlanId, status: 'PUBLISHED' },
        data: { status: 'ARCHIVED' },
      });

      await tx.salesPlanVersion.update({
        where: { id: versionId },
        data: { status: 'PUBLISHED', publishedAt: new Date() },
      });
    });

    const plan = await this.prisma.salesPlan.findUnique({
      where: { id: version.salesPlanId },
      include: {
        versions: {
          include: { steps: { orderBy: { ordre: 'asc' } } },
          orderBy: { versionNumber: 'desc' },
        },
      },
    });

    return plan as SalesPlanDto;
  }
}
