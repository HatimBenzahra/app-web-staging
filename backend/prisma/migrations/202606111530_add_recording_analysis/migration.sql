-- CreateEnum
CREATE TYPE "RecordingAnalysisStatus" AS ENUM ('PENDING', 'ANALYZING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "RecordingAnalysis" (
    "id" SERIAL NOT NULL,
    "recordingId" INTEGER NOT NULL,
    "s3Key" TEXT NOT NULL,
    "status" "RecordingAnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "score" INTEGER,
    "totalDurationSec" DOUBLE PRECISION,
    "speechDurationSec" DOUBLE PRECISION,
    "analyzedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecordingAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecordingAnalysis_recordingId_key" ON "RecordingAnalysis"("recordingId");

-- CreateIndex
CREATE UNIQUE INDEX "RecordingAnalysis_s3Key_key" ON "RecordingAnalysis"("s3Key");

-- CreateIndex
CREATE INDEX "RecordingAnalysis_status_idx" ON "RecordingAnalysis"("status");

-- CreateIndex
CREATE INDEX "RecordingAnalysis_s3Key_idx" ON "RecordingAnalysis"("s3Key");

-- AddForeignKey
ALTER TABLE "RecordingAnalysis" ADD CONSTRAINT "RecordingAnalysis_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "Recording"("id") ON DELETE CASCADE ON UPDATE CASCADE;
