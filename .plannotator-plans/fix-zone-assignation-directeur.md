# Simplification de l'assignation de zone (web + backend, puis réalignement mobile)

## Décision (validée)
- On assigne **uniquement la/les personne(s) choisie(s)**. **Zéro cascade** (assigner un manager n'assigne PLUS ses commerciaux). **Zéro filtrage de "redondances"**.
- **Plusieurs assignés possibles** par zone (le multi-select reste).
- Ordre : **web + backend d'abord**, puis **réalignement du mobile** sur le même modèle.

## Le modèle cible (simple, 0 magie)
- Assignation = **exactement les utilisateurs cochés**, écrits dans `ZoneEnCours` (1 par personne), rien d'autre.
- Le **créateur possède sa zone** (FK) : manager → `managerId`, directeur → `directeurId`. C'est ce qui rend la zone visible pour lui et autorise l'assignation. (admin : pas de FK, bypass.)
- Un seul chemin d'assignation partout : `assignZoneToUser(zoneId, userId, userType)`.

---

## Cause du bug actuel (rappel court)
- `create()` attribue la zone au créateur **seulement pour un manager** (`managerId = userId`), **pas pour un directeur** → `zone.directeurId = null`.
- L'assignation vérifie `zone.directeurId === userId` → **403** pour un directeur → assignation jamais posée.
- Le front **avale** l'erreur et affiche « succès ». En plus : cascade + `removeRedundantAssignments` = complexité inutile.

---

## Changements

### A. Backend (`backend/src/zone/`)
1. **`zone.service.ts → create()`** : attribuer aussi le directeur (symétrie manager) :
   ```ts
   if (userRole === 'manager') rest.managerId = userId;
   else if (userRole === 'directeur') rest.directeurId = userId;
   ```
2. **`zone.service.ts → assignZoneToUser()`** : **supprimer toute la cascade** (le bloc `if (cascade) {…}` + le paramètre `cascade`). La fonction n'assigne plus QUE l'utilisateur cible. On garde le check d'autorisation (propriété) et le passage en historique.
3. **`zone.resolver.ts` + `zone.dto.ts`** : retirer le champ `cascade` de `AssignZoneInput` (plus utilisé).
   - `getCommercialsUnderManager` / `getTeamUnderDirector` restent (utilisés ailleurs : auth, stats).

### B. Web (`prowin-web/frontend/src`)
4. **Service `services/api/zones/`** : ajouter `assignToUser(userId, userType, zoneId)` + la mutation `assignZoneToUser` (le resolver existe déjà) + hook `useAssignZoneToUser`. Mapping rôle→userType : `directeur→DIRECTEUR`, `manager→MANAGER`, `commercial→COMMERCIAL`.
5. **`useZonesLogic.jsx → handleZoneValidate` / `processAssignments`** :
   - **Supprimer `removeRedundantAssignments`** (on assigne exactement les cochés).
   - Assigner chaque utilisateur coché via `assignToUser(...)` (un seul chemin).
   - **Remonter les erreurs** : si une assignation échoue, `showError` explicite au lieu d'un faux succès.
6. **`zones-utils.js`** : supprimer `removeRedundantAssignments` (devenu mort) + son test. (Les helpers de validation géométrique ajoutés récemment restent.)

### C. Mobile (`app-mobile`) — réalignement APRÈS le web
7. **`services/api/zones/zone.service.ts → assignToUser`** : retirer l'argument `cascade` (signature `(userId, userType, zoneId)`), et la mutation mobile `assignZoneToUser` : retirer `cascade` de l'input.
8. **`hooks/zone/use-zone-draft.ts`** : adapter les appels (`assignToUser(target.id, target.role, newZone.id)` sans le `false`). Le mobile gardait déjà cascade=false → **comportement identique**, on nettoie juste le paramètre.
   - Optionnel (cohérence) : router aussi les commerciaux via `assignToUser` au lieu de `assignToCommercial`.

---

## Périmètre
- **Inclus** : backend zone (create + assign), web (service/hook/logique + nettoyage), mobile (nettoyage cascade).
- **Exclus** : UI de la modal web (déjà refaite), géométrie/validation.

## Vérification
- **Directeur (web)** : crée une zone → `zone.directeurId` = son id ; assigne un manager → `ZoneEnCours(MANAGER)` créé **et rien d'autre** (pas les commerciaux) ; la zone apparaît dans sa liste. Échec éventuel → message d'erreur (plus de faux succès).
- **Manager (mobile)** : crée + s'assigne → `ZoneEnCours(MANAGER)` ; assigne un commercial → uniquement ce commercial. Aucune régression.
- **Admin** : assignation multiple = exactement les cochés.
- Build + lint web ; `npm test` mobile/web ; typecheck backend.

## Risque
- Retrait de la cascade = changement de comportement **voulu** (documenté par la décision). Vérifier qu'aucun autre appelant backend ne dépend de `cascade=true`.
