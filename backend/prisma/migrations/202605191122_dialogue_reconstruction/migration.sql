-- Preserve source Whisper chunks and structured dialogue reconstruction.
ALTER TABLE "RecordingConversationSegment"
  ADD COLUMN "sourceTranscriptSegments" JSONB;

ALTER TABLE "CoachingConversationEvaluation"
  ADD COLUMN "dialogueTurns" JSONB,
  ADD COLUMN "dialoguePromptVersion" TEXT,
  ADD COLUMN "dialogueRawResponse" TEXT;
