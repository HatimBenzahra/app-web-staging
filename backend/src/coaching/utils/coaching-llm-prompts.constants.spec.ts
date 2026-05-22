import {
  buildReconstructDialogueUserPrompt,
  DIALOGUE_RECONSTRUCTION_PROMPT_VERSION,
} from './coaching-llm-prompts.constants';

describe('coaching LLM prompts', () => {
  it('garde le plan de vente hors du prompt de reconstruction', () => {
    const prompt = buildReconstructDialogueUserPrompt({
      candidateWindowOrder: 1,
      startTime: 0,
      endTime: 30,
      status: 'ABSENT',
      transcriptText: '[0:01-0:05] Bonjour monsieur, c’est le groupe financier.',
    });

    expect(DIALOGUE_RECONSTRUCTION_PROMPT_VERSION).toBe(
      'clean-transcript-v1',
    );
    expect(prompt).toContain('Fenêtre candidate 1');
    expect(prompt).toContain('Bornes audio techniques: 0s → 30s');
    expect(prompt).toContain(
      'Ne suppose jamais que toute la fenêtre est une conversation prospect',
    );
    expect(prompt).toContain(
      'Une fenêtre peut contenir zéro, une ou plusieurs interactions prospect',
    );
    expect(prompt).toContain('Le plan de vente n’est volontairement pas fourni');
    expect(prompt).toContain('blockType=INTERNAL_DISCUSSION');
    expect(prompt).not.toContain('Étapes du plan à appliquer');
    expect(prompt).not.toContain('Proposition de valeur');
    expect(prompt).not.toContain('Closing et prochaine étape');
  });
});
