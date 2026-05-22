import { buildDomainVocabularyPrompt } from '../../utils/coaching-domain-vocabulary.constants';
import type { SegmentationAgentInput } from './segmentation-agent.types';

export const SEGMENTATION_AGENT_PROMPT_VERSION = 'segmentation-agent-v1';

export const SEGMENTATION_AGENT_SYSTEM_PROMPT = [
  'Tu es l’agent de découpage du pipeline coaching Finanssor.',
  'MISSION UNIQUE: repérer dans une fenêtre candidate les blocs temporels utiles, sans corriger le texte et sans scorer.',
  'La fenêtre candidate n’est pas forcément une porte ni une conversation complète.',
  'Elle peut contenir zéro, une ou plusieurs interactions prospect, des échanges internes, du bruit, du déplacement, de l’inaudible.',
  'Tu dois classer chaque bloc en PROSPECT_INTERACTION, INTERNAL_DISCUSSION, NOISE, INAUDIBLE ou UNCERTAIN.',
  'Tu ne dois jamais transformer une discussion interne en échange client.',
  'Tu ne dois jamais supposer que toute la fenêtre est prospect parce que le statut terrain existe.',
  'Le statut terrain est un indice faible; le transcript horodaté est prioritaire.',
  'Ne corrige pas les mots. Ne réécris pas les phrases. Ne donne aucun score.',
  'Few-shot 1: "Bonjour madame... gaz électricité..." avec réponse occupant => PROSPECT_INTERACTION.',
  'Few-shot 2: "C’est chaud, on monte, le prochain..." => INTERNAL_DISCUSSION, shouldClean=true si le texte est lisible.',
  'Few-shot 3: cris, bruit, fragments sans rôle clair => NOISE ou INAUDIBLE.',
  'Few-shot 4: phrase commerciale isolée sans réponse claire => UNCERTAIN, shouldClean=true seulement si le texte peut être rendu lisible.',
  'Réponds uniquement en JSON valide, sans markdown.',
].join('\n');

export function buildSegmentationAgentUserPrompt(
  input: SegmentationAgentInput,
): string {
  return [
    `Fenêtre candidate ${input.candidateWindowOrder}`,
    `Bornes audio techniques: ${input.startTime}s → ${input.endTime}s`,
    `Statut terrain indicatif: ${input.status ?? 'non renseigné'}`,
    input.preflight
      ? `Métriques preflight: ${JSON.stringify({
          charsPerMin: input.preflight.charsPerMin,
          rawSegmentsCount: input.preflight.rawSegmentsCount,
          duplicateLineCount: input.preflight.duplicateLineCount,
          qualityHint: input.preflight.qualityHint,
          reasons: input.preflight.reasons,
        })}`
      : '',
    '',
    buildDomainVocabularyPrompt(),
    '',
    'Transcript STT horodaté:',
    input.transcriptText,
    '',
    'Règles de sortie:',
    '- Découpe uniquement quand le sens temporel le justifie.',
    '- Les blocs peuvent être larges si le transcript est très bruité.',
    '- shouldClean=false seulement pour NOISE pur ou INAUDIBLE sans contenu exploitable.',
    '- shouldClean=true pour PROSPECT_INTERACTION, INTERNAL_DISCUSSION et UNCERTAIN lisible à vérifier.',
    '- startTime/endTime doivent rester dans les bornes audio techniques.',
    '- confidence doit refléter la certitude de classification, pas la qualité commerciale.',
  ]
    .filter(Boolean)
    .join('\n');
}
