# PROJECT KNOWLEDGE BASE

**Generated:** 2026-02-04
**Commit:** 0c1bdae
**Branch:** main

## OBSIDIAN BRAIN (MANDATORY CONTEXT)

Before starting ANY work on this project, load context from the Obsidian vault using the `mcp_obsidian_read_note` tool.

**Start here — Product Playbook (MANDATORY):**
```
mcp_obsidian_read_note(path="CRM_PROSPECTION/Prospection/Product Playbook.md")
```
This is the business context brain. It explains WHY each feature exists, the personas, the daily workflows, the inviolable business rules, and the target state. Read this FIRST before touching any code.

**Then for technical details, read the Overview:**
```
mcp_obsidian_read_note(path="CRM_PROSPECTION/Prospection/Prospection Overview.md")
```

**Then read the relevant module notes based on your task:**

| If working on... | Read these notes |
|---|---|
| Backend API / GraphQL | `Prospection/Backend/Backend Overview.md` then the specific module |
| Frontend pages | `Prospection/Frontend/Frontend Overview.md` then the specific page |
| Mobile app | `Prospection/Mobile/Mobile Overview.md` then the specific flow |
| Door status logic | `Prospection/Flows/Door Status Machine.md` |
| Recording / audio | `Prospection/Flows/Recording Pipeline.md` |
| Commercial workflow | `Prospection/Flows/Commercial Journey.md` |
| Gamification / badges | `Prospection/Flows/Gamification Flow.md` |
| Database / Prisma | `Prospection/Infra/Database Schema.md` |
| External services | `Prospection/Infra/Services Externes.md` |

**Follow `[[wikilinks]]` in each note to navigate to related modules.**

The vault has 45 notes covering every module, page, flow, and service. Use `mcp_obsidian_search_notes` to find specific topics.

## OVERVIEW

Real estate door-to-door sales management system (prospection immobilière). Tracks commercials visiting buildings/apartments, manages zones, records audio monitoring, generates statistics. French-language domain.

**Stack:** React 19 + Vite 7 + Tailwind 4 (frontend) | NestJS 11 + GraphQL + Prisma + PostgreSQL (backend) | LiveKit (audio)

## STRUCTURE

```
Re_work/
├── frontend/           # React SPA (JSX, not TSX)
│   └── src/
│       ├── pages-ADMIN-DIRECTEUR/   # Admin/Director/Manager dashboard
│       ├── pages-COMMERCIAL-MANAGER/ # Field worker mobile interface
│       ├── pages-AUTH/              # Login, unauthorized
│       ├── components/              # Shared + Radix UI primitives
│       ├── contexts/                # Auth, loading, role providers
│       ├── hooks/                   # metier/api, utils, ui
│       ├── services/                # API layer (GraphQL clients)
│       └── types/                   # TypeScript definitions (in .d.ts)
├── backend/            # NestJS API
│   ├── src/            # Domain modules
│   └── prisma/         # Schema + migrations
└── package.json        # Root (http-proxy-middleware only)
```

## DOMAIN MODEL (HIERARCHY)

```
Directeur (director)
  └── Manager
       └── Commercial (field salesperson)

Zone (geographic area, circular)
  └── Immeuble (building)
       └── Porte (door/apartment)
            └── StatutPorte: NON_VISITE | CONTRAT_SIGNE | REFUS | RDV_PRIS | ABSENT | ARGUMENTE
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add new page (admin) | `frontend/src/pages-ADMIN-DIRECTEUR/` | Create dir + Page.jsx + use*Logic.jsx |
| Add new page (commercial) | `frontend/src/pages-COMMERCIAL-MANAGER/` | Different layout, mobile-first |
| New API entity | `backend/src/{entity}/` | module, service, resolver, dto |
| GraphQL schema | `backend/src/schema.gql` | Auto-generated, modify resolvers |
| Database schema | `backend/prisma/schema.prisma` | Run `npx prisma migrate dev` |
| UI components | `frontend/src/components/ui/` | Radix-based, shadcn pattern |
| API calls | `frontend/src/services/api/{entity}/` | queries.ts, mutations.ts, types.ts |
| Auth logic | `frontend/src/contexts/RoleContext.jsx` | JWT + role-based routing |
| Audio monitoring | `backend/src/audio-monitoring/` | LiveKit integration |

## CONVENTIONS

### Frontend
- **JSX not TSX**: Project uses JavaScript with `.jsx` extension
- **use*Logic pattern**: Each page has companion `use{PageName}Logic.jsx` hook
- **Role-based routing**: `isCommercial || isManager` → CommercialLayout, else AdminLayout
- **Lazy loading**: ALL pages lazy-loaded via `React.lazy()`
- **Path alias**: `@/` → `frontend/src/`
- **French variable names**: Domain terms in French (porte, immeuble, directeur)

### Backend
- **Module pattern**: Each domain has `{name}.module.ts`, `.service.ts`, `.resolver.ts`, `.dto.ts`
- **GraphQL code-first**: Schema auto-generated to `src/schema.gql`
- **Prisma**: Single `PrismaService` injected everywhere
- **HTTPS dev mode**: SSL certs in `backend/ssl/` (optional)

### Shared
- **No monorepo tooling**: Two separate package.json, run independently
- **French comments**: Code comments often in French

## COMMANDS

```bash
# Frontend
cd frontend && npm run dev      # Vite dev server (https://localhost:5173)
cd frontend && npm run build    # Production build
cd frontend && npm run lint     # ESLint

# Backend
cd backend && npm run start:dev # NestJS watch mode (port 3000)
cd backend && npm run build     # Compile
cd backend && npm run test      # Jest
cd backend && npm run db:seed   # Seed database
```

## ANTI-PATTERNS (THIS PROJECT)

- **DO NOT** use TypeScript in frontend - project chose JSX intentionally
- **DO NOT** modify `schema.gql` directly - it's auto-generated from resolvers
- **DO NOT** add new root-level packages - keep monorepo simple (frontend/backend only)
- **DO NOT** hardcode LiveKit URLs - use env vars (`LK_HOST`, `VITE_FRONTEND_URL`)

## NOTES

- LiveKit proxy: Backend proxies WSS→WS at `/livekit-proxy` for audio streaming
- Chunk splitting: Vite config has manual chunks for react, radix, mapbox, recharts
- Query caching: TanStack Query with 5min staleTime, refetchOnWindowFocus disabled
- Commercial interface forces light mode (`data-theme="light"`)
- Sentry integration for error monitoring (frontend)
