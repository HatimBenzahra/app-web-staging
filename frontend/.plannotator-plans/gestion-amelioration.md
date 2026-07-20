# Plan v2 — Refonte layout « Gestion de l'Organisation »

`src/pages-ADMIN-DIRECTEUR/gestion/`

> v1 (création + désassignation + recherche + fix qualité) est **déjà implémentée et build OK**.
> Cette v2 remplace le rendu de l'arbre (empilement vertical) par un layout **colonnes master-détail**
> et supprime les **bordures de cartes colorées**, suite au retour utilisateur.

## Goal

Éliminer le scroll vertical dû à l'empilement des cartes, en passant à un layout **3 colonnes
master-détail** (Directeurs → Managers → Commerciaux), chaque colonne scrollant *indépendamment*
(la page ne grandit plus). Supprimer toute bordure de carte colorée (règle projet : couleur
sémantique via badge/point/label, jamais via la bordure).

## Décisions validées (questions UI)

- **Layout** : colonnes master-détail. Clic sur un directeur → ses managers en colonne 2 → clic
  manager → ses commerciaux en colonne 3.
- **Interaction** : **D&D conservé** (déplacement rapide entre colonnes visibles) **+ menu
  « Réassigner »** sur chaque carte (réassignation arbitraire, hors colonnes visibles).

## Approche

Remplacer `OrganizationTree.jsx` (empilement) par `OrganizationColumns.jsx` (colonnes). Les cartes
elles-mêmes redeviennent les cibles de drop (plus de grandes `DropZone` en pointillés → fichier
supprimé). Le drag se fait via le **grip** uniquement (le corps de la carte sert au clic/sélection,
sans déclencher de drag accidentel). Ajout d'un `ReassignModal` réutilisant la logique de sélection
de parent d'`AddUserModal`.

## Steps

### 1. Bordures colorées (fix immédiat, transverse)
- Retirer `border-l-4 border-l-primary/30` (ManagerNode), `border-2`, `border-primary/20`
  (carte info). Bordures neutres par défaut (`border`/`border-border`).
- Sélection d'une carte : fond neutre (`bg-accent`) + chevron, **pas** de bordure colorée.
- Le *ring* transitoire pendant un drag-over reste (feedback d'interaction, non persistant).

### 2. État de sélection — `useGestionLogic.jsx`
- Ajouter `selectedDirecteurId`, `selectedManagerId` (`'direct'` = groupe « commerciaux directs »).
- Auto-sélection du 1er directeur ; reset du manager quand le directeur change.
- Dérivés : `selectedDirecteur`, `columnManagers` (+ entrée « Commerciaux directs »),
  `columnCommercials`. Basés sur `organizationView` (recherche déjà gérée).
- `reassignModal` state + `openReassign(user, type)` / `closeReassign`.

### 3. Colonnes — nouveau `components/OrganizationColumns.jsx` (remplace OrganizationTree.jsx)
- 3 colonnes `Card` côte à côte, chacune : header (titre + compteur + bouton « + » contextuel) et
  liste **scrollable interne** (`max-h`, `overflow-y-auto`). Scroll horizontal si écran étroit.
- Col 1 Directeurs : cartes sélectionnables (droppable : reçoit manager/commercial). Respect perms
  (`isDirecteur` ne voit que la sienne).
- Col 2 Managers du directeur sélectionné + entrée « Commerciaux directs (N) ». Managers
  draggables + sélectionnables + droppables (reçoivent commercial).
- Col 3 Commerciaux du manager (ou directs) sélectionné. Draggables (feuilles).
- États vides clairs par colonne.

### 4. Carte — `components/UserCard.jsx`
- Déplacer les listeners de drag sur le **grip** uniquement (corps = clic/sélection).
- Props `selectable`, `selected`, `onSelect`.
- Remplacer le bouton ✕ seul par un **menu `⋮`** (DropdownMenu) : « Réassigner… » + « Retirer
  (désassigner) », pour managers/commerciaux. `stopPropagation` sur le menu.

### 5. `components/ReassignModal.jsx` (nouveau)
- Dialog « Réassigner {nom} ».
- Commercial : Select directeur (option Aucun) + Select manager (filtré par directeur, option Aucun).
  Envoie `updateCommercial` (le backend dérive le directeur du manager si non fourni).
- Manager : Select directeur (option Aucun) → `updateManager`.
- Réutilise les hooks React Query existants (`useUpdateManagerMutation`/`useUpdateCommercialMutation`).

### 6. `components/UnassignedPanel.jsx`
- Restylée en **colonne** cohérente avec les 3 autres (reste droppable = désassigner). Bordures neutres.

### 7. `Gestion.jsx`
- Remplacer `<OrganizationTree>` par `<OrganizationColumns>` ; monter `<ReassignModal>`.
- Barre d'actions (recherche + filtre statut admin + bouton Ajouter) conservée.

### 8. Nettoyage
- Supprimer `components/DropZone.jsx` (plus utilisé) et `components/OrganizationTree.jsx`.

## Verification

Tests **statiques** (pas de boot serveur — pas de DB) :
- `npm run lint` → 0 erreur.
- `npm run build` (vite) → vert, aucun import cassé (DropZone/OrganizationTree supprimés et
  déréférencés), `ReassignModal`/`OrganizationColumns` bien liés.
- Revue manuelle : payloads mutation conformes backend (réassignation commercial = managerId/
  directeurId ; désassignation = null) ; aucune bordure de carte colorée résiduelle
  (`grep -rn "border-.*primary" gestion/`).
- `plannotator review` du diff avant conclusion.

## Risks / open questions

- **R1 — D&D limité aux colonnes visibles** : déplacer vers un manager d'un autre directeur passe par
  le menu « Réassigner » (par design). OK ?
- **R2 — Hauteur des colonnes** : hauteur bornée (`max-h-[70vh]` env.) avec scroll interne. Ajuster la
  valeur au besoin.
- **R3 — Suppression de `OrganizationTree.jsx`/`DropZone.jsx`** : composants locaux à `gestion/`,
  non importés ailleurs (vérifié) → suppression sûre.
