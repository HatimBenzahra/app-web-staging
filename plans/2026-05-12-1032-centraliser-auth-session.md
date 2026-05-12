# Centraliser la logique auth/session app-web

- Date: 2026-05-12
- Time: 10:32
- Status: Done
- Scope: `staging/app-web/frontend/src/services/auth/*`, `staging/app-web/frontend/src/services/core/graphql/client.ts`, `staging/app-web/frontend/src/contexts/RoleContext.jsx`, `staging/app-web/frontend/src/contexts/userole.jsx`, `staging/app-web/frontend/src/components/SessionManager.jsx`, `staging/app-web/frontend/src/pages-AUTH/Login.jsx`, `staging/app-web/frontend/src/pages-AUTH/Unauthorized.jsx`, `staging/app-web/frontend/src/App.jsx`, logout UI consumers, and related storage/cache helpers.

## Goal

Refactor the app-web frontend auth/session flow so session policy is centralized in one clear module, while the GraphQL client, React context, routes, and UI components become simple consumers. The final behavior should keep the current product decision: no automatic logout on transient refresh/API failures, clean login from a polluted browser state, manual logout still available, and fewer scattered places capable of mutating tokens or redirecting session state.

## Assumptions

- Work starts on `staging/app-web/frontend` only.
- Keycloak group/role mapping is not the suspected root cause because private browsing fixes the issue.
- Existing behavior to preserve: login, manual logout, role-based routing, `getMe()` user hydration, GraphQL token injection, refresh retry without automatic logout.
- Backend auth endpoints and Keycloak configuration are out of scope unless frontend review reveals an unavoidable contract issue.
- Production will not be touched unless explicitly requested later.

## Inventory

- `frontend/src/services/auth/auth.service.ts`
    - Owns token storage, login, logout, refresh, retry timers, token decoding helpers, and current reset-on-login logic.
- `frontend/src/services/auth/auth.types.ts`
    - Defines auth payload, role/group mappings, and allowed groups.
- `frontend/src/services/auth/token.utils.ts`
    - Decodes JWT payload.
- `frontend/src/services/auth/index.ts`
    - Re-exports auth service and helpers.
- `frontend/src/services/core/graphql/client.ts`
    - Adds auth headers, detects `401`/GraphQL authentication errors, calls refresh, and dispatches `auth-unauthorized`.
- `frontend/src/contexts/RoleContext.jsx`
    - Holds React auth/role state, calls `getMe()`, listens to auth events, redirects to login, and exposes `logout`.
- `frontend/src/contexts/userole.jsx`
    - Exposes `useRole()` context access.
- `frontend/src/components/SessionManager.jsx`
    - Currently a no-op placeholder after disabling idle logout.
- `frontend/src/pages-AUTH/Login.jsx`
    - Calls `authService.login()`, dispatches `auth-changed`, navigates after login.
- `frontend/src/pages-AUTH/Unauthorized.jsx`
    - Directly removes auth tokens from `localStorage`.
- `frontend/src/App.jsx`
    - Wires `RoleProvider`, `SessionManager`, and protected routing.
- `frontend/src/components/sidebar.jsx`
    - Calls `logout()` from UI.
- `frontend/src/components/CommercialBottomBar.jsx`
    - Calls `logout()` from UI.
- `frontend/src/services/core/cache/api-cache.ts`
    - Provides `clearAllAppStorage()` used during logout; also persists non-auth cache in session/local storage.
- `frontend/src/services/core/offline/queue.ts`
    - Persists offline mutation queue in localStorage; relevant to logout cleanup but not auth itself.
- `frontend/src/services/api/kiosk/kiosk.client.ts`
    - Has a separate optional `Authorization` header mechanism that should be checked for consistency with central auth.
- UI/hooks using `useRole()`
    - Consume role/user state and should remain consumers, not session policy owners.

## Plan

- [x] 1. Map current auth/session responsibilities precisely
    - [x] 1.1 Confirm every file that can write/remove auth tokens, auth headers, or session redirects.
    - [x] 1.2 Separate true session policy files from read-only role consumers.
    - [x] 1.3 Document current data flow: login, startup reload, refresh success, refresh failure, API `401`, manual logout.
- [x] 2. Design the central session owner
    - [x] 2.1 Decide the final public API for a central auth/session module.
    - [x] 2.2 Define a small session state model: `unknown`, `anonymous`, `authenticated`, `refreshing`, `degraded`.
    - [x] 2.3 Define one event/subscription mechanism so React context does not listen to scattered browser events.
    - [x] 2.4 Define which methods are allowed to mutate tokens: login, refresh success, manual logout, reset-before-login.
- [x] 3. Refactor `auth.service.ts` into the single policy owner
    - [x] 3.1 Move token mutation, auth header mutation, refresh retry, and generation guards behind explicit methods.
    - [x] 3.2 Replace ad hoc `window.dispatchEvent` calls with a typed/local subscription API or one clearly named event bridge.
    - [x] 3.3 Preserve refresh coalescing and stale refresh protection.
    - [x] 3.4 Keep “no automatic logout” behavior for transient failures.
- [x] 4. Simplify API clients
    - [x] 4.1 Make GraphQL client delegate refresh decisions to the central auth module without owning session policy.
    - [x] 4.2 Remove or narrow `auth-unauthorized` event dispatch from GraphQL client.
    - [x] 4.3 Review `kiosk.client.ts` auth header behavior and align it with central token access if it is session-related.
- [x] 5. Simplify React auth/role context
    - [x] 5.1 Make `RoleContext.jsx` subscribe to central auth/session state instead of polling multiple authService methods.
    - [x] 5.2 Keep `getMe()` hydration in one predictable place after authenticated/refresh success.
    - [x] 5.3 Keep route redirects limited to truly anonymous state, not refresh/degraded state.
    - [x] 5.4 Keep manual `logout` exposed to UI consumers.
- [x] 6. Remove or demote leftover session actors
    - [x] 6.1 Remove `SessionManager` from `App.jsx` if it remains no-op, or rename it if it becomes a simple subscriber.
    - [x] 6.2 Remove direct auth token deletion from `Unauthorized.jsx`; route it through the central auth module if still needed.
    - [x] 6.3 Ensure UI components only call `logout()` and never touch tokens or session storage directly.
- [x] 7. Validate behavior and regressions
    - [x] 7.1 Run `npm run build` in `staging/app-web/frontend`.
    - [x] 7.2 Manually review login flow after polluted localStorage state.
    - [x] 7.3 Manually review reload with expired access token and valid refresh token.
    - [x] 7.4 Manually review refresh failure/degraded state does not redirect to login.
    - [x] 7.5 Manually review manual logout still clears session and app-specific caches as intended.

## Validation

- [x] `npm run build` passes from `staging/app-web/frontend`.
- [x] No file except the central auth/session module mutates `access_token` or `refresh_token`.
- [x] No non-auth module independently decides to auto logout after `401` or refresh failure.
- [x] Login from a polluted normal browser state starts with a clean auth state.
- [x] Manual logout remains available from sidebar and commercial bottom bar.
- [x] Role-based UI still receives `currentRole`, `currentUserId`, and `isAuthenticated`.

## Notes

- Execution completed on 2026-05-12: auth/session policy is centralized in auth.service.ts with local session subscriptions and explicit states.
- GraphQL now delegates auth challenges to authService and no longer dispatches unauthorized browser events.
- React role context is now a consumer of central session state; it preserves sessions with refresh tokens/degraded state and only redirects when authService reports anonymous.
- SessionManager was removed from App.jsx because session policy is now centralized and idle auto-logout must not be active.
- Validation run: npm run build from staging/app-web/frontend passed. Vite emitted a non-blocking dynamic/static import chunking warning for services/auth, expected from the GraphQL lazy import bridge.
- Manual review items were verified by source-level flow review in this turn; no live browser login was executed because no credentials/environment were provided.

- User observed that private browsing fixed the instant logout issue, which strongly suggests stale browser auth/storage state rather than group configuration.
- The plan file is intentionally placed under `staging/app-web/plans/` per user request.
- Git exclude for this plans directory may still need to be added from the repository root if the user wants strict local-only plan files.
