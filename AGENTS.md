# Agent Instructions

Living instructions for agents working in this repository. Keep changes aligned with the existing product, architecture, and deployment model.

## Project Context

This is a door-to-door sales tracking system (`prospection porte-a-porte`). The product follows commercials and managers in the field as they visit buildings, knock on doors, and record a status for each visited door. Door statuses include `NON_VISITE`, `ABSENT`, `ARGUMENTE`, `REFUS`, `RENDEZ_VOUS_PRIS`, `NECESSITE_REPASSAGE`, and `CONTRAT_SIGNE`. The app manages geographic zones, records audio monitoring during prospection, and generates statistics on commercial performance.

Stack:
- Frontend: React 19, Vite 7, Tailwind CSS 4, shadcn/Radix UI, TanStack Query.
- Backend: NestJS 11, GraphQL code-first, Prisma, PostgreSQL.
- Deployment: VPS-based deployment, not serverless/platform deployment.

## Frontend Rules

Frontend lives in `frontend/` and intentionally uses JSX, not TSX.

- Use existing UI primitives from `frontend/src/components/ui/` before creating new components.
- Before adding a component, search for an existing equivalent in `frontend/src/components/` and `frontend/src/components/ui/`.
- Follow `frontend/components.json`: shadcn `new-york`, Radix primitives, Lucide icons, Tailwind CSS variables, and `@/` aliases.
- Use existing colors and tokens from `frontend/src/index.css`; do not introduce random hardcoded colors when a token exists.
- Prefer shadcn/Radix components for dialogs, sheets, dropdowns, selects, tables, tabs, badges, buttons, inputs, tooltips, alerts, and cards.
- Use Lucide icons for icon buttons and visual actions when an icon exists.
- For new pages, follow the existing pattern: `Page.jsx` plus a companion `use*Logic.jsx` hook.
- Keep admin/director pages aligned with `frontend/src/pages-ADMIN-DIRECTEUR/`.
- Keep commercial/manager pages aligned with `frontend/src/pages-COMMERCIAL-MANAGER/` and mobile-first where appropriate.
- Preserve lazy loading patterns with `React.lazy()` for pages.
- Keep UI responsive, accessible, and consistent with the existing layouts.
- When frontend component work needs registry guidance, use the shadcn MCP/tools when available to inspect components, examples, add commands, and audit checklists.

## Backend Rules

Backend lives in `backend/` and follows NestJS module architecture.

- Respect the module pattern: `{domain}.module.ts`, `{domain}.service.ts`, `{domain}.resolver.ts`, `{domain}.dto.ts`.
- Keep resolvers thin. Put business logic in services.
- Keep services focused and single-purpose where possible.
- Apply SOLID principles pragmatically: clear responsibilities, explicit dependencies, no duplicated business rules, and no large catch-all classes.
- Keep TypeScript typing clean and explicit where behavior, DTOs, Prisma payloads, or GraphQL contracts matter.
- Use DTOs with `@InputType()`, `@ObjectType()`, and class-validator decorators as appropriate.
- Use the injected `PrismaService`; do not instantiate Prisma clients manually.
- Follow GraphQL code-first patterns. Do not edit `backend/src/schema.gql` directly.
- For database changes, update `backend/prisma/schema.prisma` and create a Prisma migration through the project workflow.
- Keep LiveKit configuration environment-driven. Do not hardcode LiveKit hosts or credentials.

## Local Feature Changelog

For every added feature, create or update `.agent-changelog.md` at the repository root.

The file is local agent memory and must remain uncommitted. It is ignored by Git.

Each entry must include:
- Date.
- Local time.
- Feature name.
- Files or areas touched.
- Short summary of what was added or changed.

Example:

```md
## 2026-06-10 14:30 - Commercial dashboard filter

- Areas touched: `frontend/src/pages-COMMERCIAL-MANAGER/`, `frontend/src/services/api/`
- Added a status filter to the commercial dashboard and wired it to existing query state.
```

## Deployment Context

This project deploys to a VPS. Treat deployment as a VPS/global-script workflow, not a serverless or managed platform deploy.

Root deployment scripts are the source of truth:

```bash
npm run deploy:staging
npm run deploy:prod
```

These scripts call the global deployment process in `../deploy/`.

Notes:
- `deploy.sh` in this repo is obsolete and only redirects to the global staging deploy.
- Before changing deployment behavior, inspect root `package.json`, `deploy.sh`, and the parent `../deploy/` scripts.
- Production deployment is sensitive. Verify build/tests and staging status before recommending or running `npm run deploy:prod`.
- Do not change deployment scripts unless the user explicitly asks for deployment workflow changes.

## Commands

Frontend:

```bash
cd frontend && npm run dev
cd frontend && npm run build
cd frontend && npm run lint
cd frontend && npm run test
```

Backend:

```bash
cd backend && npm run start:dev
cd backend && npm run build
cd backend && npm run test
cd backend && npm run db:seed
```

Deployment:

```bash
npm run deploy:staging
npm run deploy:prod
```

## Do Not

- Do not add TSX frontend files; this frontend uses JSX intentionally.
- Do not edit generated GraphQL schema files directly.
- Do not add root-level packages unless the user explicitly asks for a root-level dependency.
- Do not hardcode environment-specific URLs, LiveKit hosts, credentials, or VPS paths.
- Do not create duplicate UI components when a shadcn/Radix or local component already exists.
- Do not overwrite unrelated user changes in the working tree.
