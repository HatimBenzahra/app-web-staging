---
slug: finanssor-plan-de-vente
title: Plan de vente Groupe Finanssor — Version Telecom
version: 2
scoringScale: 100
language: fr
source: "Le plan de vente final (Groupe Finanssor) — Version Telecom, 26 slides"
context: >
  Prospection B2C en porte-à-porte pour le Groupe Finanssor, sous la marque France
  Téléphone. Un commercial sonne aux portes d'un immeuble (depuis le dernier étage à
  gauche) et déroule un plan de vente en phases : accroche à la porte sur les lignes
  téléphoniques, climat de confiance, découverte des besoins télécom, puis vente
  d'une ou plusieurs offres partenaires (mobile France Téléphone, pack Depanssur,
  box internet Bleubox, conciergerie Action Prévoyance, Mondial TV), prise de RIB,
  complétude, relecture du contrat sur tablette et confort de vente après signature.
  1 audio = 1 porte = 1 échange. Toutes les offres ne sont pas proposées à chaque
  porte : un module produit n'est évalué que s'il a été réellement abordé.
quality:
  # En-dessous de ces seuils, l'échange est jugé non exploitable / faible confiance.
  minDurationSec: 45          # < 45s d'échange réel → INEXPLOITABLE
  minTranscriptChars: 400     # transcript trop court → INEXPLOITABLE
  lowConfidenceBelowSec: 90   # < 90s → LOW_CONFIDENCE (score indicatif)

# --- MALUS DE CONFORMITÉ PRODUIT ---
# Retiré du score global après son calcul. Une violation n'est retenue que si
# l'affirmation du commercial contredit LA FICHE PRODUIT **ET** LE PLAN DE VENTE.
# Le silence n'est jamais une violation.
malus:
  grave: 15      # affirmation juridiquement fausse ou engagement impossible
  modere: 8      # chiffre, tarif ou périmètre inventé hors des deux référentiels
  maxTotal: 30   # plafond du malus cumulé sur une analyse

# --- GRILLE DE SCORING (vérité machine, lue par le backend) ---
# Le LLM juge chaque critère : status ∈ {atteint, partiel, absent, non_applicable} + preuve (citation).
# Le backend calcule : score = Σ(pointsObtenus × poidsÉtape) / Σ(poidsÉtapeApplicable) ramené sur 100.
# Seules les étapes applicables (always, ou appliesWhen satisfait) entrent au dénominateur.
# requiresProductSheet: true → critère jugé en passe 2, qui dispose de la fiche produit.
steps:
  - key: accroche
    label: Passage à la porte & accroche
    weight: 16
    appliesWhen: always
    criteria:
      - key: presentation
        label: Se présente clairement (France Téléphone / Groupe Finanssor), dynamique, souriant, directif
        points: 100
        evidenceRequired: true
        expectedSignals: ["bonjour madame", "bonjour monsieur", "c'est France Téléphone", "groupe finanssor", "on est chargé de voir"]
        negativeSignals: ["ne se présente pas", "hésitant", "agressif"]
      - key: phrase_accroche
        label: Déroule une phrase d'accroche maîtrisée (lignes téléphoniques, nouvelles tarifications revues à la baisse, « 2 petites minutes »)
        points: 100
        evidenceRequired: true
        expectedSignals: ["lignes téléphoniques", "nouvelles tarifications", "revues à la baisse", "2 petites minutes", "tout le monde dans l'immeuble"]
      - key: gestion_objection_porte
        label: Gère les objections réflexes à la porte pour obtenir l'entrée (absorbe, reformule, rebondit)
        points: 100
        expectedSignals: ["justement je suis là pour", "je ne vous ai encore rien expliqué", "si vous pouvez en bénéficier"]
        negativeSignals: ["argumente le produit à la porte", "abandonne à la première objection"]

  - key: climat_confiance
    label: Créer un climat de confiance
    weight: 12
    appliesWhen: always
    criteria:
      - key: ecoute_active
        label: Observe et écoute deux fois plus qu'il ne parle ; fait parler le prospect de lui
        points: 100
        expectedSignals: ["comment ça se passe pour vous", "questions ouvertes", "laisse parler"]
        negativeSignals: ["monologue", "coupe la parole"]
      - key: valorisation
        label: Valorise le prospect et complimente avec justesse, sans flatterie excessive
        points: 100

  - key: decouverte
    label: Découverte des besoins télécom
    weight: 14
    appliesWhen: always
    criteria:
      - key: operateur_et_prix
        label: Identifie l'opérateur actuel (mobile et box) et le montant payé mensuellement
        points: 100
        evidenceRequired: true
        expectedSignals: ["quel opérateur", "combien vous payez", "par mois"]
      - key: contenu_forfait
        label: Fait préciser le contenu du forfait (Go, appels illimités, hors forfait) et la consommation réelle
        points: 100
        expectedSignals: ["combien de go", "appels illimités", "hors forfait", "combien vous consommez"]
      - key: engagement_et_satisfaction
        label: Vérifie l'engagement en cours et la satisfaction (facture, qualité réseau, service client)
        points: 100
        expectedSignals: ["depuis combien de temps", "vous êtes engagé", "satisfait", "problème de réseau"]

  - key: prod_france_telephone
    label: "Produit : mobile France Téléphone"
    weight: 12
    appliesWhen: productDetected:france_telephone
    criteria:
      - key: ft_structure_6temps
        label: Déroule la trame en 6 temps (présentation, proposition chiffrée, conservation des services, accompagnement, sans risque, souscription)
        points: 100
        evidenceRequired: true
      - key: ft_comparaison_chiffree
        label: Compare le tarif actuel du prospect au nouveau tarif, services conservés ou améliorés
        points: 100
        evidenceRequired: true
        expectedSignals: ["aujourd'hui vous payez", "vous passerez à", "plus complet, moins cher"]
      - key: ft_portabilite_3179
        label: Explique la portabilité (numéro conservé, RIO au 3179, aucune coupure)
        points: 100
        expectedSignals: ["3179", "rio", "vous gardez votre numéro", "sans coupure"]
      - key: ft_conformite_points
        label: "CONFORMITÉ — a énoncé les points obligatoires du mobile : tarif, sans engagement, portabilité gratuite, droit de rétractation"
        points: 100
        requiresProductSheet: true

  - key: rib
    label: La prise de RIB
    weight: 8
    appliesWhen: always
    criteria:
      - key: demande_naturelle
        label: Demande le RIB en deux temps, de façon naturelle et affirmative (pas sous forme de question)
        points: 100
        expectedSignals: ["sur quel compte", "les références de votre compte"]
        negativeSignals: ["n'ose pas demander", "formule interrogative hésitante"]

  - key: prod_depanssur
    label: "Produit : Pack Depanssur"
    weight: 10
    appliesWhen: productDetected:depanssur
    criteria:
      - key: dep_structure_6temps
        label: Déroule la trame en 6 temps du pack Depanssur
        points: 100
        evidenceRequired: true
      - key: dep_equipements
        label: Présente les deux équipements (Box Économie Énergie, Kit Économie d'Eau) et l'assistance dépannage
        points: 100
        expectedSignals: ["box économie", "économiseur d'eau", "assistance", "électricité", "plomberie", "chauffage"]
      - key: dep_conformite_points
        label: "CONFORMITÉ — a énoncé les points obligatoires du pack : tarif mensuel, plafonds de prise en charge, sans engagement et rétractation"
        points: 100
        requiresProductSheet: true

  - key: prod_bleubox
    label: "Produit : Bleubox (internet 4G/5G)"
    weight: 10
    appliesWhen: productDetected:bleubox
    criteria:
      - key: bbx_structure_6temps
        label: Déroule la trame en 6 temps de la Bleubox
        points: 100
        evidenceRequired: true
      - key: bbx_installation_immediate
        label: Met en avant l'installation sans technicien ni travaux (brancher, insérer la SIM, connecter)
        points: 100
        expectedSignals: ["sans technicien", "sans travaux", "vous branchez", "carte sim"]
      - key: bbx_conformite_points
        label: "CONFORMITÉ — a énoncé les points obligatoires de la box : tarif mensuel, sans engagement, débit dépendant de la couverture"
        points: 100
        requiresProductSheet: true

  - key: prod_conciergerie
    label: "Produit : Conciergerie Action Prévoyance"
    weight: 8
    appliesWhen: productDetected:conciergerie
    criteria:
      - key: conc_presentation_service
        label: Présente les deux volets (assistant personnel à distance, réductions dans les enseignes partenaires)
        points: 100
        evidenceRequired: true
        expectedSignals: ["assistant personnel", "réservations", "réductions", "enseignes"]
      - key: conc_sans_risque
        label: Précise l'absence d'engagement de durée et le délai de rétractation
        points: 100
        expectedSignals: ["sans engagement", "rétractation", "14 jours"]

  - key: prod_mondial_tv
    label: "Produit : Mondial TV"
    weight: 8
    appliesWhen: productDetected:mondial_tv
    criteria:
      - key: mtv_presentation_service
        label: Présente Mondial TV comme un service de télévision connectée multi-écrans
        points: 100
        evidenceRequired: true
        expectedSignals: ["télévision connectée", "chaînes", "téléphone, tablette, ordinateur", "application"]
      - key: mtv_essai_offert
        label: Annonce le premier mois offert et la liberté de résilier
        points: 100
        expectedSignals: ["premier mois offert", "1 mois gratuit", "sans engagement", "résilier"]
      - key: mtv_conformite_points
        label: "CONFORMITÉ — a énoncé les 5 points obligatoires : prix, mois offert, sans engagement, internet indispensable, supports compatibles"
        points: 100
        requiresProductSheet: true

  - key: completude
    label: La complétude du contrat
    weight: 8
    appliesWhen: contractSigned
    criteria:
      - key: rigueur_saisie
        label: Complète le bulletin avec rigueur (informations exactes, deux numéros de téléphone, son nom sur le contrat)
        points: 100
        expectedSignals: ["deux numéros", "je note", "votre adresse exacte"]
      - key: coordonnees_verifiees
        label: Fait confirmer les coordonnées du client (nom, adresse, IBAN)
        points: 100
        evidenceRequired: true

  - key: relecture_tablette
    label: Validation et relecture sur tablette
    weight: 8
    appliesWhen: contractSigned
    criteria:
      - key: relecture_voix_haute
        label: Relit le contrat à voix haute avec le client, champ par champ, avant signature
        points: 100
        evidenceRequired: true
        expectedSignals: ["on va relire ensemble", "ligne par ligne", "avant signature", "tout est exact"]
      - key: signature_apres_validation
        label: Fait signer seulement après validation de chaque information
        points: 100

  - key: confort_vente
    label: Assurer le confort de vente (après signature)
    weight: 4
    appliesWhen: contractSigned
    criteria:
      - key: reste_apres_signature
        label: Reste avec le client après la signature pour sécuriser la vente et répondre aux questions
        points: 100
        negativeSignals: ["part précipitamment", "conclut et s'en va"]
---

# Plan de vente — Groupe Finanssor, version Telecom

Référentiel lisible. La grille machine est dans le frontmatter ci-dessus. Les sections
« Phase N — … » désignées par `pitchSection` sont **injectées au LLM en passe 2** :
elles constituent le second référentiel de la règle de conformité (une affirmation
n'est sanctionnée que si elle contredit la fiche produit **et** ce texte).

## Cadre & état d'esprit

La prospection est le cœur de la réussite : c'est la seule action qui garantit un flux
client régulier. Créneaux les plus efficaces : 11h00 → 14h00 et 16h00 → 19h00.

Les 8 PAS : attitude positive, ponctualité, préparation, travail efficace, garder son
attitude positive face au refus, opportunités et objectifs, responsabilité personnelle,
plein engagement.

L'outil SONCAS (Sécurité, Orgueil, Nouveauté, Confort, Argent, Sympathie) sert à tester
les réactions du prospect puis à se concentrer sur ses ressorts dominants.

## Phase 1 — La préparation

Outils remis par Finanssor : badge + tablette (visibles, l'identité du commercial est
déjà sur l'avis de passage), cahier de secteur, book de vente avec grille tarifaire.

Documents de souscription : demande d'adhésion France Téléphone Illimité, Depanssur,
Mondial TV, Assistance Conciergerie ; mandat SEPA ; lettre de résiliation assurance ;
tablette chargée ; connexion internet pour le partage.

## Phase 2 — Passage à la porte

80 % d'une vente se joue dans les 30 premières secondes. Commencer l'immeuble par le
dernier étage à gauche de l'escalier.

Phrase d'accroche :

> « Bonjour Monsieur/Madame, c'est France Téléphone, on passe suite à l'avis de passage
> qui a été affiché en bas, on est chargé de voir tout le monde dans l'immeuble.
> Concernant les lignes téléphoniques, j'en ai juste pour 2 petites minutes… »

Variante : « Je passe par rapport aux nouvelles tarifications qui sont revues à la baisse
à cause de la concurrence et je suis chargé de voir si vous pouvez en bénéficier. »

**On ne commence jamais une argumentation à la porte.** Technique de réponse aux
objections : absorber en allant dans le sens du client ou en reformulant, répondre ou
reprendre le contrôle par des questions fermées, puis enchaîner sur la phase 3.

## Phase 3 — Créer un climat de confiance

Briser la glace, instaurer un dialogue, se mettre en phase. S'intéresser sincèrement au
prospect, poser des questions ouvertes, le valoriser, complimenter avec justesse.
Deux yeux, deux oreilles, une seule bouche : observer et écouter deux fois plus que parler.

## Phase 4 — La découverte télécom

L'art de la vente, c'est l'art de poser les bonnes questions. À savoir : quel opérateur
pour le mobile et la box, combien il paye mensuellement (séparément), ce qui est compris
dans le forfait (Go, appels illimités), combien il consomme, depuis combien de temps et
s'il est engagé, s'il a du hors forfait, s'il est satisfait (facture, qualité du réseau,
service client). Faire une estimation sur la tablette.

## Phase 5 — L'argumentation

Transition entre la découverte et les modules produit. On argumente sur les avantages qui
intéressent réellement le prospect, à partir de ce qu'il a dit en phase 4.

## Phase 6 — Vente du mobile France Téléphone

**1) Présentation.** Nous sommes le groupe Finanssor, nous venons en aide à la population
pour réduire les factures (énergie, télécom, assurance) et nous avons créé France
Téléphone, en partenariat avec les réseaux Orange et Bouygues. Nous allons vous faire
économiser sur vos factures tout en conservant la qualité de votre réseau actuel, ou en
l'améliorant selon l'éligibilité.

**2) Proposition.** Aujourd'hui, vous payez XXXX €/mois pour votre forfait actuel.
Désormais, vous passerez à XXXX €/mois, tout en gardant ou en améliorant vos services :
appels illimités vers les fixes et mobiles en France, SMS/MMS illimités et XXXX Go
d'internet mobile. Plus complet, moins cher.

**3) Conservation des services.** Vous conservez votre numéro actuel, il n'y a aucun
changement pour vous. Vous continuez à appeler, envoyer des SMS ou aller sur internet
exactement comme aujourd'hui, mais en payant moins cher.

**4) Accompagnement / mise en service.** Vous n'avez rien à faire, je m'occupe de tout.
Je lance la demande de portabilité, vous recevez la nouvelle carte SIM et vous bénéficiez
au plus vite des nouveaux avantages, sans coupure de service.

**5) Sans risque.** C'est sans engagement. Vous testez, vous comparez. Si cela ne vous
convient pas, vous êtes libre de revenir en arrière à tout moment.

**6) Action immédiate / souscription.** Je vais appeler le 3179 avec vous, pour vérifier
ensemble l'éligibilité de votre ligne et vous faire bénéficier de l'offre dès maintenant.

## Phase 7 — La prise de RIB

La prise du RIB est indispensable, logique et évidente. En deux temps, de façon naturelle :

> « Au niveau des cotisations, vous voulez que ce soit fait sur quel compte ? »

Laisser le client répondre, puis :

> « Eh bien, il me faudrait juste les références de votre compte s'il vous plaît. »

À défaut de RIB : l'en-tête d'un relevé de compte, s'il porte nom, prénom, banque et IBAN.
Un livret A (code guichet 00020) n'est pas accepté pour un prélèvement.

## Phase 8 — Pack DEPANSSUR

Avez-vous reçu le petit boîtier pour faire des économies sur l'électricité ?
(Montrer la plaquette du book.)

**1) Présentation.** Vous allez bénéficier de réductions sur l'électricité et sur l'eau
grâce au pack Depanssur, 100 % compatible avec votre installation actuelle.

**2) Proposition.** Vous allez recevoir une Box Économie d'Énergie à brancher sur une
prise murale, qui vous permet de réguler la tension et de réduire votre consommation
électrique jusqu'à -30 %. Deux économiseurs d'eau, à installer sur vos robinets de la
cuisine et de la salle de bain, permettant jusqu'à -60 % d'économie sur votre consommation
d'eau. En plus de ça, vous bénéficiez d'un pack assistance complet (électricité,
plomberie, chauffage) couvrant jusqu'à 150 € par intervention, dans la limite de
3 interventions/an. Valeur totale couverte : 450 €/an.

**3) Conservation des services.** Vous ne changez pas de fournisseur, aucune modification
technique, le matériel est simple à installer en quelques minutes, sans travaux, et
compatible avec toutes les installations existantes.

**4) Accompagnement / mise en service.** Pour l'assistance, un simple appel suffit et un
technicien vous est envoyé si nécessaire. Vous êtes accompagné et vous réduisez vos factures.

**5) Sans risque.** Sans engagement, 14 jours pour changer d'avis, support client
disponible. Vous êtes libre d'arrêter à tout moment.

**6) Action immédiate / souscription.** Pour seulement 9,90 €/mois, vous réalisez en
moyenne entre 16 et 29 € d'économies par mois, soit jusqu'à 348 € par an. Je vais faire en
sorte que vous puissiez en bénéficier.

## Phase 9 — Vente de la Bleubox

**1) Présentation.** Découvrez Bleubox, l'alternative indépendante des réseaux d'internet
traditionnels. Grâce à la puissance du réseau 4G/5G, nous apportons le très haut débit
directement chez vous, sans intervention.

**2) Proposition.** Boostez votre connexion avec des hauts débits. La box intègre le
routeur Wi-Fi 6 et double bande 2,4/5 GHz pour une couverture optimale jusqu'à
32 appareils connectés. Internet en illimité pour streamer en 4K, télétravailler et jouer
en ligne sans coupure, avec 2 ports Ethernet RJ45 et carte SIM Bleubox incluse pour
seulement 29,90 €/mois.

**3) Conservation des services.** Changez d'opérateur en toute sérénité : continuité des
services sans interruption, connexion rapide, stable et illimitée. Aucune installation
complexe : insérer la carte SIM activée, brancher la box, être connecté.

**4) Accompagnement / mise en service.** Mise en service immédiate et sans frais de
technicien. Le pack inclut un guide d'installation rapide pour placer le routeur au
meilleur endroit (près d'une fenêtre) afin de capter le signal maximal. Assistance dédiée
pour optimiser le débit.

**5) Sans risque.** Offre 100 % sans engagement, avec 14 jours de rétractation.

**6) Action immédiate / souscription.** Regardons s'il reste des places pour que vous
puissiez bénéficier au plus vite de votre offre.

## Phase 10 — Conciergerie Action Prévoyance

**1) Présentation.** Vous allez bénéficier du service Action Réduction, qui vous permet
d'avoir des réductions dans plus de 150 000 enseignes.

**2) Proposition.** Pour 14,90 € par mois : un assistant personnel à distance pour vos
tâches du quotidien (réservations de restaurants, médecins, coiffeurs, hôtels, taxis,
comparaison de prix, gestion d'agenda), et un accès privilégié à des offres négociées
(supermarchés, carburant, habillement, high-tech, billetterie, vacances, bien-être),
en ligne ou en magasin.

**3) Sans risque.** Sans engagement de durée, avec un délai de rétractation de 14 jours.

**4) Action immédiate.** Je vous enregistre dès maintenant pour que vous receviez vos
identifiants au plus vite et que vous puissiez bénéficier de vos avantages membres.

## Phase 11 — Mondial TV, le cadeau digital

**1) Présentation.** Avant de terminer, j'ai un petit cadeau à vous offrir : 1 mois
d'accès gratuit à Mondial TV, notre plateforme de télévision multi-écrans.

**2) Proposition.** Avec Mondial TV, vous aurez plus de 250 chaînes françaises et
internationales : films, séries, documentaires, sport, jeunesse, infos. Cela fonctionne sur
téléphone, tablette, ordinateur, ou sur une box connectée en Wi-Fi à votre TV.

**3) Essai offert.** Le premier mois est offert pour tester librement, ensuite c'est
seulement 9,90 €/mois sans engagement. Vous gérez tout depuis votre espace client et vous
pouvez résilier à tout moment.

**4) Action immédiate / activation.** Je vais simplement vous demander l'ouverture d'un
accès pour que vous puissiez l'essayer au plus vite. On teste ensemble l'application.

**5) Télécable.** Je vais même faire en sorte que vous receviez le programme de télé,
pendant 1 mois gratuitement. Si ça vous plaît, vous le gardez, ça coûte à peine 1,50 € par
semaine, et si vous n'en voulez plus, par téléphone vous demandez qu'ils arrêtent.

## Phase 12 — La complétude

La complétude du contrat doit être réalisée avec attention afin de limiter le risque
d'erreur, donc de rejet par nos partenaires. Pas de rature, écriture lisible en majuscules,
nom du commercial sur le contrat. Prendre systématiquement deux numéros de téléphone pour
que le service adhérent puisse valider le contrat.

## Phase 13 — L'extranet, validation et relecture sur tablette

Vérifier ensemble chaque information affichée sur la tablette, valider visuellement les
données avant signature, garantir un parcours clair et sécurisé. Relire à voix haute
chaque champ, faire défiler lentement page par page, cocher les cases avec le client, puis
faire signer.

> « On va relire ensemble tout le contrat avant signature, pour vérifier que tout est
> exact, ligne par ligne. C'est important, et ça vous évite les mauvaises surprises. »

## Phase 14 — Assurer le confort de vente (après signature)

Ne jamais partir précipitamment. Rester 5 à 10 minutes avec le client pour créer un lien
de confiance durable, réduire les rétractations et finaliser une expérience positive.

> « Votre signature, c'est une chose. Mais la relation client, c'est ce qui fait toute la
> différence. »
