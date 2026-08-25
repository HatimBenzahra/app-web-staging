---
slug: depanssur
label: Pack Depanssur
appliesTo: productDetected:depanssur
# Rattachement à l'offre (résolution du tarif hors de cette fiche).
winleadplus:
  match: { fournisseur: "DEPANSSUR" }
sttTerms:
  # Termes que la TRANSCRIPTION doit orthographier juste (noms de marque, sigles,
  # chiffres-clés). Injectés dans l'initial_prompt de Whisper, nulle part ailleurs.
  # Pas de français courant ici : ça n'aide pas le décodeur et ça sature le prompt.
  - "Depanssur"
  - "Pack Depanssur"
  - "MesDépanneurs"
  - "MesDepanneurs.fr"
  - "Box Économie Énergie"
  - "Kit Économie d'Eau"
  - "ACS"
identifiers:
  # Signaux de RECONNAISSANCE de l'offre pour la passe 0 (mapping), pas des
  # arguments de vente. Décrire ce qu'on entend dans l'échange plutôt que le nom
  # commercial seul : Whisper déforme régulièrement les noms de marque.
  - "assistance dépannage du logement : électricité, plomberie, chauffage"
  - "la Box Économie Énergie et le Kit Économie d'Eau, remis avec l'abonnement"
  - "un plafond de prise en charge annuel par univers de panne"
  - "le partenaire d'intervention MesDépanneurs.fr"
facts:
  - "Depanssur est une assistance financière en cas de panne du logement — une assistance, PAS une assurance"
  - "abonnement mensuel unique, prélèvement mensuel, sans engagement de durée"
  - "frais de dossier éventuels annoncés à la souscription (minimum 20 €)"
  - "trois univers couverts : électricité, plomberie/eau, chauffage"
  - "plafond de prise en charge : 150 € par an et par univers, soit 450 € au total par an"
  - "au-delà du plafond, le dépassement reste à la charge du client ; service non consommé : aucune restitution"
  - "la prise en charge couvre déplacement, pièces et main-d'œuvre, selon les conditions du contrat"
  - "Box Économie Énergie : jusqu'à 30 % sur la consommation d'électricité, en fonction de l'utilisation ; stabilise la tension, protège les appareils"
  - "Kit Économie d'Eau : entre 30 % et 60 % d'économies d'eau, selon l'installation et les usages ; matériaux avec Attestation de Conformité Sanitaire (ACS)"
  - "le kit s'installe sur les robinets standards, une douche et le réservoir des toilettes"
  - "aucune promesse d'économie chiffrée en euros n'est prévue par la formation"
  - "partenaire d'intervention : MesDépanneurs.fr ; Depanssur reste l'interlocuteur unique, les professionnels sont indépendants"
  - "Depanssur n'est pas responsable des malfaçons des professionnels du réseau"
  - "le client doit contacter Depanssur AVANT toute intervention, sinon aucune assistance"
  - "le client doit être présent lors de l'intervention ; absence non justifiée : forfait de 60 €"
  - "un seul logement déclaré au contrat : ni parties communes, ni domaine public"
  - "exclus : fourniture et pose, travaux lourds, mise aux normes, rénovation, installation neuve, contrat d'entretien"
  - "rétractation : 14 jours à compter de la signature ; contrat à durée indéterminée, résiliable selon les conditions du contrat"
  - "date d'effet au premier prélèvement ; équipements expédiés sous 15 jours après ce prélèvement"
  - "service client : 01 70 13 24 41, du lundi au vendredi"
forbidden:
  # IDÉES que le produit ne peut pas porter — pas des phrases à retrouver mot pour
  # mot. Un commercial ne dira jamais « zéro reste à charge » tel quel ; il dira
  # « ça vous coûte rien de plus ». C'est l'idée qui compte, avec ses mots à lui.
  - { say: "présenter Depanssur comme une assurance, ou laisser le client le croire", severity: grave }
  - { say: "laisser croire que le client est couvert ou assuré, quel que soit le mot employé", severity: grave }
  - { say: "promettre une prise en charge intégrale, sans reste à charge possible", severity: grave }
  - { say: "promettre un remboursement automatique, sans passer par Depanssur ni par le contrat", severity: grave }
  - { say: "présenter la prise en charge comme illimitée ou sans plafond", severity: grave }
  - { say: "laisser croire que Depanssur refait, rénove ou met aux normes une installation", severity: grave }
  - { say: "annoncer une prise en charge au-delà de 150 € par univers, ou de 450 € par an", severity: modere }
  - { say: "annoncer une économie d'électricité supérieure à 30 %, ou la présenter comme certaine", severity: modere }
  - { say: "annoncer une économie d'eau supérieure à 60 %, ou la présenter comme certaine", severity: modere }
  - { say: "chiffrer en euros une économie que la formation ne chiffre pas", severity: modere }
---

# Pack Depanssur — fiche produit

**L'assistance qui protège le budget du logement quand une panne survient.** Un imprévu
mieux maîtrisé, une prise en charge claire et cadrée.

## Le positionnement : une assistance, pas une assurance

Depanssur = assistance financière en cas de panne du logement. Ce n'est **pas** une
assurance, **pas** de la rénovation, **pas** une garantie illimitée, **pas** un
remboursement automatique, **pas** du « zéro reste à charge ».

## Ce que contient le pack — 9,90 € TTC/mois

| Volet | Contenu |
|---|---|
| Assistance dépannage | Électricité, plomberie/eau, chauffage — jusqu'à 450 €/an |
| Box Économie Énergie | Réduire la consommation d'électricité |
| Kit Économie d'Eau | Réduire la consommation d'eau |

## Les plafonds, concrètement

**150 € par an et par univers** (électricité · plomberie/eau · chauffage), soit **450 €**
de prise en charge au total par an. Couvre déplacement, pièces et main-d'œuvre, selon
contrat. Au-delà du plafond, le dépassement reste à la charge du client.

*Exemple : intervention de plomberie 170 € → prise en charge 150 €, le client règle 20 €
au professionnel. Service non consommé : aucune restitution.*

## Les équipements

**Box Économie Énergie.** Se branche sur une prise et agit sur la qualité du courant pour
limiter les pertes d'énergie. Jusqu'à 30 % sur la consommation d'électricité, en fonction
de l'utilisation. Stabilise la tension, protège les appareils, voyant LED, sans entretien.

**Kit Économie d'Eau.** Mélange l'air et l'eau sous pression pour réduire le débit sans
perte de confort. S'installe sur les robinets standards, une douche et le réservoir des
toilettes. Entre 30 % et 60 % d'économies d'eau, selon l'installation et les usages.
Matériaux avec Attestation de Conformité Sanitaire (ACS).

## Le parcours d'assistance

1. Le client appelle Depanssur — **avant toute intervention**
2. Depanssur vérifie le contrat
3. Depanssur organise l'intervention
4. Un professionnel MesDépanneurs.fr intervient

Obligations du client : être présent lors de l'intervention, régler le dépassement
éventuel au professionnel, utiliser les équipements conformément à leur usage.
Absence non justifiée : forfait de 60 €.

## Les mots qui rassurent / les mots interdits

| À dire | À bannir |
|---|---|
| « assistance financière en cas de panne » | « c'est une assurance » |
| « selon les conditions du contrat » | « vous êtes couvert / assuré » |
| « dans la limite des plafonds » | « tout est remboursé » |
| « Depanssur n'est pas une assurance » | « zéro reste à charge » |
| « prise en charge commerciale » | « remboursement automatique » |
