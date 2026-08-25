---
slug: france-telephone
label: Mobile France Téléphone (Bleutel)
appliesTo: productDetected:france_telephone
winleadplus:
  match: { fournisseur: "BLEUTEL" }
sttTerms:
  # Termes que la TRANSCRIPTION doit orthographier juste (noms de marque, sigles,
  # chiffres-clés). Injectés dans l'initial_prompt de Whisper, nulle part ailleurs.
  # Pas de français courant ici : ça n'aide pas le décodeur et ça sature le prompt.
  - "France Téléphone"
  - "Bleutel"
  - "RIO"
  - "3179"
  - "eSIM"
  - "MVNO"
  - "portabilité"
  - "Bouygues Telecom"
identifiers:
  # Signaux de RECONNAISSANCE de l'offre pour la passe 0 (mapping), pas des
  # arguments de vente. Décrire ce qu'on entend dans l'échange plutôt que le nom
  # commercial seul : Whisper déforme régulièrement les noms de marque.
  - "un forfait mobile : nombre de gigas, appels illimités, carte SIM ou eSIM"
  - "la portabilité du numéro : le code RIO, le 3179"
  - "la comparaison avec la facture mobile actuelle du prospect"
  - "la marque France Téléphone ou Bleutel (souvent déformée à la transcription)"
facts:
  - "Bleutel by France Téléphone est un MVNO : il opère sur les réseaux Orange et Bouygues Telecom, sans posséder ses propres antennes"
  - "gamme de 5 forfaits : 1 Go, 20 Go, 100 Go, 150 Go, 200 Go"
  - "tous les forfaits incluent les appels, SMS et MMS illimités, sans engagement, à prix garanti"
  - "compatibles 4G, 5G et eSIM"
  - "priorité réseau : les opérateurs propriétaires du réseau conservent la priorité technique sur leurs antennes en cas de saturation ; Bleutel est un MVNO premium, pas un opérateur natif"
  - "portabilité du numéro : le client compose le 3179 (gratuit) pour obtenir son RIO, code de 12 caractères, valable moins de 30 jours"
  - "la portabilité résilie automatiquement l'ancien contrat : le client ne doit jamais résilier lui-même"
  - "activation de la ligne sous 3 jours ouvrés en moyenne, sans coupure de service, 100 % gratuite"
  - "le nom et prénom communiqués doivent correspondre exactement au titulaire de la ligne actuelle"
  - "carte SIM ou eSIM envoyée sous 48 à 72 h après souscription"
  - "droit de rétractation : 14 jours calendaires à compter de la réception de la SIM (vente à distance)"
  - "engagement en cours chez l'opérateur actuel : la nouvelle ligne est activée à la date de fin d'engagement"
  - "résiliation avant 12 mois chez un opérateur engageant : un quart des mensualités restantes est dû (loi Chatel)"
  - "service client basé en France : 01 80 91 97 31, du lundi au vendredi 9h-18h ; contact@france-telephone.com"
  - "facture détaillée gratuite chaque mois"
  - "devoir de conseil : recommander le forfait adapté au profil et au budget, tout dire sur le prix, la durée et les conditions de résiliation"
  - "RGPD : collecter le strict nécessaire, jamais de copie de carte bancaire, aucune photo de pièce d'identité non protégée"
forbidden:
  # IDÉES que le produit ne peut pas porter — pas des phrases à retrouver mot pour
  # mot. Un commercial ne dira jamais « zéro reste à charge » tel quel ; il dira
  # « ça vous coûte rien de plus ». C'est l'idée qui compte, avec ses mots à lui.
  - { say: "laisser croire que le client aura la même priorité réseau qu'un abonné de l'opérateur propriétaire des antennes", severity: grave }
  - { say: "garantir une absence totale de coupure, quelles que soient les circonstances", severity: grave }
  - { say: "laisser croire qu'un engagement en cours chez l'opérateur actuel ne coûtera rien", severity: grave }
  - { say: "présenter Bleutel comme propriétaire de son propre réseau d'antennes", severity: modere }
  - { say: "annoncer plus de données que ce que porte le forfait souscrit", severity: modere }
  - { say: "garantir un délai de portabilité plus court que celui prévu", severity: modere }
  - { say: "annoncer un tarif qui ne figure pas dans la grille en vigueur", severity: modere }
---

# Mobile France Téléphone — fiche produit (Bleutel)

Un opérateur français qui met la simplicité, la transparence et la liberté au cœur du
quotidien. Bleutel est un **MVNO** : il s'appuie sur les réseaux **Orange et Bouygues
Telecom** — la qualité d'un grand réseau, sans en avoir le tarif.

## La gamme — 5 forfaits, une promesse

| Forfait | Prix TTC/mois | Profil |
|---|---|---|
| 1 Go | 5,90 € | Sénior, ligne secondaire, secours |
| 20 Go | 9,90 € | Usage quotidien normal |
| 100 Go | 14,90 € | Famille, jeune actif, télétravail occasionnel |
| 150 Go | 19,90 € | Pro mobile, voyageur, foyer connecté |
| 200 Go | 24,90 € | Pro intensif, famille très connectée |

Tous : **appels, SMS et MMS illimités · sans engagement · prix garanti · 4G/5G/eSIM**.

## Les 8 piliers

Sans engagement · Numéro conservé · Réseaux Orange & Bouygues · Prix garanti ·
eSIM disponible · Service client en France · Facture détaillée gratuite · Marque française.

## La portabilité — le sujet n°1 du client

1. **RIO** — le client compose le **3179** depuis son mobile actuel, gratuitement. Il
   reçoit son RIO par SMS en quelques secondes. Code de 12 caractères, valable moins de 30 jours.
2. **Souscription** — il communique son RIO.
3. **Bleutel s'occupe de tout** — la résiliation de l'ancien opérateur est automatique.
4. **Activation** — la ligne est portée sous **3 jours ouvrés en moyenne**, sans coupure.

Erreurs à éviter : RIO erroné ou expiré, titulaire différent du nom communiqué,
résiliation manuelle par le client, portabilité déjà en cours.

## Engagement & résiliation

Bleutel est **100 % sans engagement**. Chez un opérateur engageant : après 12 mois,
résiliation libre sans frais (préavis 10 jours, loi Chatel) ; avant 12 mois, un quart des
mensualités restantes est dû. Si le client est engagé, la nouvelle ligne est activée à la
date de fin d'engagement.

## Le devoir de conseil

Identifier le besoin réel · Informer clairement (prix, durée, résiliation) · Respecter le
consentement, aucune pression · Protéger les données (RGPD) · Confirmer la souscription ·
Rappeler systématiquement le délai de rétractation de 14 jours.

## Le positionnement à tenir

Bleutel n'est ni le plus cher, ni le plus low cost : c'est le meilleur compromis — qualité
réseau Orange et Bouygues, sans engagement, service client en France. En cas de
saturation, les opérateurs propriétaires du réseau gardent la priorité technique sur leurs
antennes : Bleutel est un MVNO premium, **pas** un opérateur natif.
