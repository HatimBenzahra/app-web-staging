-- CreateEnum
CREATE TYPE "CoachingAnalysisJobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "CoachingAnalysisJob" (
    "id" SERIAL NOT NULL,
    "coachingSessionId" INTEGER NOT NULL,
    "status" "CoachingAnalysisJobStatus" NOT NULL DEFAULT 'QUEUED',
    "priority" INTEGER NOT NULL DEFAULT 50,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 2,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "lastHeartbeatAt" TIMESTAMP(3),
    "currentStep" TEXT,
    "failureReason" TEXT,
    "createdByRole" TEXT NOT NULL,
    "createdByUserId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoachingAnalysisJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CoachingAnalysisJob_coachingSessionId_key" ON "CoachingAnalysisJob"("coachingSessionId");

-- CreateIndex
CREATE INDEX "CoachingAnalysisJob_status_priority_queuedAt_idx" ON "CoachingAnalysisJob"("status", "priority", "queuedAt");

-- CreateIndex
CREATE INDEX "CoachingAnalysisJob_coachingSessionId_idx" ON "CoachingAnalysisJob"("coachingSessionId");

-- CreateIndex
CREATE INDEX "CoachingAnalysisJob_nextRunAt_idx" ON "CoachingAnalysisJob"("nextRunAt");

-- AddForeignKey
ALTER TABLE "CoachingAnalysisJob" ADD CONSTRAINT "CoachingAnalysisJob_coachingSessionId_fkey" FOREIGN KEY ("coachingSessionId") REFERENCES "CoachingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
