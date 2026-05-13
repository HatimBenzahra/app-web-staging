-- CreateEnum
CREATE TYPE "SalesPlanStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SalesPlanVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CoachingSessionStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "CoachingReviewStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'VALIDATED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CoachingStepCoverageStatus" AS ENUM ('COVERED', 'PARTIAL', 'MISSING');

-- CreateTable
CREATE TABLE "SalesPlan" (
    "id" SERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "status" "SalesPlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "directeurId" INTEGER,
    "createdByRole" TEXT NOT NULL,
    "createdByUserId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesPlanVersion" (
    "id" SERIAL NOT NULL,
    "salesPlanId" INTEGER NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "label" TEXT,
    "status" "SalesPlanVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "promptInstructions" TEXT,
    "createdByRole" TEXT NOT NULL,
    "createdByUserId" INTEGER NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesPlanVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesPlanStep" (
    "id" SERIAL NOT NULL,
    "salesPlanVersionId" INTEGER NOT NULL,
    "ordre" INTEGER NOT NULL,
    "titre" TEXT NOT NULL,
    "description" TEXT,
    "expectedSignals" TEXT,
    "poids" INTEGER NOT NULL DEFAULT 20,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesPlanStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachingSession" (
    "id" SERIAL NOT NULL,
    "salesPlanVersionId" INTEGER NOT NULL,
    "s3KeyOriginal" TEXT NOT NULL,
    "roomName" TEXT,
    "commercialId" INTEGER,
    "directeurId" INTEGER,
    "status" "CoachingSessionStatus" NOT NULL DEFAULT 'PENDING',
    "reviewStatus" "CoachingReviewStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "confidenceScore" DOUBLE PRECISION,
    "identificationSource" TEXT,
    "transcriptText" TEXT,
    "transcriptDurationSec" DOUBLE PRECISION,
    "whisperSegmentsCount" INTEGER,
    "overallScore" INTEGER,
    "planCoverageScore" INTEGER,
    "executionQualityScore" INTEGER,
    "objectionHandlingScore" INTEGER,
    "listeningRatioScore" INTEGER,
    "closingScore" INTEGER,
    "summary" TEXT,
    "strengths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "improvements" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "recommendations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "llmModel" TEXT,
    "llmRawResponse" TEXT,
    "failureReason" TEXT,
    "reviewReason" TEXT,
    "reviewNotes" TEXT,
    "createdByRole" TEXT NOT NULL,
    "createdByUserId" INTEGER NOT NULL,
    "launchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachingStepEvaluation" (
    "id" SERIAL NOT NULL,
    "coachingSessionId" INTEGER NOT NULL,
    "salesPlanStepId" INTEGER,
    "ordre" INTEGER NOT NULL,
    "titre" TEXT NOT NULL,
    "coverageStatus" "CoachingStepCoverageStatus" NOT NULL,
    "score" INTEGER,
    "verbatim" TEXT,
    "feedback" TEXT,
    "recommendation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachingStepEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalesPlan_directeurId_idx" ON "SalesPlan"("directeurId");

-- CreateIndex
CREATE INDEX "SalesPlan_status_idx" ON "SalesPlan"("status");

-- CreateIndex
CREATE INDEX "SalesPlanVersion_salesPlanId_idx" ON "SalesPlanVersion"("salesPlanId");

-- CreateIndex
CREATE INDEX "SalesPlanVersion_status_idx" ON "SalesPlanVersion"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SalesPlanVersion_salesPlanId_versionNumber_key" ON "SalesPlanVersion"("salesPlanId", "versionNumber");

-- CreateIndex
CREATE INDEX "SalesPlanStep_salesPlanVersionId_idx" ON "SalesPlanStep"("salesPlanVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesPlanStep_salesPlanVersionId_ordre_key" ON "SalesPlanStep"("salesPlanVersionId", "ordre");

-- CreateIndex
CREATE INDEX "CoachingSession_salesPlanVersionId_idx" ON "CoachingSession"("salesPlanVersionId");

-- CreateIndex
CREATE INDEX "CoachingSession_commercialId_idx" ON "CoachingSession"("commercialId");

-- CreateIndex
CREATE INDEX "CoachingSession_directeurId_idx" ON "CoachingSession"("directeurId");

-- CreateIndex
CREATE INDEX "CoachingSession_status_idx" ON "CoachingSession"("status");

-- CreateIndex
CREATE INDEX "CoachingSession_reviewStatus_idx" ON "CoachingSession"("reviewStatus");

-- CreateIndex
CREATE INDEX "CoachingSession_s3KeyOriginal_idx" ON "CoachingSession"("s3KeyOriginal");

-- CreateIndex
CREATE INDEX "CoachingStepEvaluation_coachingSessionId_idx" ON "CoachingStepEvaluation"("coachingSessionId");

-- CreateIndex
CREATE INDEX "CoachingStepEvaluation_salesPlanStepId_idx" ON "CoachingStepEvaluation"("salesPlanStepId");

-- AddForeignKey
ALTER TABLE "SalesPlan" ADD CONSTRAINT "SalesPlan_directeurId_fkey" FOREIGN KEY ("directeurId") REFERENCES "Directeur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesPlanVersion" ADD CONSTRAINT "SalesPlanVersion_salesPlanId_fkey" FOREIGN KEY ("salesPlanId") REFERENCES "SalesPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesPlanStep" ADD CONSTRAINT "SalesPlanStep_salesPlanVersionId_fkey" FOREIGN KEY ("salesPlanVersionId") REFERENCES "SalesPlanVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachingSession" ADD CONSTRAINT "CoachingSession_salesPlanVersionId_fkey" FOREIGN KEY ("salesPlanVersionId") REFERENCES "SalesPlanVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachingSession" ADD CONSTRAINT "CoachingSession_commercialId_fkey" FOREIGN KEY ("commercialId") REFERENCES "Commercial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachingSession" ADD CONSTRAINT "CoachingSession_directeurId_fkey" FOREIGN KEY ("directeurId") REFERENCES "Directeur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachingStepEvaluation" ADD CONSTRAINT "CoachingStepEvaluation_coachingSessionId_fkey" FOREIGN KEY ("coachingSessionId") REFERENCES "CoachingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachingStepEvaluation" ADD CONSTRAINT "CoachingStepEvaluation_salesPlanStepId_fkey" FOREIGN KEY ("salesPlanStepId") REFERENCES "SalesPlanStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;
