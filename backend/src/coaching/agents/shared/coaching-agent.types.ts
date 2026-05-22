export type CoachingAgentName =
  | 'segmentation'
  | 'transcript_cleaner'
  | 'sales_plan'
  | 'remarks';

export type CoachingAgentRunContext = {
  agent: CoachingAgentName;
  jobId?: number | null;
  candidateWindowOrder?: number | null;
  stage: string;
};

export type CoachingAgentRequestLog = CoachingAgentRunContext & {
  promptVersion: string;
  inputChars?: number;
  inputBlocks?: number;
};

export type CoachingAgentResponseLog = CoachingAgentRunContext & {
  rawResponseChars?: number;
  outputItems?: number;
};

export type CoachingAgentValidationLog = CoachingAgentRunContext & {
  valid: boolean;
  reasons: string[];
};

export type CoachingAgentJsonSchema = {
  name: string;
  strict?: boolean;
  schema: Record<string, unknown>;
};

export type CoachingAgentChatInput = {
  systemPrompt: string;
  userPrompt: string;
  jsonSchema: CoachingAgentJsonSchema;
  maxTokens: number;
  temperature: number;
  promptVersion: string;
};
