-- CreateEnum
CREATE TYPE "CoachingCriterionQuality" AS ENUM ('MISSING', 'WEAK', 'PARTIAL', 'COMPLETE');

-- CreateEnum
CREATE TYPE "CoachingEvidenceReviewStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'VALIDATED', 'CORRECTED', 'REJECTED');

-- AlterTable
ALTER TABLE "CoachingSession"
ADD COLUMN "scoringMode" TEXT,
ADD COLUMN "scoringSchemaVersion" TEXT,
ADD COLUMN "evidencePromptVersion" TEXT,
ADD COLUMN "evaluationPromptVersion" TEXT;

-- AlterTable
ALTER TABLE "CoachingConversationEvaluation"
ADD COLUMN "scoringMode" TEXT,
ADD COLUMN "scoringSchemaVersion" TEXT,
ADD COLUMN "evidencePromptVersion" TEXT,
ADD COLUMN "evaluationPromptVersion" TEXT;

-- CreateTable
CREATE TABLE "SalesPlanCriterion" (
    "id" SERIAL NOT NULL,
    "salesPlanStepId" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "weight" INTEGER NOT NULL DEFAULT 10,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "applicableStatuses" TEXT[],
    "expectedEvidence" TEXT,
    "negativeSignals" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesPlanCriterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoringSchemaVersion" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "rulesJson" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScoringSchemaVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachingCriterionEvidence" (
    "id" SERIAL NOT NULL,
    "coachingConversationEvaluationId" INTEGER NOT NULL,
    "salesPlanStepId" INTEGER,
    "salesPlanCriterionId" INTEGER,
    "stepOrder" INTEGER NOT NULL,
    "criterionKey" TEXT NOT NULL,
    "criterionLabel" TEXT NOT NULL,
    "found" BOOLEAN NOT NULL DEFAULT false,
    "quality" "CoachingCriterionQuality" NOT NULL DEFAULT 'MISSING',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "verbatim" TEXT,
    "startTime" DOUBLE PRECISION,
    "endTime" DOUBLE PRECISION,
    "reason" TEXT,
    "reviewStatus" "CoachingEvidenceReviewStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachingCriterionEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SalesPlanCriterion_salesPlanStepId_key_key" ON "SalesPlanCriterion"("salesPlanStepId", "key");

-- CreateIndex
CREATE INDEX "SalesPlanCriterion_salesPlanStepId_idx" ON "SalesPlanCriterion"("salesPlanStepId");

-- CreateIndex
CREATE INDEX "SalesPlanCriterion_key_idx" ON "SalesPlanCriterion"("key");

-- CreateIndex
CREATE INDEX "SalesPlanCriterion_order_idx" ON "SalesPlanCriterion"("order");

-- CreateIndex
CREATE UNIQUE INDEX "ScoringSchemaVersion_name_version_key" ON "ScoringSchemaVersion"("name", "version");

-- CreateIndex
CREATE INDEX "ScoringSchemaVersion_isActive_idx" ON "ScoringSchemaVersion"("isActive");

-- CreateIndex
CREATE INDEX "CoachingCriterionEvidence_coachingConversationEvaluationId_idx" ON "CoachingCriterionEvidence"("coachingConversationEvaluationId");

-- CreateIndex
CREATE INDEX "CoachingCriterionEvidence_salesPlanStepId_idx" ON "CoachingCriterionEvidence"("salesPlanStepId");

-- CreateIndex
CREATE INDEX "CoachingCriterionEvidence_salesPlanCriterionId_idx" ON "CoachingCriterionEvidence"("salesPlanCriterionId");

-- CreateIndex
CREATE INDEX "CoachingCriterionEvidence_criterionKey_idx" ON "CoachingCriterionEvidence"("criterionKey");

-- CreateIndex
CREATE INDEX "CoachingCriterionEvidence_quality_idx" ON "CoachingCriterionEvidence"("quality");

-- CreateIndex
CREATE INDEX "CoachingCriterionEvidence_found_idx" ON "CoachingCriterionEvidence"("found");

-- CreateIndex
CREATE INDEX "CoachingCriterionEvidence_reviewStatus_idx" ON "CoachingCriterionEvidence"("reviewStatus");

-- AddForeignKey
ALTER TABLE "SalesPlanCriterion" ADD CONSTRAINT "SalesPlanCriterion_salesPlanStepId_fkey" FOREIGN KEY ("salesPlanStepId") REFERENCES "SalesPlanStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachingCriterionEvidence" ADD CONSTRAINT "CoachingCriterionEvidence_coachingConversationEvaluationId_fkey" FOREIGN KEY ("coachingConversationEvaluationId") REFERENCES "CoachingConversationEvaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachingCriterionEvidence" ADD CONSTRAINT "CoachingCriterionEvidence_salesPlanStepId_fkey" FOREIGN KEY ("salesPlanStepId") REFERENCES "SalesPlanStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachingCriterionEvidence" ADD CONSTRAINT "CoachingCriterionEvidence_salesPlanCriterionId_fkey" FOREIGN KEY ("salesPlanCriterionId") REFERENCES "SalesPlanCriterion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
