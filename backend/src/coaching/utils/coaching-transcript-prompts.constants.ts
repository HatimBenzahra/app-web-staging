import { buildDomainVocabularyPrompt } from './coaching-domain-vocabulary.constants';
import type { TranscriptionMemory } from '../types/transcription-memory.types';
import { renderTranscriptionMemoryPrompt } from './transcription-memory.utils';

export const REWRITE_SYSTEM_PROMPT =
  'Tu transformes des transcriptions commerciales hachées en dialogues lisibles, pour le groupe Finanssor (prospection porte-à-porte énergie, télécoms, assurance, services). Tu ne changes jamais le sens, tu n’inventes rien, et tu signales les passages incertains. Tu connais le vocabulaire métier et tu rétablis les noms propres mal transcrits par Whisper UNIQUEMENT quand le contexte les rend évidents.';

export const CLEAN_TRANSCRIPT_PROMPT_VERSION = 'clean-transcript-v1';

export const DIALOGUE_RECONSTRUCTION_PROMPT_VERSION =
  CLEAN_TRANSCRIPT_PROMPT_VERSION;

export const RECONSTRUCT_DIALOGUE_SYSTEM_PROMPT = [
  'Tu produis une transcription finale saine pour affichage à partir de fenêtres candidates STT horodatées Finanssor.',
  'MISSION UNIQUE: nettoyer et structurer le réel, sans appliquer le plan de vente et sans juger la performance commerciale.',
  'Tu peux clarifier, ponctuer, séparer les locuteurs, classifier les passages et appliquer le vocabulaire métier contrôlé.',
  'Tu ne peux jamais compléter une phrase absente, ajouter une objection, ajouter une intention ou rendre la conversation plus commerciale.',
  'Chaque tour doit rester sourcé par un rawText/sourceQuote présent dans le transcript.',
  'Important: une fenêtre candidate n’est pas forcément une porte ni une conversation complète.',
  'Une même fenêtre candidate peut contenir zéro, une ou plusieurs interactions prospect, ainsi que des passages internes, du bruit ou du déplacement.',
  'Les bornes startTime/endTime sont des limites techniques de traitement, pas une preuve métier que tout le contenu est une porte.',
  'Le statut terrain est un indice utile mais faible: il ne doit jamais forcer la lecture du transcript.',
  'Identifie le locuteur le plus probable: COMMERCIAL, PROSPECT, INTERNAL ou UNKNOWN.',
  'Classifie chaque tour avec blockType: PROSPECT_INTERACTION, INTERNAL_DISCUSSION, NOISE, INAUDIBLE ou UNCERTAIN.',
  'Les échanges entre commerciaux doivent être INTERNAL, blockType=INTERNAL_DISCUSSION, scorable=false.',
  'Les passages bruités ou incohérents doivent être UNKNOWN, blockType=NOISE/INAUDIBLE/UNCERTAIN, scorable=false; compacte-les au lieu de fabriquer une conversation.',
  'Garde les timestamps absolus en secondes pour chaque tour.',
  'Si le locuteur ou le contenu est incertain, baisse speakerConfidence/textConfidence et explique dans reason.',
  'Tu dois déclarer chaque normalisation: raw, normalized, type, confidence, meaningChanged, reason.',
  'La transcription finale doit être saine: lisible quand fiable, prudente et courte quand le brut est mauvais.',
  'N’ajoute jamais de note, commentaire, analyse globale ou explication dans un tour de dialogue.',
  'Un tour doit contenir une seule prise de parole: jamais plusieurs labels Commercial/Client/Interne dans le même text.',
  'Few-shot 1: raw="Bonjour madame, c’est le groupe financier." => speaker=COMMERCIAL, blockType=PROSPECT_INTERACTION, normalizedText="Bonjour madame, c’est le groupe Finanssor.", normalizations=[DOMAIN_VOCABULARY].',
  'Few-shot 2: raw="Il n’y a pas tout ici, au revoir." => speaker=PROSPECT, blockType=PROSPECT_INTERACTION, normalizedText="Il n’y a personne ici, au revoir." seulement si le contexte porte rend cette lecture probable; sinon garde le raw et baisse confidence.',
  'Few-shot 3: raw="C’est chaud. Non, c’était plus long. On monte au prochain étage." => speaker=INTERNAL, blockType=INTERNAL_DISCUSSION, scorable=false; ne le transforme pas en échange client.',
  'Few-shot 4: raw="gaz et l’hélicoptère, groupe financier" dans un contexte énergie => correction possible vers "gaz et l’électricité, groupe Finanssor", confidence moyenne; si le contexte n’est pas clair, blockType=UNCERTAIN.',
  'Few-shot 5: raw très incohérent sans interaction client claire => speaker=UNKNOWN, blockType=INAUDIBLE ou NOISE, normalizedText="[passage inaudible]", scorable=false.',
  'Réponse concise obligatoire: pas de longues raisons, pas de résumé, pas de commentaire global.',
  'Chaque reason doit faire moins de 140 caractères ou être null.',
  'Chaque normalizations doit contenir uniquement les corrections utiles, jamais une liste exhaustive.',
  'Réponds uniquement en JSON valide, sans markdown.',
].join('\n');

export const buildReconstructDialogueUserPrompt = (input: {
  candidateWindowOrder: number;
  startTime: number;
  endTime: number;
  status?: string | null;
  transcriptText: string;
  memory?: TranscriptionMemory | null;
}): string =>
  [
    `Fenêtre candidate ${input.candidateWindowOrder}`,
    `Bornes audio techniques: ${input.startTime}s → ${input.endTime}s`,
    `Statut terrain indicatif: ${input.status ?? 'non renseigné'}`,
    '',
    buildDomainVocabularyPrompt(),
    '',
    input.memory ? renderTranscriptionMemoryPrompt(input.memory) : '',
    '',
    'Segments Whisper horodatés:',
    input.transcriptText,
    '',
    'Règles:',
    '- Cette fenêtre candidate peut ne pas correspondre exactement à une porte.',
    '- Ne suppose jamais que toute la fenêtre est une conversation prospect.',
    '- Une fenêtre peut contenir zéro, une ou plusieurs interactions prospect.',
    '- Les bornes audio servent seulement à limiter les timestamps de sortie.',
    '- Le statut terrain peut aider, mais le texte brut reste prioritaire.',
    '- Le plan de vente n’est volontairement pas fourni: ne déduis aucune étape commerciale attendue.',
    '- Fusionne uniquement les fragments contigus qui appartiennent au même tour de parole.',
    '- Ne corrige que ponctuation, majuscules, vocabulaire métier contrôlé et erreurs phonétiques très proches.',
    '- Si la mémoire contient une correction fiable déjà observée dans ce run, applique-la seulement si le raw reste phonétiquement ou contextuellement compatible.',
    '- Finanssor, gaz, électricité, fournisseur, facture et tarification sont prioritaires quand la confusion STT est proche et déclarée en normalizations.',
    '- Préserve les formulations utiles au coaching, même si elles sont maladroites.',
    '- Si un segment est incompréhensible, crée un tour UNKNOWN, blockType=INAUDIBLE ou UNCERTAIN, scorable=false, normalizedText="[passage inaudible]".',
    '- Si le passage est un échange entre commerciaux, speaker=INTERNAL, blockType=INTERNAL_DISCUSSION, scorable=false.',
    '- Si le passage est bruit/ambiance/hors conversation, speaker=UNKNOWN, blockType=NOISE, scorable=false.',
    '- Compacter les longs passages internes/bruités en un tour court est préférable à afficher du charabia.',
    '- Appuie-toi sur le sens global, les rôles probables et le contexte terrain, pas sur un mot isolé.',
    '- Si une correction change le sens, elle est interdite.',
    '- Si tu doutes, garde le brut ou baisse fortement confidence.',
    '- Ne crée pas de tour sans preuve textuelle dans le transcript.',
    '- Ne mets jamais "[Note: ...]" ou une remarque méta dans text/rawText/normalizedText.',
    '- Si tu vois plusieurs prises de parole dans un segment, découpe-les en plusieurs tours JSON.',
    '- startTime/endTime doivent rester dans les bornes audio techniques fournies.',
    '- usableForScoring=false si aucun bloc PROSPECT_INTERACTION fiable n’est présent.',
    '- usableForScoring=false si les passages prospect sont trop fragmentés, trop internes, ou trop incertains.',
    '- Réponse compacte: 1 tour par prise de parole claire, pas de paragraphes d’explication.',
    '- reason doit être court ou null. uncertainties doit contenir seulement les vrais points bloquants.',
  ].join('\n');

export const RECONSTRUCT_DIALOGUE_JSON_SCHEMA = {
  name: 'dialogue_reconstruction',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'conversationKind',
      'usableForScoring',
      'scoreabilityReason',
      'turns',
      'uncertainties',
    ],
    properties: {
      conversationKind: {
        type: 'string',
        enum: ['PROSPECT', 'INTERNAL', 'MIXED', 'NOISE', 'UNKNOWN'],
      },
      usableForScoring: { type: 'boolean' },
      scoreabilityReason: { type: ['string', 'null'] },
      turns: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'speaker',
            'startTime',
            'endTime',
            'rawText',
            'normalizedText',
            'sourceQuote',
            'text',
            'confidence',
            'speakerConfidence',
            'textConfidence',
            'correctionLevel',
            'normalizations',
            'scorable',
            'displayable',
            'blockType',
            'exclusionReason',
            'reason',
          ],
          properties: {
            speaker: {
              type: 'string',
              enum: ['COMMERCIAL', 'PROSPECT', 'INTERNAL', 'UNKNOWN'],
            },
            startTime: { type: ['number', 'null'] },
            endTime: { type: ['number', 'null'] },
            rawText: { type: ['string', 'null'] },
            normalizedText: { type: ['string', 'null'] },
            sourceQuote: { type: ['string', 'null'] },
            text: { type: 'string' },
            confidence: { type: 'number' },
            speakerConfidence: { type: ['number', 'null'] },
            textConfidence: { type: ['number', 'null'] },
            correctionLevel: {
              type: 'string',
              enum: ['NONE', 'LIGHT', 'MEDIUM', 'RISKY'],
            },
            normalizations: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: [
                  'raw',
                  'normalized',
                  'type',
                  'confidence',
                  'meaningChanged',
                  'reason',
                ],
                properties: {
                  raw: { type: 'string' },
                  normalized: { type: 'string' },
                  type: {
                    type: 'string',
                    enum: [
                      'DOMAIN_VOCABULARY',
                      'PHONETIC_CONTEXTUAL',
                      'PUNCTUATION',
                      'SEGMENTATION',
                      'NONE',
                    ],
                  },
                  confidence: { type: 'number' },
                  meaningChanged: { type: 'boolean' },
                  reason: { type: ['string', 'null'] },
                },
              },
            },
            scorable: { type: 'boolean' },
            displayable: { type: 'boolean' },
            blockType: {
              type: 'string',
              enum: [
                'PROSPECT_INTERACTION',
                'INTERNAL_DISCUSSION',
                'NOISE',
                'INAUDIBLE',
                'UNCERTAIN',
              ],
            },
            exclusionReason: { type: ['string', 'null'] },
            reason: { type: ['string', 'null'] },
          },
        },
      },
      uncertainties: {
        type: 'array',
        items: { type: 'string' },
      },
    },
  },
};

export const buildRewriteUserPrompt = (preparedTranscript: string): string =>
  [
    'Réécris le transcript ci-dessous en dialogue lisible et fluide.',
    '',
    'Règles strictes:',
    '- Ne change pas le sens, n’ajoute aucune information absente du transcript.',
    '- Regroupe les fragments qui appartiennent à la même phrase ou au même tour de parole.',
    '- Supprime les ellipses répétitives "...", "....", "… … …".',
    '- Si un passage est incompréhensible: écris "[passage inaudible]".',
    '- Structure en tours de parole avec "Commercial :", "Client :" ou "Intervenant :" si le locuteur est incertain.',
    '- Ne mets pas un timestamp à chaque phrase. Tu peux garder un timestamp au début d’un grand bloc seulement si utile.',
    '- Corrige uniquement ponctuation, majuscules, répétitions évidentes et segmentation.',
    '- Retourne uniquement le texte réécrit, sans markdown.',
    '',
    'Vocabulaire métier Finanssor — à orthographier correctement quand le contexte rend la correction évidente:',
    '- Marques énergie: Plénitude (filiale ENI), ENI, OHM Énergie, EDF, GDF, TotalEnergies, Enedis, GRDF.',
    '- Marques télécom: France Téléphone, Bleutel, Bleubox, Mondial TV (Mondial.tv), Télécable, Orange, Bouygues, SFR.',
    '- Autres marques: Depan’ssur (Depanssur), Action Prévoyance, Néoliane, ECA, Finanssor.',
    '- Énergie: kilowatt-heure (kWh), compteur Linky, fournisseur, abonnement, contrat, tarification, facture, tarif bloqué, réduction, souscription, mise en service, PCE (gaz), PDL (électricité).',
    '- Télécom: forfait, carte SIM, eSIM, portabilité, 4G, 5G, Wi-Fi 6, fibre, box internet, débit.',
    '- Administratif: RIB, IBAN, mandat SEPA, sans engagement, délai de rétractation 14 jours, lettre de résiliation, livret A.',
    '',
    'Si tu lis "plénitude" en minuscule dans un contexte fournisseur énergie → écris "Plénitude" (la marque).',
    `Si tu lis "fonds d'avancement" / "changement d'avancement" → c'est probablement "fournisseur" / "changement de fournisseur".`,
    'Si tu lis "kilo" / "kilomètre" dans un contexte facture/tarif → c’est "kilowatt-heure" (kWh).',
    `Si tu lis "fuir tranquille" → c'est "finir tranquille".`,
    `Phrases d'accroche typiques: "Bonjour Monsieur/Madame, c'est [marque]...", "On passe suite à l'avis de passage", "Par rapport aux nouvelles tarifications", "J'en ai juste pour 2 petites minutes".`,
    '',
    'Si tu doutes, ne touche pas. Préserve les hésitations qui éclairent le coaching ("euh", "ben") sauf si purement parasites.',
    '',
    preparedTranscript,
  ].join('\n');
