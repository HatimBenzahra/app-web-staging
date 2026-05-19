import { CoachingScoringEngineService } from './coaching-scoring-engine.service';
import { ConversationQualityGateService } from './conversation-quality-gate.service';
import { cleanTranscriptForQuality } from '../utils/transcript-quality.utils';

describe('CoachingScoringEngineService', () => {
  const service = new CoachingScoringEngineService();
  const criteria = [
    {
      stepOrder: 1,
      stepTitle: 'Ouverture',
      key: 'salutation',
      label: 'Salue le prospect',
      weight: 50,
      required: true,
      applicableStatuses: [],
      order: 1,
    },
    {
      stepOrder: 1,
      stepTitle: 'Ouverture',
      key: 'presentation',
      label: 'Se présente',
      weight: 50,
      required: true,
      applicableStatuses: [],
      order: 2,
    },
  ];

  it('calcule un score déterministe à partir des qualités de preuve', () => {
    const evidence = service.normalizeEvidence(
      {
        criteriaEvidence: [
          {
            stepOrder: 1,
            criterionKey: 'salutation',
            criterionLabel: 'Salue le prospect',
            found: true,
            quality: 'COMPLETE',
            confidence: 0.9,
            verbatim: 'Bonjour madame.',
            startTime: 1,
            endTime: 2,
          },
          {
            stepOrder: 1,
            criterionKey: 'presentation',
            criterionLabel: 'Se présente',
            found: true,
            quality: 'PARTIAL',
            confidence: 0.8,
            verbatim: 'Je passe pour les tarifs.',
            startTime: 3,
            endTime: 4,
          },
        ],
        keyEvents: [],
        uncertainties: [],
      },
      criteria,
      100,
    );

    const result = service.calculate({ criteria, evidence });

    expect(result.overallScore).toBe(85);
    expect(result.stepEvaluations[0]).toMatchObject({
      coverageStatus: 'COVERED',
      score: 85,
      startTime: 101,
    });
  });

  it('rejette un critère found sans verbatim', () => {
    const evidence = service.normalizeEvidence(
      {
        criteriaEvidence: [
          {
            stepOrder: 1,
            criterionKey: 'salutation',
            criterionLabel: 'Salue le prospect',
            found: true,
            quality: 'COMPLETE',
            confidence: 0.9,
            verbatim: null,
            startTime: null,
            endTime: null,
          },
        ],
        keyEvents: [],
        uncertainties: [],
      },
      criteria,
    );

    const result = service.calculate({ criteria, evidence });

    expect(evidence.criteriaEvidence[0]).toMatchObject({
      found: false,
      quality: 'MISSING',
    });
    expect(result.overallScore).toBe(0);
  });

  it('score une application du plan de vente par étapes', () => {
    const result = service.calculateFromStepApplication({
      salesPlanSteps: [
        { ordre: 1, titre: 'Ouverture et cadrage', poids: 20 },
        { ordre: 2, titre: 'Découverte du contexte', poids: 20 },
        { ordre: 3, titre: 'Proposition de valeur', poids: 25 },
        { ordre: 4, titre: 'Traitement des objections', poids: 20 },
        { ordre: 5, titre: 'Closing et prochaine étape', poids: 15 },
      ],
      application: {
        conversationSummary:
          'Le commercial présente le sujet énergie, cherche le décideur et propose une économie.',
        steps: [
          {
            stepOrder: 1,
            observed: true,
            quality: 'PARTIAL',
            confidence: 0.82,
            evidence: [
              {
                verbatim: "Je passe pour le gaz à l'électricité",
                startTime: null,
                endTime: null,
              },
            ],
            whatWentWell: ['Motif du passage annoncé rapidement.'],
            whatIsMissing: ['Présentation entreprise peu claire.'],
            coachingAdvice: ['Stabiliser la phrase de présentation.'],
          },
          {
            stepOrder: 2,
            observed: true,
            quality: 'PARTIAL',
            confidence: 0.8,
            evidence: [
              {
                verbatim: "C'est vous qui vous occupez de ça à la maison ?",
                startTime: null,
                endTime: null,
              },
            ],
            whatWentWell: ['Le décideur est recherché.'],
            whatIsMissing: ['Peu de découverte sur le fournisseur actuel.'],
            coachingAdvice: ['Ajouter une question sur la facture actuelle.'],
          },
          {
            stepOrder: 3,
            observed: true,
            quality: 'COMPLETE',
            confidence: 0.86,
            evidence: [
              {
                verbatim:
                  "j'ai juste besoin d'economiser de l'argent. Donc je vais baisser mes factures",
                startTime: null,
                endTime: null,
              },
            ],
            whatWentWell: ['Bénéfice économique clair.'],
            whatIsMissing: [],
            coachingAdvice: ['Conserver ce bénéfice concret.'],
          },
          {
            stepOrder: 4,
            observed: true,
            quality: 'WEAK',
            confidence: 0.68,
            evidence: [
              {
                verbatim: "bien sûr, je comprends demain, c'est mieux",
                startTime: null,
                endTime: null,
              },
            ],
            whatWentWell: ['Ton non agressif.'],
            whatIsMissing: ['L’objection n’est pas vraiment traitée.'],
            coachingAdvice: ['Proposer un créneau précis plutôt que sortir.'],
          },
        ],
        keyMoments: [],
        strengths: [],
        improvements: [],
        recommendations: [],
        uncertainties: [],
      },
    });

    expect(result.overallScore).toBeGreaterThan(45);
    expect(result.overallScore).toBeLessThan(80);
    expect(result.stepEvaluations).toHaveLength(5);
    expect(result.stepEvaluations[2]).toMatchObject({
      ordre: 3,
      coverageStatus: 'COVERED',
      score: 100,
    });
    expect(result.stepEvaluations[4]).toMatchObject({
      ordre: 5,
      coverageStatus: 'MISSING',
      score: 0,
    });
    expect(result.strengths.join(' ')).toContain('Bénéfice');
  });

  it('conserve une étape MISSING même si le LLM cite un verbatim négatif', () => {
    const result = service.calculateFromStepApplication({
      salesPlanSteps: [
        { ordre: 4, titre: 'Traitement des objections', poids: 20 },
      ],
      application: {
        conversationSummary: 'Le commercial abandonne face au refus.',
        steps: [
          {
            stepOrder: 4,
            observed: true,
            quality: 'MISSING',
            confidence: 0.8,
            evidence: [
              {
                verbatim:
                  "bon ben ce n'est pas grave je ne vais pas vous déranger",
                startTime: null,
                endTime: null,
                reason:
                  "Le verbatim montre l'abandon, pas un traitement d'objection.",
              },
            ],
            whatWentWell: ['Le commercial reste poli.'],
            whatIsMissing: ["L'objection n'est pas reformulée."],
            coachingAdvice: ['Proposer un créneau précis.'],
          },
        ],
        keyMoments: [],
        strengths: [],
        improvements: [],
        recommendations: [],
        uncertainties: [],
      },
    });

    expect(result.stepEvaluations[0]).toMatchObject({
      ordre: 4,
      coverageStatus: 'MISSING',
      score: 0,
      verbatim: "bon ben ce n'est pas grave je ne vais pas vous déranger",
    });
    expect(result.overallScore).toBe(0);
    expect(result.objectionHandlingScore).toBe(0);
  });
});

describe('ConversationQualityGateService', () => {
  const service = new ConversationQualityGateService();

  it('skip les segments internes', () => {
    expect(
      service.evaluate({
        type: 'INTERNAL',
        durationSec: 80,
        transcriptText: 'On monte au prochain étage.',
      }).decision,
    ).toBe('SKIP');
  });

  it('met en review un ABSENT avec parole détectée', () => {
    const result = service.evaluate({
      status: 'ABSENT',
      type: 'PROSPECT',
      durationSec: 45,
      speechScore: 80,
      transcriptText:
        'Bonjour monsieur, je passe pour les nouvelles tarifications. Vous êtes chez quel fournisseur actuellement ?',
    });

    expect(result.decision).toBe('REVIEW_ONLY');
    expect(result.reasons.join(' ')).toContain('ABSENT');
  });

  it('bloque un transcript long avec peu de texte et faible parole', () => {
    const result = service.evaluate({
      type: 'PROSPECT',
      durationSec: 471,
      speechScore: 27,
      transcriptText:
        "J'ai éclaté. Bonjour madame, c'est concernant le gaz et l'électricité.",
    });

    expect(result.decision).toBe('REVIEW_ONLY');
    expect(result.transcriptQuality?.state).toBe('NON_EVALUABLE');
    expect(result.reasons.join(' ')).toContain('Densité');
  });

  it('garde en review un transcript court mais cohérent', () => {
    const result = service.evaluate({
      type: 'PROSPECT',
      durationSec: 25,
      speechScore: 80,
      transcriptText:
        'Bonjour madame, je passe pour les nouvelles tarifications du gaz.',
    });

    expect(result.decision).toBe('EVALUATE_WITH_REVIEW');
    expect(result.transcriptQuality?.state).toBe('REVIEW');
  });
});

describe('Transcript quality cleanup', () => {
  it('déduplique les phrases répétées en majuscules/minuscules', () => {
    const result = cleanTranscriptForQuality(
      "Bonjour madame, c'est concernant le gaz. BONJOUR MADAME, C'EST CONCERNANT LE GAZ. Vous êtes chez quel fournisseur ?",
    );

    expect(result.cleanedText).toBe(
      "Bonjour madame, c'est concernant le gaz. Vous êtes chez quel fournisseur ?",
    );
    expect(result.duplicateRatio).toBeGreaterThan(0);
  });

  it('supprime les hallucinations courtes isolées connues', () => {
    const result = cleanTranscriptForQuality(
      "J'ai éclaté. Bonjour madame, je passe pour l'électricité.",
    );

    expect(result.cleanedText).toBe(
      "Bonjour madame, je passe pour l'électricité.",
    );
    expect(result.suspiciousPhraseCount).toBe(1);
  });
});
