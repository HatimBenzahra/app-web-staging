-- CreateEnum
CREATE TYPE "RecordingConversationSegmentType" AS ENUM ('PROSPECT', 'INTERNAL', 'NOISE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "RecordingConversationSegmentSource" AS ENUM ('MOBILE_DOOR', 'AUDIO_TRANSCRIPT', 'LLM_VALIDATION', 'FALLBACK');

-- CreateEnum
CREATE TYPE "RecordingConversationReviewStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'VALIDATED', 'CORRECTED', 'REJECTED');

-- CreateTable
CREATE TABLE "RecordingConversationSegment" (
    "id" SERIAL NOT NULL,
    "s3KeyOriginal" TEXT NOT NULL,
    "recordingSegmentId" INTEGER,
    "coachingSessionId" INTEGER,
    "porteId" INTEGER,
    "commercialId" INTEGER,
    "managerId" INTEGER,
    "immeubleId" INTEGER,
    "statut" "StatutPorte",
    "source" "RecordingConversationSegmentSource" NOT NULL DEFAULT 'FALLBACK',
    "type" "RecordingConversationSegmentType" NOT NULL DEFAULT 'UNKNOWN',
    "reviewStatus" "RecordingConversationReviewStatus" NOT NULL DEFAULT 'PENDING',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "startTime" DOUBLE PRECISION NOT NULL,
    "endTime" DOUBLE PRECISION NOT NULL,
    "durationSec" DOUBLE PRECISION NOT NULL,
    "text" TEXT,
    "speechScore" INTEGER,
    "s3KeySegment" TEXT,
    "classificationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecordingConversationSegment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecordingConversationSegment_recordingSegmentId_key" ON "RecordingConversationSegment"("recordingSegmentId");

-- CreateIndex
CREATE INDEX "RecordingConversationSegment_s3KeyOriginal_idx" ON "RecordingConversationSegment"("s3KeyOriginal");

-- CreateIndex
CREATE INDEX "RecordingConversationSegment_recordingSegmentId_idx" ON "RecordingConversationSegment"("recordingSegmentId");

-- CreateIndex
CREATE INDEX "RecordingConversationSegment_coachingSessionId_idx" ON "RecordingConversationSegment"("coachingSessionId");

-- CreateIndex
CREATE INDEX "RecordingConversationSegment_porteId_idx" ON "RecordingConversationSegment"("porteId");

-- CreateIndex
CREATE INDEX "RecordingConversationSegment_type_idx" ON "RecordingConversationSegment"("type");

-- CreateIndex
CREATE INDEX "RecordingConversationSegment_reviewStatus_idx" ON "RecordingConversationSegment"("reviewStatus");

-- CreateIndex
CREATE INDEX "RecordingConversationSegment_source_idx" ON "RecordingConversationSegment"("source");

-- CreateIndex
CREATE INDEX "RecordingConversationSegment_startTime_idx" ON "RecordingConversationSegment"("startTime");

-- AddForeignKey
ALTER TABLE "RecordingConversationSegment" ADD CONSTRAINT "RecordingConversationSegment_recordingSegmentId_fkey" FOREIGN KEY ("recordingSegmentId") REFERENCES "RecordingSegment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordingConversationSegment" ADD CONSTRAINT "RecordingConversationSegment_coachingSessionId_fkey" FOREIGN KEY ("coachingSessionId") REFERENCES "CoachingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordingConversationSegment" ADD CONSTRAINT "RecordingConversationSegment_porteId_fkey" FOREIGN KEY ("porteId") REFERENCES "Porte"("id") ON DELETE SET NULL ON UPDATE CASCADE;
