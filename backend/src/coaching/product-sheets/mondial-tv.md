---
slug: mondial-tv
label: Mondial TV
appliesTo: productDetected:mondial_tv
winleadplus:
  match: { fournisseur: "MONDIAL TV" }
sttTerms:
  # Termes que la TRANSCRIPTION doit orthographier juste (noms de marque, sigles,
  # chiffres-clés). Injectés dans l'initial_prompt de Whisper, nulle part ailleurs.
  # Pas de français courant ici : ça n'aide pas le décodeur et ça sature le prompt.
  - "Mondial TV"
  - "OTT"
  - "télévision connectée"
identifiers:
  # Signaux de RECONNAISSANCE de l'offre pour la passe 0 (mapping), pas des
  # arguments de vente. Décrire ce qu'on entend dans l'échange plutôt que le nom
  # commercial seul : Whisper déforme régulièrement les noms de marque.
  - "un bouquet de chaînes de télévision, françaises et internationales"
  - "la télévision par application ou par internet, sans parabole ni décodeur"
  - "le premier mois offert sur l'abonnement TV"
facts:
  - "Mondial TV est un service de télévision connectée (OTT) : chaînes en direct et contenus, via une application ou un accès web"
  - "le premier mois est offert, puis un abonnement mensuel sans engagement"
  - "sans engagement ; résiliation possible selon les modalités en vigueur de Mondial TV"
  - "plus de 200 chaînes françaises et internationales, SELON LE CATALOGUE et les droits de diffusion en vigueur"
  - "le catalogue peut évoluer : ne jamais promettre une chaîne précise sans vérifier la liste à jour"
  - "une connexion internet est indispensable : sans internet, le service ne fonctionne pas"
  - "Mondial TV ne remplace pas un abonnement internet — c'est un service complémentaire, pas un fournisseur d'accès"
  - "la qualité dépend de la connexion du client (débit, stabilité) : aucune qualité ne peut être garantie"
  - "supports : smartphone et tablette via l'application, ordinateur via l'accès web, téléviseur via stick TV ou box connectée, SELON COMPATIBILITÉ"
  - "aucune compatibilité universelle avec tous les appareils ne peut être promise"
  - "les applications tierces (Netflix, Disney+, myCanal, bouquet beIN Sports premium) ne sont NI FOURNIES NI FACTURÉES par Mondial TV : elles s'utilisent avec les identifiants et l'abonnement personnels du client"
  - "une chaîne en clair ou d'information n'est pas le bouquet premium correspondant"
  - "les cinq points à toujours expliquer : le prix, le mois offert, le sans engagement, le besoin d'internet, les supports compatibles"
  - "produit non adapté à une personne sans connexion internet, ni à une personne vulnérable sans capacité de consentement clair"
  - "les coordonnées du service client ne sont communiquées qu'une fois validées par la direction"
forbidden:
  # IDÉES que le produit ne peut pas porter — pas des phrases à retrouver mot pour
  # mot. Un commercial ne dira jamais « zéro reste à charge » tel quel ; il dira
  # « ça vous coûte rien de plus ». C'est l'idée qui compte, avec ses mots à lui.
  - { say: "laisser croire qu'un service de streaming payant (Netflix, Disney+, Canal+, beIN…) est compris", severity: grave }
  - { say: "laisser croire que les chaînes payantes sont comprises dans l'abonnement", severity: grave }
  - { say: "laisser croire que le service fonctionne sans connexion internet", severity: grave }
  - { say: "présenter Mondial TV comme un remplacement de l'abonnement internet du client", severity: grave }
  - { say: "garantir une qualité d'image parfaite quelles que soient les conditions", severity: grave }
  - { say: "présenter le catalogue de chaînes comme définitif et non susceptible d'évoluer", severity: grave }
  - { say: "garantir la présence d'une chaîne précise sans avoir vérifié le catalogue à jour", severity: modere }
  - { say: "annoncer un nombre de chaînes supérieur à ce que porte le catalogue", severity: modere }
  - { say: "annoncer plus d'un mois offert", severity: modere }
---

# Mondial TV — fiche produit

Service de télévision connectée (OTT) : une sélection de chaînes en direct et de contenus
audiovisuels, via une application ou un accès web, avec une simple connexion internet.

## L'offre

| | |
|---|---|
| Prix | **9,90 € TTC / mois** |
| Essai | **1 mois offert** |
| Engagement | **Aucun** |
| Prérequis | **Une connexion internet** |

## La phrase de présentation

> « Mondial TV est notre service de télévision connectée. Il permet de regarder une
> sélection de chaînes TV et de contenus depuis un téléphone, une tablette, un ordinateur
> ou une TV compatible, grâce à internet. L'offre est à 9,90 € par mois, sans engagement,
> avec le premier mois offert. »

## Les 5 points à toujours expliquer

1. Le prix — 9,90 € TTC/mois
2. Le mois offert — le 1er mois est offert
3. Le sans engagement — libre à tout moment
4. Le besoin d'internet — connexion indispensable
5. Les supports compatibles — selon compatibilité

Si l'un manque, le risque de réclamation augmente.

## Le point le plus sensible : applications tierces

| Inclus dans l'abonnement | Non inclus (apps tierces) |
|---|---|
| Les chaînes et contenus Mondial TV validés au catalogue | Netflix, Disney+, myCanal |
| Accessibles via l'app ou l'accès web | Application / bouquet beIN Sports premium |
| | Accès avec les identifiants et l'abonnement **personnels** du client |

Les logos d'applications vus sur d'anciens supports désignent des applications
**compatibles**, pas des contenus inclus. Une chaîne en clair ou « news » n'est **pas** le
bouquet premium payant correspondant.

## Ce qu'il ne faut jamais promettre

- « Toutes les chaînes payantes sont incluses. »
- « Vous aurez Canal+ payant. » · « Vous aurez le bouquet beIN Sports. »
- « Vous aurez Netflix ou Disney+ inclus. »
- « Mondial TV remplace votre abonnement internet. » · « Ça fonctionne sans internet. »
- « La qualité sera parfaite partout. » · « Le catalogue ne changera jamais. »

À la place : « selon catalogue », « selon compatibilité », « avec une connexion suffisante ».

## Le réflexe catalogue

> « Le catalogue peut évoluer : vérifions la liste disponible. »

Jamais de promesse sur une chaîne précise non confirmée. Si une information n'est pas
confirmée : « à valider par la direction ».
