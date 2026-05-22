import {
  SEGMENTATION_AGENT_JSON_SCHEMA,
} from './segmentation/segmentation-agent.schema';
import {
  SEGMENTATION_AGENT_SYSTEM_PROMPT,
} from './segmentation/segmentation-agent.prompt';
import {
  TRANSCRIPT_CLEANER_AGENT_SYSTEM_PROMPT,
} from './transcript-cleaner/transcript-cleaner-agent.prompt';
import {
  TRANSCRIPT_CLEANER_AGENT_JSON_SCHEMA,
} from './transcript-cleaner/transcript-cleaner-agent.schema';
import {
  SALES_PLAN_AGENT_JSON_SCHEMA,
} from './sales-plan/sales-plan-agent.schema';
import {
  SALES_PLAN_AGENT_SYSTEM_PROMPT,
} from './sales-plan/sales-plan-agent.prompt';
import {
  REMARKS_AGENT_JSON_SCHEMA,
} from './remarks/remarks-agent.schema';
import {
  REMARKS_AGENT_SYSTEM_PROMPT,
} from './remarks/remarks-agent.prompt';

describe('coaching agents contracts', () => {
  it('isole le prompt segmentation du scoring et de la correction', () => {
    expect(SEGMENTATION_AGENT_SYSTEM_PROMPT).toContain('MISSION UNIQUE');
    expect(SEGMENTATION_AGENT_SYSTEM_PROMPT).toContain('Ne corrige pas');
    expect(SEGMENTATION_AGENT_SYSTEM_PROMPT).toContain('Ne donne aucun score');
    expect(SEGMENTATION_AGENT_SYSTEM_PROMPT).toContain('INTERNAL_DISCUSSION, shouldClean=true');
    expect(SEGMENTATION_AGENT_JSON_SCHEMA.strict).toBe(true);
  });

  it('garde un schéma JSON strict pour chaque agent LLM', () => {
    expect(TRANSCRIPT_CLEANER_AGENT_JSON_SCHEMA.strict).toBe(true);
    expect(SALES_PLAN_AGENT_JSON_SCHEMA.strict).toBe(true);
    expect(REMARKS_AGENT_JSON_SCHEMA.strict).toBe(true);
  });

  it('sépare les responsabilités transcription, plan et remarques', () => {
    expect(TRANSCRIPT_CLEANER_AGENT_SYSTEM_PROMPT).toContain('nettoyer');
    expect(SALES_PLAN_AGENT_SYSTEM_PROMPT).toContain('plan de vente');
    expect(SALES_PLAN_AGENT_SYSTEM_PROMPT).toContain('backend calculera');
    expect(REMARKS_AGENT_SYSTEM_PROMPT).toContain('remarques');
  });
});
