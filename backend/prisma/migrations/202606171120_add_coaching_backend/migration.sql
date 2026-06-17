-- CreateEnum
DO $$
BEGIN
    CREATE TYPE "CoachingSessionStatus" AS ENUM ('PENDING', 'ANALYZING', 'READY', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE "CoachingSalesPlan" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachingSalesPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachingSalesPlanVersion" (
    "id" SERIAL NOT NULL,
    "salesPlanId" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "criteria" JSONB NOT NULL,
    "prompt" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachingSalesPlanVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachingSession" (
    "id" SERIAL NOT NULL,
    "recordingId" INTEGER,
    "s3KeyOriginal" TEXT NOT NULL,
    "salesPlanVersionId" INTEGER NOT NULL,
    "status" "CoachingSessionStatus" NOT NULL DEFAULT 'PENDING',
    "score" INTEGER,
    "summary" TEXT,
    "strengths" JSONB,
    "improvements" JSONB,
    "recommendations" JSONB,
    "error" TEXT,
    "analyzedAt" TIMESTAMP(3),
    "launchedById" INTEGER,
    "launchedByRole" TEXT,
    "commercialId" INTEGER,
    "managerId" INTEGER,
    "directeurId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachingConversationEvaluation" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "segmentId" INTEGER,
    "orderIndex" INTEGER NOT NULL,
    "title" TEXT,
    "status" "CoachingSessionStatus" NOT NULL DEFAULT 'READY',
    "score" INTEGER,
    "summary" TEXT,
    "strengths" JSONB,
    "improvements" JSONB,
    "recommendations" JSONB,
    "transcriptText" TEXT,
    "readableTranscriptText" TEXT,
    "startTime" DOUBLE PRECISION,
    "endTime" DOUBLE PRECISION,
    "durationSec" DOUBLE PRECISION,
    "statut" "StatutPorte",
    "porteId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachingConversationEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoachingSalesPlan_isDefault_idx" ON "CoachingSalesPlan"("isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "CoachingSalesPlanVersion_salesPlanId_version_key" ON "CoachingSalesPlanVersion"("salesPlanId", "version");

-- CreateIndex
CREATE INDEX "CoachingSalesPlanVersion_salesPlanId_isActive_idx" ON "CoachingSalesPlanVersion"("salesPlanId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "CoachingSession_s3KeyOriginal_salesPlanVersionId_key" ON "CoachingSession"("s3KeyOriginal", "salesPlanVersionId");

-- CreateIndex
CREATE INDEX "CoachingSession_recordingId_idx" ON "CoachingSession"("recordingId");

-- CreateIndex
CREATE INDEX "CoachingSession_salesPlanVersionId_idx" ON "CoachingSession"("salesPlanVersionId");

-- CreateIndex
CREATE INDEX "CoachingSession_status_idx" ON "CoachingSession"("status");

-- CreateIndex
CREATE INDEX "CoachingSession_commercialId_idx" ON "CoachingSession"("commercialId");

-- CreateIndex
CREATE INDEX "CoachingSession_managerId_idx" ON "CoachingSession"("managerId");

-- CreateIndex
CREATE INDEX "CoachingSession_directeurId_idx" ON "CoachingSession"("directeurId");

-- CreateIndex
CREATE INDEX "CoachingSession_createdAt_idx" ON "CoachingSession"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CoachingConversationEvaluation_sessionId_orderIndex_key" ON "CoachingConversationEvaluation"("sessionId", "orderIndex");

-- CreateIndex
CREATE INDEX "CoachingConversationEvaluation_sessionId_idx" ON "CoachingConversationEvaluation"("sessionId");

-- CreateIndex
CREATE INDEX "CoachingConversationEvaluation_segmentId_idx" ON "CoachingConversationEvaluation"("segmentId");

-- CreateIndex
CREATE INDEX "CoachingConversationEvaluation_porteId_idx" ON "CoachingConversationEvaluation"("porteId");

-- CreateIndex
CREATE INDEX "CoachingConversationEvaluation_status_idx" ON "CoachingConversationEvaluation"("status");

-- AddForeignKey
ALTER TABLE "CoachingSalesPlanVersion" ADD CONSTRAINT "CoachingSalesPlanVersion_salesPlanId_fkey" FOREIGN KEY ("salesPlanId") REFERENCES "CoachingSalesPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachingSession" ADD CONSTRAINT "CoachingSession_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "Recording"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachingSession" ADD CONSTRAINT "CoachingSession_salesPlanVersionId_fkey" FOREIGN KEY ("salesPlanVersionId") REFERENCES "CoachingSalesPlanVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachingSession" ADD CONSTRAINT "CoachingSession_commercialId_fkey" FOREIGN KEY ("commercialId") REFERENCES "Commercial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachingSession" ADD CONSTRAINT "CoachingSession_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Manager"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachingSession" ADD CONSTRAINT "CoachingSession_directeurId_fkey" FOREIGN KEY ("directeurId") REFERENCES "Directeur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachingConversationEvaluation" ADD CONSTRAINT "CoachingConversationEvaluation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CoachingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachingConversationEvaluation" ADD CONSTRAINT "CoachingConversationEvaluation_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "RecordingSegment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachingConversationEvaluation" ADD CONSTRAINT "CoachingConversationEvaluation_porteId_fkey" FOREIGN KEY ("porteId") REFERENCES "Porte"("id") ON DELETE SET NULL ON UPDATE CASCADE;
