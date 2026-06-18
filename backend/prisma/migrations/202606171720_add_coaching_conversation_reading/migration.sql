ALTER TABLE "CoachingSession"
ADD COLUMN IF NOT EXISTS "conversationReading" JSONB;

ALTER TABLE "CoachingConversationEvaluation"
ADD COLUMN IF NOT EXISTS "conversationReading" JSONB;
