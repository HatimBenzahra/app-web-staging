ALTER TABLE "CoachingConversationEvaluation"
  ADD COLUMN "conversationKind" TEXT,
  ADD COLUMN "usableForScoring" BOOLEAN,
  ADD COLUMN "scoreabilityReason" TEXT,
  ADD COLUMN "dialogueQualityJson" JSONB;

ALTER TABLE "CoachingCriterionEvidence"
  ADD COLUMN "evidenceCompleteness" TEXT,
  ADD COLUMN "missingBecause" TEXT,
  ADD COLUMN "scoreable" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "sourceTurnIds" JSONB;
