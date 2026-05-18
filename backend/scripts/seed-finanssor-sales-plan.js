/**
 * Seed du plan de vente Finanssor — Prospection porte-à-porte.
 *
 * Crée ou met à jour:
 *   - 1 SalesPlan ("Plan de vente Finanssor — Prospection porte-à-porte")
 *   - 1 SalesPlanVersion (status = PUBLISHED, version 1)
 *   - 11 SalesPlanStep (transposition fidèle du plan de vente officiel)
 *
 * Usage (depuis le container backend):
 *   docker cp scripts/seed-finanssor-sales-plan.js pro-win-staging-backend:/app/seed.js
 *   docker exec -w /app pro-win-staging-backend node seed.js
 */

/* eslint-disable @typescript-eslint/no-var-requires */
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const PLAN = {
  nom: 'Plan de vente Finanssor — Prospection porte-à-porte',
  description:
    'Plan de vente officiel du groupe Finanssor (énergie, télécoms, assurance, services). ' +
    "Couvre les 11 phases de la prospection porte-à-porte : préparation, passage à la porte, " +
    "climat de confiance, découverte énergie, offre Plénitude, pack Depan'ssur, prise de RIB, " +
    'découverte télécom + France Téléphone, Bleubox, Action Prévoyance, Mondial TV.',
}

const VERSION = {
  label: 'V1 — Plan officiel',
  versionNumber: 1,
  status: 'PUBLISHED',
  promptInstructions:
    "Évalue chaque étape selon les signaux observables dans la transcription. Identifie quand " +
    "le commercial respecte le script Finanssor (phrases d'accroche, argumentation 6-étapes, prise de RIB en deux temps). " +
    'Sois concret, cite les verbatims, distingue les étapes bien couvertes des étapes seulement survolées, ' +
    "et propose des actions d'amélioration courtes et opérationnelles. Tiens compte du fait que certaines phases " +
    "(préparation, prise du badge) ne sont PAS observables dans la transcription audio: ne pénalise pas leur absence si non détectable.",
}

const STEPS = [
  {
    ordre: 1,
    titre: 'Préparation',
    poids: 5,
    description:
      'Le commercial arrive équipé du matériel nécessaire: badge visible, tablette chargée, cahier de secteur, ' +
      "book de vente avec grille tarifaire, documents de souscription (demandes d'adhésion France Téléphone Illimité, " +
      "Depan'ssur, Mondial TV, Action Prévoyance, ECA), mandats SEPA (AP, FT, MTV, Depanssur, ECA), " +
      "lettres de résiliation assurance, connexion internet pour partage. Le badge est porté visible.",
    expectedSignals:
      "Mention d'objets de prospection (tablette, cahier de secteur, badge, avis de passage). " +
      'Phase souvent NON observable dans la transcription pure — ne pas pénaliser fortement si silencieux.',
  },
  {
    ordre: 2,
    titre: 'Passage à la porte / accroche',
    poids: 15,
    description:
      "Phrase d'accroche selon le script Finanssor: présentation marque (Plénitude / France Téléphone / etc.), " +
      'mention de l\'avis de passage affiché en bas, contexte "tout le monde dans l\'immeuble", sujet électricité+gaz ' +
      'ou télécom. Phrase rituelle "j\'en ai juste pour 2 petites minutes". L\'objectif est de rentrer dans l\'appartement. ' +
      "Traitement des objections-réflexe avec absorption → reformulation → enchaînement. 80% de la vente se joue dans les 30 premières secondes.",
    expectedSignals:
      'Phrases attendues: "Bonjour Monsieur/Madame", "c\'est Plénitude", "on passe suite à l\'avis de passage", ' +
      '"on est chargé de voir tout le monde dans l\'immeuble", "concernant l\'électricité et le gaz / la fibre", ' +
      '"par rapport aux nouvelles tarifications", "j\'en ai juste pour 2 petites minutes". ' +
      'Traitement d\'objections type "ça ne m\'intéresse pas", "je n\'ai pas le temps", "vous êtes là pourquoi". ' +
      'Le commercial reprend le contrôle par questions fermées qui amènent à dire "oui".',
  },
  {
    ordre: 3,
    titre: 'Climat de confiance',
    poids: 10,
    description:
      "Une fois entré chez le prospect: briser la glace, instaurer un dialogue, se mettre en phase. " +
      "Valoriser le prospect (qui il est, ce qu'il fait, ce qu'il vit). Intéressez-vous sincèrement à lui. " +
      "Complimenter avec justesse (un détail authentique, sans flatterie excessive). Poser des questions ouvertes " +
      '(\"Comment ça se passe pour vous aujourd\'hui ?\"). Faire parler le prospect de ses besoins, projets, frustrations. ' +
      'Écouter vraiment. Règle: observer et écouter 2x plus que parler.',
    expectedSignals:
      "Questions ouvertes sur la vie/famille/quotidien du prospect. Compliments authentiques sur l'appartement, " +
      "les enfants, le quartier. Marqueurs d'écoute active: \"d'accord\", \"je comprends\", reformulations. " +
      'Équilibre des temps de parole (le prospect parle au moins autant que le commercial). Aucune attaque commerciale prématurée.',
  },
  {
    ordre: 4,
    titre: 'Découverte énergie (électricité et gaz)',
    poids: 15,
    description:
      'Le commercial pose les 7 questions clés énergie pour constituer un stock de questions utiles et argumenter ensuite: ' +
      '(1) quel fournisseur actuel pour électricité/gaz ? (2) combien paie-t-il séparément ? (3) chauffage individuel au gaz ? ' +
      '(4) combien il consomme ? (5) est-il satisfait (facture/prix, qualité réseau, service client) ? ' +
      "(6) depuis combien de temps a-t-il son contrat ? (7) demande de la facture ou accès au PCE (gaz) et PDL (électricité). " +
      "Faire une estimation sur la tablette. Attitude calme et souriante, intonation d'intérêt.",
    expectedSignals:
      "Questions sur fournisseur actuel (EDF, GDF, Engie, autre), montant facture, kilowatt-heure (kWh), " +
      'compteur Linky, PCE (gaz), PDL (électricité), qualité réseau, ancienneté contrat. ' +
      'Demande explicite de voir la facture. Simulation sur tablette. ' +
      'Réponses du client sur sa situation énergétique.',
  },
  {
    ordre: 5,
    titre: 'Offre Plénitude',
    poids: 10,
    description:
      "Argumentation structurée en 6 étapes pour la marque Plénitude (filiale d'ENI, acteur majeur en Europe): " +
      '(1) Présentation: partenariat Plénitude, baisse factures gaz/électricité, même compteur, aucun changement d\'installation. ' +
      "(2) Proposition: 15% réduction électricité et 5% gaz, tarif bloqué 1 ou 2 ans, suivi personnalisé. " +
      '(3) Conservation des services: compteur conservé, réseau Enedis/GRDF inchangé, juste la facture qui baisse. ' +
      "(4) Accompagnement/mise en service: aucune démarche, le commercial s'occupe de tout. Zéro coupure, zéro frais cachés, zéro stress. " +
      '(5) Sans risque: sans engagement, libre à tout moment, confirmation écrite, délai rétractation 14 jours. ' +
      "(6) Action immédiate / souscription: envoi d'un mail, instructions à suivre, économies dès la prochaine facture.",
    expectedSignals:
      '"Plénitude", "ENI", "réduction électricité", "réduction gaz", "15%", "5%", "tarif bloqué 1 an / 2 ans", ' +
      '"compteur Enedis", "GRDF", "aucun changement technique", "zéro coupure", "zéro frais cachés", "zéro stress", ' +
      '"sans engagement", "14 jours de rétractation", "mail de confirmation", "économies dès la prochaine facture".',
  },
  {
    ordre: 6,
    titre: "Pack Depan'ssur",
    poids: 8,
    description:
      "Argumentation 6-étapes pour le Pack Depan'ssur (compatible avec installation actuelle): " +
      "(1) Présentation: petit boîtier économie d'électricité, plaquette du book. " +
      "(2) Proposition: Box Économie d'Énergie (jusqu'à -30% consommation électrique), 2 économiseurs d'eau " +
      "(robinets cuisine/salle de bain, jusqu'à -60% consommation d'eau), pack assistance complet (électricité, plomberie, chauffage), " +
      "jusqu'à 150€ par intervention, limite 3 interventions/an, valeur couverte 450€/an. " +
      '(3) Conservation: pas de changement de fournisseur, aucune modification technique, simple à installer en quelques minutes. ' +
      '(4) Accompagnement: un appel suffit, technicien envoyé si nécessaire. ' +
      "(5) Sans risque: 14 jours pour changer d'avis, support client, libre d'arrêter à tout moment. " +
      "(6) Souscription: 9,90€/mois, économies 16 à 29€/mois en moyenne, jusqu'à 348€/an.",
    expectedSignals:
      "\"Pack Depanssur / Depan'ssur\", \"Box Économie d'Énergie\", \"économiseurs d'eau\", \"9,90 euros par mois\", " +
      '"16 à 29 euros d\'économies", "348 euros par an", "150 euros par intervention", "3 interventions par an", ' +
      '"pack assistance électricité plomberie chauffage", "14 jours rétractation", "sans engagement".',
  },
  {
    ordre: 7,
    titre: 'Prise de RIB',
    poids: 10,
    description:
      'Demande naturelle du RIB en deux temps, formulée de façon affirmative (pas comme une question): ' +
      "(1) \"Au niveau des cotisations, vous voulez que ce soit fait sur quel compte ?\" → laisser le client répondre. " +
      "(2) \"Eh bien, il me faudrait juste les références de votre compte s'il vous plaît.\" " +
      'Si pas de RIB, on accepte l\'en-tête d\'un relevé de compte (nom/prénom + banque + IBAN). ' +
      'Le livret A (code guichet 00020) n\'est PAS accepté pour les prélèvements.',
    expectedSignals:
      '"au niveau des cotisations", "sur quel compte", "références de votre compte", "RIB", "IBAN", ' +
      '"relevé de compte", refus poli si livret A. Transition fluide, formulation affirmative (pas interrogative en fin).',
  },
  {
    ordre: 8,
    titre: 'Découverte télécom + offre France Téléphone',
    poids: 12,
    description:
      'Phase 8a — Découverte télécom: 7 questions (opérateur mobile et box internet, montant mensuel séparé, ' +
      "contenu du forfait (Go internet, appels illimités, etc.), consommation, hors-forfait, ancienneté/engagement, satisfaction). " +
      "Phase 8b — Argumentation Bleutel/France Téléphone en 6 étapes: partenariat avec Orange et Bouygues, " +
      'forfait moins cher avec services conservés ou améliorés, conservation numéro, portabilité gérée par le commercial, ' +
      'sans engagement, appel au 3179 ensemble pour vérifier éligibilité de la ligne. ' +
      'Forfaits disponibles: 1 Go/5,90€, 20 Go/9,90€, 100 Go/14,90€, 150 Go/19,90€, 200 Go/24,90€. ' +
      'Tous incluent appels SMS MMS illimités, eSIM disponible.',
    expectedSignals:
      "Questions opérateur (Orange, SFR, Bouygues, Free, Bleutel), forfait actuel, Go internet, prix mensuel. " +
      '"France Téléphone", "Bleutel", "partenaire Orange et Bouygues", "portabilité", "conserve votre numéro", ' +
      '"3179", "carte SIM / eSIM", "appels illimités", "SMS illimités", forfaits cités en euros TTC mensuels.',
  },
  {
    ordre: 9,
    titre: 'Vente Bleubox',
    poids: 8,
    description:
      'Argumentation 6-étapes pour Bleubox (alternative aux box fibre traditionnelles, fonctionne en 4G/5G): ' +
      "(1) Présentation: très haut débit sans intervention, sans frais d'installation. " +
      '(2) Proposition: Wi-Fi 6 double bande 2,4/5 GHz, jusqu\'à 32 appareils connectés, illimité, 4K, télétravail, ' +
      '2 ports Ethernet RJ45, carte SIM Bleubox incluse, 29,90€/mois (Bleubox 4G ou 4G/5G — la 5G ajoute 5€/mois). ' +
      '(3) Conservation: changement d\'opérateur en toute sérénité, juste insérer la carte SIM et brancher la box. ' +
      "(4) Accompagnement: mise en service immédiate sans technicien, guide d'installation rapide, assistance dédiée. " +
      '(5) Sans risque: 100% sans engagement, libre de partir, 14 jours de rétractation. ' +
      "(6) Souscription: démarche immédiate pour bénéficier de l'offre.",
    expectedSignals:
      '"Bleubox", "4G", "5G", "29,90 euros par mois", "Wi-Fi 6", "double bande", "32 appareils", "2 ports RJ45", ' +
      '"carte SIM Bleubox", "sans technicien", "sans engagement", "14 jours", "très haut débit", "fibre optique alternative".',
  },
  {
    ordre: 10,
    titre: 'Conciergerie Action Prévoyance',
    poids: 5,
    description:
      'Présentation du service Action Réduction (Action Prévoyance) à 14,90€/mois: ' +
      "(1) Présentation: jusqu'à 60% de réduction dans plus de 150 000 enseignes (supermarchés, carburant, " +
      'habillement, high-tech, billetterie, vacances, bien-être). ' +
      '(2) Proposition: assistant personnel à distance disponible pour réservations (restaurants, médecins, ' +
      "coiffeurs, hôtels, taxis), comparaison de prix, gestion d'agenda, rappels RDV, recherches pratiques. " +
      '(3) Sans risque: sans engagement de durée, délai de rétractation 14 jours. ' +
      "(4) Souscription: enregistrement immédiat, accès dans 14 jours minimum, avantages membres + assistant personnel.",
    expectedSignals:
      '"Action Prévoyance", "Action Réduction", "14,90 euros par mois", "150 000 enseignes", "60% de réduction", ' +
      '"assistant personnel", "réservations restaurants médecins coiffeurs", "comparaison de prix", ' +
      '"agenda RDV", "supermarchés carburant habillement", "14 jours rétractation".',
  },
  {
    ordre: 11,
    titre: 'Mondial TV — cadeau digital + Télécable',
    poids: 7,
    description:
      "Cadeau de fin de visite: 1 mois d'accès gratuit à Mondial TV (plateforme TV multi-écrans). " +
      '(1) Présentation: plus de 250 chaînes françaises et internationales, films/séries/documentaires/sport/jeunesse/infos, ' +
      'fonctionne sur téléphone, tablette, ordinateur ou box Wi-Fi à la TV, 5 appareils simultanés, sélection VOD. ' +
      '(2) Proposition: 1er mois offert pour tester, ensuite 9,90€/mois sans engagement, résiliation en 1 clic. ' +
      "(3) Action immédiate: ouverture d'un accès, scan QR code Playstore/Appstore, téléchargement de l'application, test ensemble. " +
      "(4) Télécable: programme TV papier offert 1 mois, 1,50€/semaine ensuite, résiliation par téléphone. " +
      "Demande de laisser un avis sur l'application.",
    expectedSignals:
      '"Mondial TV", "Mondial.tv", "1 mois gratuit", "250 chaînes", "VOD", "5 appareils simultanés", ' +
      '"9,90 euros par mois", "sans engagement", "résilier en 1 clic", "QR code", "Playstore", "Appstore", ' +
      '"Télécable", "1,50 euros par semaine", "programme TV", "laissez un avis".',
  },
]

async function main() {
  console.log('[seed-finanssor-sales-plan] début')

  // 1. Upsert SalesPlan
  const existing = await prisma.salesPlan.findFirst({
    where: { nom: PLAN.nom },
  })

  let plan
  if (existing) {
    console.log('[seed] SalesPlan existant trouvé id=' + existing.id + ', mise à jour description')
    plan = await prisma.salesPlan.update({
      where: { id: existing.id },
      data: { description: PLAN.description },
    })
  } else {
    plan = await prisma.salesPlan.create({
      data: {
        nom: PLAN.nom,
        description: PLAN.description,
        status: 'ACTIVE',
        createdByRole: 'admin',
        createdByUserId: 0,
      },
    })
    console.log('[seed] SalesPlan créé id=' + plan.id)
  }

  // 2. Upsert SalesPlanVersion (version 1)
  const existingVersion = await prisma.salesPlanVersion.findFirst({
    where: { salesPlanId: plan.id, versionNumber: VERSION.versionNumber },
  })

  let version
  if (existingVersion) {
    console.log('[seed] Version existante trouvée id=' + existingVersion.id + ', mise à jour')
    version = await prisma.salesPlanVersion.update({
      where: { id: existingVersion.id },
      data: {
        label: VERSION.label,
        status: VERSION.status,
        promptInstructions: VERSION.promptInstructions,
        publishedAt: existingVersion.publishedAt || new Date(),
      },
    })
  } else {
    version = await prisma.salesPlanVersion.create({
      data: {
        salesPlanId: plan.id,
        versionNumber: VERSION.versionNumber,
        label: VERSION.label,
        status: VERSION.status,
        promptInstructions: VERSION.promptInstructions,
        publishedAt: new Date(),
        createdByRole: 'admin',
        createdByUserId: 0,
      },
    })
    console.log('[seed] Version créée id=' + version.id)
  }

  // 3. Replace steps for this version
  console.log('[seed] suppression des steps existants pour version ' + version.id)
  await prisma.salesPlanStep.deleteMany({
    where: { salesPlanVersionId: version.id },
  })

  console.log('[seed] insertion de ' + STEPS.length + ' steps')
  for (const step of STEPS) {
    await prisma.salesPlanStep.create({
      data: {
        salesPlanVersionId: version.id,
        ordre: step.ordre,
        titre: step.titre,
        description: step.description,
        expectedSignals: step.expectedSignals,
        poids: step.poids,
      },
    })
    console.log('  - étape ' + step.ordre + '. ' + step.titre + ' (poids ' + step.poids + ')')
  }

  console.log('[seed-finanssor-sales-plan] OK — plan id=' + plan.id + ', version id=' + version.id)
}

main()
  .catch((err) => {
    console.error('[seed-finanssor-sales-plan] erreur:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
