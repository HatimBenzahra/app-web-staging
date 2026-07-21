---
slug: finanssor-plan-de-vente
title: Plan de vente Groupe Finanssor
version: 1
scoringScale: 100
language: fr
source: "Le plan de vente final (Groupe Finanssor) — 42 slides"
context: >
  Prospection B2C en porte-à-porte pour le Groupe Finanssor. Un commercial sonne
  aux portes d'un immeuble (depuis le dernier étage à gauche) et déroule un plan de
  vente en phases : accroche à la porte, création d'un climat de confiance,
  découverte des besoins, argumentation d'une ou plusieurs offres partenaires
  (énergie, télécom, box internet, TV, conciergerie, mutuelle, prévoyance,
  habitation, protection juridique), puis closing, prise de RIB, complétude et
  relecture du contrat. 1 audio = 1 porte = 1 échange. Toutes les offres ne sont
  pas proposées à chaque porte : un module produit n'est évalué que s'il a été
  réellement abordé pendant l'échange.
quality:
  # En-dessous de ces seuils, l'échange est jugé non exploitable / faible confiance.
  minDurationSec: 45          # < 45s d'échange réel → INEXPLOITABLE
  minTranscriptChars: 400     # transcript trop court → INEXPLOITABLE
  lowConfidenceBelowSec: 90   # < 90s → LOW_CONFIDENCE (score indicatif)

# --- GRILLE DE SCORING (vérité machine, lue par le backend) ---
# Le LLM juge chaque critère : status ∈ {atteint, partiel, absent, non_applicable} + preuve (citation).
# Le backend calcule : score = Σ(pointsObtenus × poidsÉtape) / Σ(poidsÉtapeApplicable) ramené sur 100.
# Seules les étapes applicables (always, ou appliesWhen satisfait) entrent au dénominateur.
steps:
  - key: accroche
    label: Passage à la porte & accroche
    weight: 16
    appliesWhen: always
    criteria:
      - key: presentation
        label: Se présente clairement (identité + Plénitude/Finanssor), dynamique, souriant, directif
        points: 100
        evidenceRequired: true
        expectedSignals: ["bonjour madame/monsieur", "je suis chargé de", "avis de passage affiché en bas", "plénitude", "finanssor"]
        negativeSignals: ["ne se présente pas", "hésitant", "agressif"]
      - key: phrase_accroche
        label: Déroule une phrase d'accroche maîtrisée (énergie/gaz, nouvelles tarifications, "2 petites minutes")
        points: 100
        evidenceRequired: true
        expectedSignals: ["électricité et le gaz", "nouvelles tarifications", "2 petites minutes", "tout le monde dans l'immeuble"]
      - key: gestion_objection_porte
        label: Gère les objections réflexes à la porte pour obtenir l'entrée (absorbe, reformule, rebondit)
        points: 100
        evidenceRequired: false
        expectedSignals: ["justement je suis là pour", "je ne vous ai encore rien expliqué", "au droit de bénéficier"]
        negativeSignals: ["argumente le produit à la porte", "abandonne à la première objection"]

  - key: climat_confiance
    label: Créer un climat de confiance
    weight: 14
    appliesWhen: always
    criteria:
      - key: ecoute_active
        label: Observe et écoute deux fois plus qu'il ne parle ; fait parler le prospect de lui
        points: 100
        expectedSignals: ["questions ouvertes", "comment ça se passe pour vous", "laisse parler"]
        negativeSignals: ["monologue", "coupe la parole"]
      - key: valorisation
        label: Valorise/complimente avec justesse, s'intéresse sincèrement, instaure un dialogue
        points: 100

  - key: decouverte
    label: Découverte des besoins
    weight: 20
    appliesWhen: always
    criteria:
      - key: questions_decouverte
        label: Pose les bonnes questions (fournisseur actuel, montant payé, satisfaction, ancienneté/engagement, consommation)
        points: 100
        evidenceRequired: true
        expectedSignals: ["quel fournisseur", "combien vous payez", "êtes-vous satisfait", "depuis combien de temps", "quel opérateur"]
      - key: identifie_besoins
        label: Identifie les besoins/insatisfactions exploitables et rebondit dessus pour argumenter
        points: 100
        negativeSignals: ["enquête de police", "questions sans exploitation"]

  - key: argumentation
    label: Argumentation & réponse aux objections
    weight: 20
    appliesWhen: always
    criteria:
      - key: argument_benefices
        label: Argumente en bénéfices client (économies chiffrées, mêmes services conservés, sans engagement, sans risque)
        points: 100
        evidenceRequired: true
        expectedSignals: ["réduction", "même compteur", "sans engagement", "14 jours de rétractation", "vous conservez"]
      - key: leviers_soncas
        label: Active des leviers SONCAS (Sécurité, Orgueil, Nouveauté, Confort, Argent, Sympathie)
        points: 100
      - key: reponse_objections
        label: Traite les objections (absorbe, reformule, questions fermées amenant le "oui", reprend le contrôle)
        points: 100

  - key: closing_rib
    label: Closing & prise de RIB
    weight: 16
    appliesWhen: always
    criteria:
      - key: action_immediate
        label: Pousse à l'action immédiate / souscription (mail, saisie, appel portabilité)
        points: 100
        expectedSignals: ["je m'occupe de tout", "dès maintenant", "je vais lancer", "on finalise ensemble"]
      - key: prise_rib
        label: Demande le RIB naturellement, en deux temps, de façon affirmative (pas une question)
        points: 100
        evidenceRequired: true
        expectedSignals: ["vous voulez que ce soit fait sur quel compte", "il me faudrait les références de votre compte"]

  - key: completude_validation
    label: Complétude & relecture du contrat
    weight: 9
    appliesWhen: contractSigned
    criteria:
      - key: relecture
        label: Relit le contrat avec le client, ligne par ligne, valide chaque info avant signature
        points: 100
        expectedSignals: ["on va relire ensemble", "vérifier que tout est exact", "ligne par ligne"]
      - key: rigueur_adv
        label: Rigueur ADV (2 numéros de téléphone, écriture lisible en majuscule, pas de rature, RIB obtenu)
        points: 100

  - key: posture
    label: Posture professionnelle & confort de vente
    weight: 5
    appliesWhen: always
    criteria:
      - key: honnetete
        label: Vente honnête et durable, devoir de conseil, s'assure que la cotisation rentre dans le budget du client
        points: 100
        negativeSignals: ["cotisation hors budget", "promesses fausses", "pression abusive"]
      - key: confort_apres_vente
        label: Après signature, reste 5-10 min pour rassurer et réduire la rétractation
        points: 100
        appliesWhen: contractSigned

  # ---- Modules produit : évalués uniquement si le produit est réellement abordé ----
  - key: prod_plenitude
    label: "Produit : Offre énergie Plénitude"
    weight: 10
    appliesWhen: "productDetected:plenitude"
    criteria:
      - key: structure_6temps
        label: Déroule la trame (présentation, proposition chiffrée -15% élec/-5% gaz, conservation compteur, accompagnement, sans risque, souscription)
        points: 100
        evidenceRequired: true

  - key: prod_depanssur
    label: "Produit : Pack Depanssur"
    weight: 8
    appliesWhen: "productDetected:depanssur"
    criteria:
      - key: structure_6temps
        label: Présente le pack (box économie -30% élec, économiseurs d'eau -60%, assistance), 9,90€/mois, sans risque, souscription
        points: 100
        evidenceRequired: true

  - key: prod_telecom
    label: "Produit : Télécom France Téléphone / Bleutel"
    weight: 9
    appliesWhen: "productDetected:telecom"
    criteria:
      - key: decouverte_telecom
        label: Découverte télécom (opérateur, prix, forfait, engagement) puis proposition forfait Bleutel adaptée
        points: 100
        evidenceRequired: true
      - key: rassurance_telecom
        label: Rassure (conserve le numéro, réseau Orange/Bouygues, sans engagement, portabilité gérée)
        points: 100

  - key: prod_bleubox
    label: "Produit : Bleubox (internet 4G/5G)"
    weight: 7
    appliesWhen: "productDetected:bleubox"
    criteria:
      - key: structure_bleubox
        label: Présente la Bleubox (29,90€/mois, Wi-Fi 6, installation simple, sans engagement, 14 jours)
        points: 100
        evidenceRequired: true

  - key: prod_conciergerie
    label: "Produit : Conciergerie Action Prévoyance"
    weight: 6
    appliesWhen: "productDetected:conciergerie"
    criteria:
      - key: structure_conciergerie
        label: Présente le service (assistant personnel, -60% dans 150 000 enseignes, 14,90€/mois, sans risque)
        points: 100
        evidenceRequired: true

  - key: prod_mondial_tv
    label: "Produit : Mondial TV"
    weight: 6
    appliesWhen: "productDetected:mondial_tv"
    criteria:
      - key: structure_mondial_tv
        label: Offre le cadeau (1 mois gratuit, 250+ chaînes, 9,90€/mois), fait tester l'app, propose l'avis / le télécable
        points: 100
        evidenceRequired: true

  - key: prod_mutuelle
    label: "Produit : Mutuelle santé (cabinet Action Prévoyance)"
    weight: 10
    appliesWhen: "productDetected:mutuelle"
    criteria:
      - key: decouverte_mutuelle
        label: Découverte santé (année de naissance, nb assurés, mutuelle actuelle + cotisation + engagement, besoins)
        points: 100
        evidenceRequired: true
      - key: proposition_2niveaux
        label: Présente les garanties ligne par ligne sur 2 niveaux (même garantie moins chère OU meilleure garantie même budget) ; jamais plus cher à date d'effet égale
        points: 100

  - key: prod_prevoyance
    label: "Produit : Prévoyance (IJH / Capital décès / Obsèques)"
    weight: 9
    appliesWhen: "productDetected:prevoyance"
    criteria:
      - key: ciblage_prevoyance
        label: Cible le bon produit (sans enfant→IJH ; avec enfant→capital décès ; +50 ans→obsèques) et argumente avec exemple concret
        points: 100
        evidenceRequired: true
      - key: budget_indolore
        label: S'assure que la cotisation rentre dans le budget et sera indolore (attention impayés/reprises de commission)
        points: 100

  - key: prod_habitation
    label: "Produit : Assurance habitation"
    weight: 6
    appliesWhen: "productDetected:habitation"
    criteria:
      - key: structure_habitation
        label: Découvre le contrat habitation actuel (cotisation, assureur, échéancier) et propose devis Neoliane/ECA moins cher à garanties égales
        points: 100
        evidenceRequired: true

  - key: prod_protection_juridique
    label: "Produit : Protection juridique"
    weight: 6
    appliesWhen: "productDetected:protection_juridique"
    criteria:
      - key: structure_pj
        label: Argumente la PJ (juriste dédié, couverture jusqu'à 40 000€/litige, 12,90€/mois fixe, sans franchise)
        points: 100
        evidenceRequired: true
---

# Plan de vente — Groupe Finanssor

> Référentiel commercial complet (porte-à-porte B2C). Sert de grille d'évaluation
> au coaching IA. Chaque phase décrit l'objectif, les atouts, les outils et le
> discours attendu. **Une vente honnête et durable** : la technique compte, mais la
> volonté, la posture et l'honnêteté font la différence.

## Cadre & état d'esprit

**Mission du commercial** : représenter le Groupe Finanssor et l'ensemble de ses
partenaires. Partenaires cités : France Téléphone, Mondial.tv, Depanssur, Plénitude,
OHM Énergie, Néoliane, Action Prévoyance, ECA, SFR.

**3 temps forts de la journée** : la formation, la prospection, la vente. *La
prospection est le cœur de la réussite* — c'est la seule action qui garantit un flux
client régulier. Créneaux les plus efficaces : matin 11h→14h, après-midi 16h→19h.

## Phase 1 — La préparation
Finanssor remet les outils du bon déroulement du travail :
- **Un badge + une tablette** : primordial, bien visible lors de la prospection (le
  prospect est informé de l'identité, déjà inscrite sur l'avis de passage).
- **Un cahier de secteur** : essentiel, reflète le sérieux du travail ; permet
  d'évoluer de façon constructive et ordonnée.
- **Un book de vente** : grille tarifaire + documents des compagnies partenaires.

**Documents nécessaires à la souscription** (dans les sacoches, sous forme papier) :
demande d'adhésion France Téléphone ILLIMITÉ, Depanssur, Mondial TV, Assistance
Conciergerie, ECA (IJH, Capital Décès, MRH, PJ) ; MANDAT SEPA (AP, FT, MTV, Depanssur,
ECA) ; lettre de résiliation assurance ; tablette chargée ; connexion internet pour
faire un partage.

## Phase 2 — Passage à la porte
Muni du cahier de secteur, reporter l'adresse et **toujours commencer la prospection
de l'immeuble depuis le dernier étage à gauche de l'escalier**. **80 % d'une vente se
joue dans les 30 premières secondes.**
- **But** : créer un climat de confiance et de sympathie, s'imposer ; l'introduction
  est une phase primordiale.
- **Atouts** : dynamique, enthousiaste mais directif ; souriant ; articuler, parler
  fort mais clairement.
- **Outils** : badge et tablette, avis de passage, cahier de secteur.
- S'entraîner impérativement pour maîtriser l'introduction et multiplier les
  argumentations (donc la production).

### Quoi dire ? (phrase d'accroche & objections)
- On ne commence **jamais** une argumentation à la porte. Si le prospect ne veut pas
  laisser entrer ou souhaite un RDV, demander à quel autre moment le rencontrer et le
  reporter sur le cahier de site.
- Exemple d'accroche : « Bonjour Monsieur/Madame, c'est **Plénitude**, on passe suite
  à l'avis de passage affiché en bas, on est chargé de voir tout le monde dans
  l'immeuble. Concernant **l'électricité et le gaz**, j'en ai juste pour 2 petites
  minutes… » → à cet instant on rentre dans l'appartement.
- Si « c'est pour quoi ? » : « Je passe par rapport aux **nouvelles tarifications**
  revues à la baisse à cause de la concurrence, je suis chargé de voir si vous pouvez
  en bénéficier, j'en ai juste pour 2 petites minutes… »
- Dans **80 % des cas**, le prospect répond par une objection « réflexe » (« Ça ne
  m'intéresse pas », « Je n'ai pas le temps », « Vous êtes là pourquoi exactement ? »).
  Technique de réponse quasi identique quelle que soit l'objection :
  1. **Absorber** l'objection (aller dans le sens du client / reformuler).
  2. **Répondre** ou reprendre le contrôle par des questions fermées amenant le « oui ».
  3. **Enchaîner** sur la phase 3 ou reprendre la phase d'accroche.
- Une fois rentré chez le client, 80 % de la vente est réussi. Savoir s'imposer est
  une qualité clé, tout en se mettant à l'écoute.

### Nos conseils pour augmenter vos chances
1. Soigner votre présentation. 2. Connaître par cœur votre phrase d'accroche.
3. Garder toujours le badge visible. 4. Avoir l'air sympathique (un grand sourire ne
coûte rien). 5. Être dynamique mais rester directif. *On n'a jamais deux fois
l'occasion de faire une bonne impression.*

## Phase 3 — À l'intérieur : créer un climat de confiance
« Nous avons deux yeux, deux oreilles, mais une seule bouche : observez et écoutez
deux fois plus que vous ne parlez. » Briser la glace, instaurer un dialogue, se
mettre en phase avec le prospect. Les 6 étapes :
1. **Valoriser le prospect** : montrer qu'on le respecte, que sa situation compte.
2. **S'intéresser sincèrement** à lui.
3. **Complimenter avec justesse** (un détail authentique, sans flatterie excessive).
4. **Poser des questions ouvertes** (« Comment ça se passe pour vous aujourd'hui ? »).
5. **Le faire parler de lui** : ses besoins, ses projets, ses frustrations éventuelles.
6. **Écouter vraiment.**

## Phase 4 — L'électricité et le gaz (découverte)
« L'art de la vente, c'est l'art de poser les bonnes questions. » Il ne s'agit pas de
faire une enquête de police. **But** : créer un dialogue, découvrir les besoins.
**Atouts** : attitude calme et souriante, intonation d'intérêt. **Outil** : la
mémoire. Objectif : se constituer un « stock » de questions utiles et pouvoir
argumenter. À savoir / avoir :
1. Quel fournisseur d'électricité et de gaz ?
2. Combien il paye (séparément) ?
3. Chauffage individuel au gaz ?
4. Combien il consomme ?
5. Satisfait ou problèmes (facture/prix, qualité réseau, service client) ?
6. Depuis combien de temps a-t-il son contrat ?
7. Demander la facture (ou au moins accès PCE et PDL). **Faire une estimation sur la
   tablette.**

## Phase 5 — Offre Plénitude
Partenaire d'énergie **Plénitude** (filiale du groupe ENI). Trame en 6 temps :
1. **Présentation** : baisser les factures gaz/électricité en conservant le même
   compteur, sans changement d'installation.
2. **Proposition** : offre claire et plus économique — **15 % de réduction sur
   l'électricité et 5 % sur le gaz**, tarif bloqué 1 / 2 an(s), même énergie moins
   chère, suivi personnalisé.
3. **Conservation des services** : même compteur, réseau Enedis / GRDF, c'est juste
   la facture qui baisse.
4. **Accompagnement / mise en service** : « je m'occupe de tout » — zéro coupure,
   zéro frais cachés, zéro stress.
5. **Sans risque** : sans engagement, libre de revenir, confirmation écrite,
   **14 jours de rétractation**.
6. **Action immédiate / souscription** : envoi d'un mail, le client suit les
   instructions pour finaliser et économiser dès la prochaine facture.

## Phase 6 — Pack Depanssur
1. **Présentation** : pack Depanssur 100 % (box d'économie d'énergie), compatible
   avec l'installation actuelle. (Montrer la plaquette du book.)
2. **Proposition** : Box Économie d'Énergie sur prise murale (jusqu'à **-30 %**
   électricité), 2 économiseurs d'eau (jusqu'à **-60 %** sur l'eau), pack assistance
   (électricité, plomberie, chauffage) couvrant jusqu'à 150 €/intervention, 3
   interventions/an, valeur totale couverte 450 €/an.
3. **Conservation** : pas de changement de fournisseur, aucune modification technique,
   installation en quelques minutes.
4. **Accompagnement** : un appel suffit, un technicien envoyé si nécessaire.
5. **Sans risque** : sans engagement, 14 jours, support client, arrêt libre.
6. **Action immédiate / souscription** : **9,90 €/mois**, économies moyennes 16 à
   29 €/mois soit jusqu'à 348 €/an.

## Phase 7 — La prise de RIB
La prise du **RIB** est indispensable, logique et évidente. La demander de façon
naturelle **en deux temps** ; enchaîner avec une dernière phrase **affirmative** (pas
une question) :
- « Au niveau des cotisations, vous voulez que ce soit fait sur quel compte ? » →
  laisser le client répondre → « Eh bien, il me faudrait juste les références de votre
  compte s'il vous plaît. »
- À défaut de RIB : en-tête d'un relevé de compte (nom/prénom, logo/domiciliation
  banque, IBAN). Un compte « livret A », code guichet 00020, n'est pas accepté pour
  les prélèvements.

## Phase 8 — Télécom (France Téléphone)
### Découverte télécom
Mêmes principes que la découverte énergie. À savoir / avoir :
1. Quel opérateur mobile et box internet ? 2. Combien il paye mensuellement
(séparément) ? 3. Qu'est-ce qui est compris dans le forfait (Go, appels illimités…) ?
4. Combien il consomme ? 5. A-t-il du hors forfait ? 6. Depuis combien de temps et
engagé ? 7. Satisfait ou problèmes (facture/prix, qualité réseau, service client) ?
**Faire une estimation sur la tablette.**

### Argumentation — Bleutel by France Téléphone (forfait illimité)
Réseau Orange / Bouygues, sans engagement, conservation du numéro, cartes eSIM,
facture détaillée gratuite. **Forfaits mobiles** : 1 Go 5,90 € · 20 Go 9,90 € · 100 Go
14,90 € · 150 Go 19,90 € · 200 Go 24,90 € (TTC/mois).

### Vente du produit France Téléphone (6 temps)
1. **Présentation** : groupe Finanssor, France Téléphone en partenariat avec Orange
   et Bouygues, économiser en conservant/améliorant le réseau selon l'éligibilité.
2. **Proposition** : « aujourd'hui vous payez X €/mois → désormais Y €/mois » ; appels
   illimités fixes/mobiles France, SMS/MMS illimités, Go d'internet — plus complet,
   moins cher.
3. **Conservation** : conserve le numéro, aucun changement, mais moins cher.
4. **Accompagnement / mise en service** : « je m'occupe de tout », demande de
   portabilité, nouvelle carte SIM, sans coupure.
5. **Sans risque** : sans engagement, teste, compare, libre de revenir en arrière.
6. **Action immédiate / souscription** : appeler le **3179** avec le client pour
   vérifier l'éligibilité et bénéficier de l'offre.

## Phase 9 — Bleubox (internet 4G/5G)
Internet rapide à la maison sans engagement. **Bleubox 4G** 29,90 €/mois ;
**Bleubox 4G/5G** 29,90 €/mois (+5 €/mois de location de matériel, soit 34,90 €/mois).
Wi-Fi 6 double bande 2,4/5 GHz, jusqu'à 32 appareils, 2 ports Ethernet RJ45, carte SIM
incluse. Trame 6 temps :
1. **Présentation** : alternative indépendante des réseaux internet traditionnels,
   très haut débit 4G/5G sans intervention.
2. **Proposition** : hauts débits, Wi-Fi 6, streaming 4K/télétravail, 29,90 €/mois.
3. **Conservation** : continuité des services, installation simple (insérer la SIM,
   brancher la box).
4. **Accompagnement / mise en service** : immédiate, sans frais de technicien, guide
   d'installation, assistance dédiée.
5. **Sans risque** : 100 % sans engagement, 14 jours de rétractation.
6. **Action immédiate / souscription** : faire la demande sans tarder.

## Phase 10 — Conciergerie Action Prévoyance
1. **Présentation** : service Action Réduction — jusqu'à **60 %** de réduction dans
   plus de 150 000 enseignes.
2. **Proposition** : pour **14,90 €/mois**, assistant personnel à distance
   (réservations restaurants/médecins/coiffeurs/hôtels/taxis, comparaison de prix,
   gestion d'agenda, rappels de RDV) + accès privilégié à des offres négociées
   (supermarchés, carburant, habillement, high-tech, billetterie, vacances,
   bien-être — jusqu'à -60 %, en ligne ou en magasin).
3. **Sans risque** : sans engagement de durée, 14 jours de rétractation.
4. **Action immédiate / souscription** : enregistrement immédiat, réception des
   identifiants (14 jours minimum) et des avantages membres.

## Phase 11 — Mondial TV (cadeau digital + télécable)
1. **Présentation** : petit cadeau — **1 mois d'accès gratuit** à Mondial TV,
   plateforme de télévision multi-écrans (200+ chaînes TV, VOD, 5 appareils simultanés).
2. **Proposition** : 250+ chaînes françaises et internationales (films, séries, sport,
   jeunesse, infos), fonctionne sur téléphone/tablette/ordinateur/box Wi-Fi.
3. **Essai offert** : 1er mois offert, puis **9,90 €/mois** sans engagement, résiliable
   en 1 clic.
4. **Action immédiate / activation** : ouvrir un accès pour tester au plus vite.
5. **Télécable** : recevoir le programme télé pendant 1 mois gratuitement ; ensuite
   **1,50 €/semaine** ; arrêt par téléphone.
- **On teste ensemble l'application** : scanner le QR code (Play Store / App Store),
  télécharger l'application, laisser un avis.
- **Stratégie commerciale des avis** : 1 avis validé = **chèque-cadeau de 10 €** pour
  le commercial (10 avis = 100 €). Traçabilité : le client doit **mentionner le prénom
  du commercial** dans le texte de l'avis (ex. « Super application… Merci à Sophie
  pour sa démonstration ! »).

## Phase 12 — La complétude
La complétude du contrat doit être réalisée avec beaucoup d'attention pour limiter le
risque d'erreur (et donc le rejet des partenaires). **But** : remplir le bulletin de
souscription, obtenir le RIB. **Atouts** : attitude au moindre détail, appliqué,
directif. **Outil** : bulletin de souscription. Prendre systématiquement **deux
numéros de téléphone**. Règles de base :
1. **Pas de rature** sur le contrat.
2. Écrire de façon **lisible** (en **majuscule**).
3. Écrire **votre nom** (commercial) sur le contrat — pas de nom = aucune
   identification. *Vous êtes le seul garant de la qualité de vos contrats.*

## Phase 13 — L'extranet
Outil CRM interne (connexion, gestion des prospects, saisie des infos prospect /
paiement / production, sélection des formules TELECOM / ÉNERGIE / ASSISTANCE / TV /
Télécable). Support de saisie des affaires — n'est pas une technique de discours.

## Phase 14 — Vente de mutuelle
**Cible** : toutes les personnes qui n'ont **pas de CMU ni de mutuelle d'entreprise**.
Si hors cible, argumenter sur la prévoyance et/ou l'IARD. **Laissez parler.** Angle :
la Sécurité sociale se désengage, les mutuelles répercutent les hausses — « Avez-vous
constaté une augmentation de votre cotisation santé ? Vous êtes chez quelle mutuelle ?
Avez-vous votre carte ? »

### Phase 14.1 — La découverte (mutuelle)
À savoir pour établir une proposition (par adhérent) : 1. Année de naissance. 2. Nombre
de personnes assurées. 3. Mutuelle actuelle + engagement (date d'effet) + montant de
la cotisation mensuelle. 4. Besoins santé : hospitalisation, consultation
généraliste/spécialiste, optique, dentaire, prothèse auditive, traitement
particulier/maladie chronique.

### Phase 14.2 — Présentation du cabinet Action Prévoyance
Cabinet affilié à plusieurs mutuelles, aide les personnes sans mutuelle ou payant trop
cher. **5 meilleures compagnies** mises en concurrence selon la situation/les besoins.
Présenter les plaquettes face au client (crédibiliser par le visuel), garanties **ligne
par ligne**, choix sur **2 niveaux** : (1) même garantie moins chère OU meilleure
garantie à budget égal ; (2) orienter le client en lui laissant le choix. La « mise
dans le contexte » projette le client et le convainc. **Ne jamais proposer un contrat
santé plus cher à date d'effet égale.**

### Phase 14.3 — La date d'effet du contrat
À effet immédiat ; rétractation 14 jours à compter de la date de signature. L'assureur
concurrent peut inciter à se rétracter. Reprises Loi Hamon : chronologie à respecter
(« J » = date de signature).
- **Si pas de mutuelle** : entre le 01 et le 15 du mois → date d'effet au 01 pour ECA
  (à condition d'enregistrement avant le 15) ; **Néoliane** : uniquement 3 jours après
  la saisie informatique.
- **Si mutuelle** : voir les possibilités de résiliation et mettre la date d'effet au
  plus proche de la date d'échéance.

### Phase 14.4 — La résiliation du contrat actuel
Dicter au client les informations de sa carte assurée (pas d'erreur), mais c'est au
client d'écrire sa lettre. C'est Finanssor qui se charge de la résiliation/de l'envoi.
- **Mutuelle santé / prévoyance (hors obsèques)** — 3 cas : (1) échéance principale
  (résiliation 2-3 mois avant l'anniversaire) ; (2) Loi Chatel (jusqu'à 20 jours après
  réception de l'échéancier) ; (3) Loi infra-annuelle (après 1 an, à tout moment,
  préavis 30 jours).
- **Assurance auto/habitation** — 3 cas : (1) échéance principale (préavis 2-3 mois) ;
  (2) Loi Chatel (20 jours) ; (3) Loi infra-annuelle (après 1 an, effet J+30 dès
  réception, avec justificatif).

## Phase 15 — Vente prévoyance (ECA / Néoliane)
### A) Cible prospect sans enfant : Indemnité Journalière Hospitalisation (IJH)
« Bénéficiez-vous de l'aide en cas d'hospitalisation ? » — dans 80 % des cas le
prospect répond NON. Aide financière (ECA/Néoliane) versant des indemnités
journalières en cas d'hospitalisation (accident ou maladie), jusqu'à **200 €/jour**.
Exemple concret : 20 jours d'hospitalisation × 200 € = 4 000 € — cet argent vous
appartient, contrairement à la mutuelle qui ne rembourse que les soins.
- **Grille IJH (cotisation mensuelle selon âge / capital jour)** :
  - 18-39 ans : 20 €/j NÉANT · 40 €/j 10,10 · 60 €/j 14,20 · 80 €/j 18,25 · 100 €/j 22,30
  - 40-50 ans : 08,05 · 14,15 · 20,20 · 26,30 · 32,35
  - 50-60 ans : 10,75 · 19,50 · 28,25 · 37,00 · 45,75
  - 60-65 ans : 15,65 · 29,30 · 43,00 · 56,65 · 70,30
  - Couverture hospitalisation journalière accidentelle et maladie, indemnités versées
    365 jours, capital de 20 à 100 €/j, aucune formalité médicale, souscription 18-65
    ans, jusqu'à 75 ans, réduction couple 10 %, allocation exonérée d'impôts, cumulable.

### B) Cible prospect avec enfant : Capital Décès Accident / Décès Toutes Causes
« Qu'avez-vous mis en place pour protéger vos enfants s'il vous arrivait quelque
chose ? » Capital jusqu'à **150 000 €**, accessible **dès 6 €/mois**.
- **Grille Capital Décès - Invalidité (cotisation selon âge / capital)** :
  - 18-64 ans : 20 000 € 06,17 · 50 000 € 10,92 · 70 000 € 13,08 · 100 000 € 18,83 ·
    130 000 € 23,58 · 150 000 € 26,75
  - 65-70 ans : 08,00 · 15,50 · 20,50 · 28,00 · 35,50 · 40,50
  - Versement d'un capital en cas de décès ou perte totale/irréversible (accident) ;
    capital 10 000 à 150 000 € ; aucune formalité médicale ni délai d'attente ;
    souscription 18-70 ans ; couverture PTIA jusqu'à 65 ans, décès accidentel jusqu'à
    80 ans ; réduction couple 15 % ; exonérée d'impôts ; cumulable.

### C) Cible prospect + 50 ans : Garantie Obsèques
« Qu'avez-vous mis en place pour protéger vos proches ? » Obsèques : en moyenne
**4 000 € à 6 000 €**. Anticiper : plus on s'y prend tôt, moins on paie. Garanties
viagères, cotisations fixes à vie, bénéficiaires désignés librement (proche ou pompes
funèbres). Avantage : valeur de rachat (pas à fonds perdus).
- Si le prospect a déjà un contrat obsèques (et cotise encore) : **mise en réduction**
  (arrêter de cotiser en restant assuré, capital recalculé selon la valeur de rachat)
  — protège contre le défaut de conseil (délai d'attente d'un an en cas de décès par
  maladie).

### Le rachat du contrat
Le souscripteur peut mettre fin au contrat en le rachetant et percevoir un capital
immédiatement, selon : l'âge à la souscription, le nombre de cotisations versées, les
frais de sortie, les modalités propres à chaque prestataire. **Attention : la mise en
rachat entraîne l'arrêt de la garantie.**

> Pour toute prévoyance : **s'assurer que la cotisation rentre dans le budget du client
> et sera indolore** (attention aux impayés et aux reprises de commissions).

## Phase 16 — Vente habitation
« Avez-vous entendu parler des réformes du logement ? » Les contrats d'assurance
habitation sont quasi obligatoires et se ressemblent (dégâts des eaux, incendie, bris
de glace, cambriolage…) — la seule différence est le prix. Découverte : 1. réforme
permettant de réduire les cotisations ; 2. combien cotise-t-il/mois, combien de pièces,
quel assureur ; 3. échéancier/attestation (ou relevé de compte pour vérifier le tarif) ;
4. informer qu'il peut réduire ses cotisations. **Faire un devis sur Néoliane ou ECA** :
mêmes garanties, moins cher (« Assurance de l'Europe »), et Finanssor gère la bascule.

### Phase 16.1 — Résiliation du contrat actuel (habitation)
- **Contrats protection juridique** — 2 possibilités : à l'échéance principale ; par
  la Loi Chatel.
- **Contrats habitation** — 3 possibilités : (1) échéance principale (lettre 3 mois
  avant renouvellement) ; (2) Loi Chatel (20 jours après réception du nouvel
  échéancier) ; (3) Loi Hamon (au-delà de la 1re échéance anniversaire, résiliation à
  tout moment, effet J+45 dès réception LRAR + nouvelle attestation). Finanssor gère la
  résiliation ; remplir la lettre destinée à ECA Assurances (coordonnées compagnie + n°
  de contrat).

## Phase 17 — Protection juridique
« Si vous avez un litige avec un voisin, un artisan, un site internet, votre
employeur… qui vous défend ? 7 Français sur 10 y sont confrontés au moins une fois. »
- Juriste expert au téléphone, prise en charge des frais (amiable ou tribunal), avocat
  libre, couvert **jusqu'à 40 000 € par litige**.
- Concerne tout : litige voisin/artisan/employeur/administration/école, livraison non
  conforme, arnaque e-commerce, e-réputation, usurpation d'identité, succession,
  travaux, santé, consommation, logement, famille…
- Sans franchise, juriste dédié, zéro avance de frais. **Prix fixe 12,90 €/mois** (toute
  la famille, même en cas de divorce ou succession). Défense qui peut éviter des
  milliers d'euros et beaucoup de stress.

## Phase 18 — Validation et relecture sur tablette
**Objectifs** : (1) vérifier ensemble chaque information affichée sur la tablette ;
(2) valider visuellement avec le client les données avant signature ; (3) garantir un
parcours 100 % clair, fluide et sécurisé. **Atouts** : attitude au moindre détail,
appliqué, directif. **Outils** : tablette, bulletin de souscription numérique, mandat
SEPA à signer, résumé des options + tarifs, CGV en PDF intégrées.
- Concrètement : relire à voix haute chaque champ du contrat, faire défiler lentement
  page par page, cocher les cases avec le client (valider/corriger), puis faire signer
  à l'écran une fois tout validé.
- Phrase type : « On va relire ensemble tout le contrat avant signature, pour vérifier
  que tout est exact, ligne par ligne. C'est important, et ça vous évite les mauvaises
  surprises plus tard. »

## Phase 19 — Assurer le confort de vente (après signature)
**Ne partez jamais précipitamment !** Une fois le contrat signé, rester **5 à 10
minutes** pour : créer un lien de confiance durable, réduire fortement les
rétractations, finaliser une expérience d'achat positive.
- Rôle de professionnel : rester informé des offres concurrentes, maîtriser son marché
  local, connaître ses produits sur le bout des doigts, être irréprochable dans sa
  posture (devoir de conseil), profiter du moment pour compléter sa formation.
- Phrase clé : « Votre signature, c'est une chose. Mais la relation client, c'est ce
  qui fait toute la différence. »

## Les 8 PAS (état d'esprit)
1. **Attitude positive** — démarrer sa journée de façon ambitieuse (le succès dépend à
   90 % de l'état d'esprit). 2. **Ponctualité** — agir au bon moment, être au
   rendez-vous. 3. **Préparez-vous bien** — à votre secteur, aux négatifs, aux positifs.
   4. **Travail efficace** — ouverture d'esprit, chaque personne est un client potentiel.
   5. **Gardez votre attitude positive** — chaque client a le droit de refuser ; la
   politesse est toujours payante. 6. **Opportunités et objectif** — objectifs court/
   moyen/long terme ; les obstacles sont des défis. 7. **Responsabilité personnelle** —
   autocritique, contrôler apparence/comportement/performances. 8. **Plein engagement**
   — le succès dépend de l'engagement.

## L'outil SONCAS (déclencher l'achat)
Méthode de négociation la plus connue. **SONCAS** = **S**écurité, **O**rgueil,
**N**ouveauté, **C**onfort, **A**rgent, **S**ympathie — les préoccupations de base d'un
client. Tester les réactions du client sur ces 6 points, puis se concentrer sur les
plus importants ; chaque réponse obtenue est un « point d'appui » pour l'argument.
- **Sécurité** : besoin d'être rassuré (qualité, conformité aux normes, adéquation aux
  besoins). **Orgueil** : image valorisante, produit populaire/enviable. **Nouveauté** :
  innovation, solutions inédites, produit moderne. **Confort** : facilité
  d'utilisation. **Argent** : prix, meilleur rapport qualité/prix, moins cher.
  **Sympathie** : rapport affectif au produit/vendeur.

---

> **Clôture** : « Groupe Finanssor vous souhaite une longue et brillante carrière. »
