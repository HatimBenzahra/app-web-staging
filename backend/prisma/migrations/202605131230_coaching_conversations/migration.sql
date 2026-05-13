-- CreateEnum
CREATE TYPE "CoachingConversationStatus" AS ENUM ('COMPLETED', 'NEEDS_REVIEW', 'SKIPPED', 'FAILED');

-- CreateTable
CREATE TABLE "CoachingConversationEvaluation" (
    "id" SERIAL NOT NULL,
    "coachingSessionId" INTEGER NOT NULL,
    "ordre" INTEGER NOT NULL,
    "title" TEXT,
    "startTime" DOUBLE PRECISION,
    "endTime" DOUBLE PRECISION,
    "transcriptText" TEXT,
    "status" "CoachingConversationStatus" NOT NULL DEFAULT 'COMPLETED',
    "reviewReason" TEXT,
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
    "llmRawResponse" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachingConversationEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoachingConversationEvaluation_coachingSessionId_idx" ON "CoachingConversationEvaluation"("coachingSessionId");

-- CreateIndex
CREATE INDEX "CoachingConversationEvaluation_status_idx" ON "CoachingConversationEvaluation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CoachingConversationEvaluation_coachingSessionId_ordre_key" ON "CoachingConversationEvaluation"("coachingSessionId", "ordre");

-- AddForeignKey
ALTER TABLE "CoachingConversationEvaluation" ADD CONSTRAINT "CoachingConversationEvaluation_coachingSessionId_fkey" FOREIGN KEY ("coachingSessionId") REFERENCES "CoachingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
