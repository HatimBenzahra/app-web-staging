-- Add timestamps on step evaluations so verbatims can jump to the matching audio excerpt.
ALTER TABLE "CoachingStepEvaluation"
ADD COLUMN "startTime" DOUBLE PRECISION,
ADD COLUMN "endTime" DOUBLE PRECISION;

-- Store concrete moments detected by the coaching analysis.
CREATE TABLE "CoachingKeyMoment" (
  "id" SERIAL NOT NULL,
  "coachingSessionId" INTEGER NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "startTime" DOUBLE PRECISION,
  "endTime" DOUBLE PRECISION,
  "verbatim" TEXT,
  "importance" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CoachingKeyMoment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CoachingKeyMoment_coachingSessionId_idx" ON "CoachingKeyMoment"("coachingSessionId");
CREATE INDEX "CoachingKeyMoment_type_idx" ON "CoachingKeyMoment"("type");
CREATE INDEX "CoachingKeyMoment_importance_idx" ON "CoachingKeyMoment"("importance");

ALTER TABLE "CoachingKeyMoment"
ADD CONSTRAINT "CoachingKeyMoment_coachingSessionId_fkey"
FOREIGN KEY ("coachingSessionId") REFERENCES "CoachingSession"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
