---
slug: bleubox
label: Bleubox (internet 4G/5G)
appliesTo: productDetected:bleubox
winleadplus:
  match: { fournisseur: "BLEUBOX" }
sttTerms:
  # Termes que la TRANSCRIPTION doit orthographier juste (noms de marque, sigles,
  # chiffres-clés). Injectés dans l'initial_prompt de Whisper, nulle part ailleurs.
  # Pas de français courant ici : ça n'aide pas le décodeur et ça sature le prompt.
  - "Bleubox"
  - "Wi-Fi 6"
  - "4G"
  - "5G"
  - "Mb/s"
  - "carte SIM"
identifiers:
  # Signaux de RECONNAISSANCE de l'offre pour la passe 0 (mapping), pas des
  # arguments de vente. Décrire ce qu'on entend dans l'échange plutôt que le nom
  # commercial seul : Whisper déforme régulièrement les noms de marque.
  - "une box internet qui passe par le réseau mobile 4G/5G, sans ligne fixe"
  - "le Wi-Fi de la box, les appareils connectés, les débits en mégabits"
  - "l'alternative à la fibre ou à la box de l'opérateur actuel"
facts:
  - "Bleubox est une box internet par les ondes : elle utilise le réseau mobile 4G/5G, pas une ligne fixe"
  - "Bleubox 4G : internet 4G illimité, Wi-Fi 6, jusqu'à 32 appareils connectés, 2 ports Ethernet, carte SIM incluse"
  - "l'option 5G est proposée EN SUPPLÉMENT : elle n'est pas incluse dans l'offre de base"
  - "débits : 50 à 150 Mb/s en 4G, 200 à 500 Mb/s en 5G — ce n'est pas de la fibre"
  - "les débits dépendent de la couverture : la 5G nécessite une couverture 5G"
  - "installation en quelques minutes : brancher sur une prise électrique, placer près d'une fenêtre, connecter les appareils. Aucun technicien, aucun travaux, aucun rendez-vous"
  - "sans engagement : le client reste libre à tout moment"
  - "droit de rétractation : 14 jours"
  - "matériel livré prêt à l'emploi, frais de port offerts ; en cas de panne, échange standard rapide ; restitution via bordereau prépayé"
  - "SAV basé en France"
  - "la box est mobile : le client peut l'emporter (résidence secondaire, déménagement, logement temporaire)"
  - "couverture : partout où il y a du signal 4G ; un test de couverture est prévu"
forbidden:
  # IDÉES que le produit ne peut pas porter — pas des phrases à retrouver mot pour
  # mot. Un commercial ne dira jamais « zéro reste à charge » tel quel ; il dira
  # « ça vous coûte rien de plus ». C'est l'idée qui compte, avec ses mots à lui.
  - { say: "laisser croire que la 5G est comprise dans l'offre de base alors qu'elle est en supplément", severity: grave }
  - { say: "présenter la Bleubox comme de la fibre, ou lui prêter les performances de la fibre", severity: grave }
  - { say: "garantir une connexion qui ne coupe jamais", severity: grave }
  - { say: "laisser croire que ça fonctionne partout, sans condition de couverture réseau", severity: grave }
  - { say: "annoncer un débit supérieur à ce que porte l'offre, ou le présenter comme garanti", severity: modere }
  - { say: "annoncer davantage d'appareils connectés que ce que supporte la box", severity: modere }
  - { say: "laisser croire qu'un technicien vient installer, alors que le client branche lui-même", severity: modere }
---

# Bleubox — fiche produit

L'internet moderne : **brancher, connecter, profiter.** Pas de technicien, pas de travaux,
pas d'attente. Bleubox apporte le haut débit par le réseau mobile 4G/5G.

## La gamme

| | Bleubox 4G | Option 5G |
|---|---|---|
| Prix | **29,90 € TTC / mois** | **en supplément** |
| Débit | 50 → 150 Mb/s | 200 → 500 Mb/s |
| Inclus | Wi-Fi 6, jusqu'à 32 appareils, 2 ports Ethernet, carte SIM | Débit boosté, quasi-fibre |

**Toutes les Bleubox** : sans engagement · carte SIM incluse · Wi-Fi 6 · activation immédiate.

## Ce que ce n'est pas

Bleubox **n'est pas de la fibre**. Le débit est largement suffisant pour le streaming 4K,
le télétravail et le gaming, et c'est immédiat, sans travaux — mais la comparaison
s'arrête là. Les débits **dépendent de la couverture** : la 5G exige une couverture 5G.

## L'installation, en moins de 5 minutes

1. Je branche — sur une simple prise électrique
2. Je place près d'une fenêtre — pour capter le meilleur signal
3. Je connecte mes appareils — Wi-Fi, Ethernet, scan QR
4. Internet fonctionne

## Matériel, SAV & rétractation

Matériel livré prêt à l'emploi, frais de port offerts · SAV basé en France ·
échange standard rapide en cas de panne · **rétractation 14 jours** ·
restitution simple via bordereau prépayé · **sans engagement**.

## Les objections

| Objection | Réponse |
|---|---|
| « Ce n'est pas de la fibre. » | Non, mais le débit suffit pour la 4K, le télétravail et le gaming — et c'est immédiat, sans travaux. |
| « Est-ce assez rapide ? » | 50 à 150 Mb/s en 4G, jusqu'à 500 Mb/s en 5G. Largement au-dessus de l'ADSL. |
| « Ça coupe ? » | Bleubox utilise les réseaux Orange et Bouygues, les mêmes qui couvrent les appels mobiles. |
| « Ça fonctionne partout ? » | Partout où il y a du signal 4G. Un test de couverture est prévu. |
| « C'est compliqué à installer ? » | Non : vous branchez, ça marche. Aucune compétence technique. |
