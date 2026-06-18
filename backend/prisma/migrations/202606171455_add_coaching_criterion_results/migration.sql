ALTER TABLE "CoachingSession" ADD COLUMN IF NOT EXISTS "criterionResults" JSONB;
ALTER TABLE "CoachingConversationEvaluation" ADD COLUMN IF NOT EXISTS "criterionResults" JSONB;
