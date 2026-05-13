-- One recording analyzed with one plan version must have only one coaching session.
-- Keep the most recently updated duplicate, and cascade-delete its duplicate details.
WITH ranked_sessions AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "s3KeyOriginal", "salesPlanVersionId"
      ORDER BY "updatedAt" DESC, "id" DESC
    ) AS row_number
  FROM "CoachingSession"
)
DELETE FROM "CoachingSession"
WHERE "id" IN (
  SELECT "id"
  FROM ranked_sessions
  WHERE row_number > 1
);

CREATE UNIQUE INDEX "CoachingSession_s3KeyOriginal_salesPlanVersionId_key"
ON "CoachingSession"("s3KeyOriginal", "salesPlanVersionId");
