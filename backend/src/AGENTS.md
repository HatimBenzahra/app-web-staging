# BACKEND SOURCE

## OVERVIEW

NestJS 11 API with GraphQL (Apollo) code-first approach. Prisma ORM with PostgreSQL. LiveKit for audio streaming.

## STRUCTURE

```
src/
├── {domain}/                    # One module per domain entity
│   ├── {domain}.module.ts       # NestJS module definition
│   ├── {domain}.service.ts      # Business logic
│   ├── {domain}.resolver.ts     # GraphQL resolvers
│   └── {domain}.dto.ts          # Input/output types
├── auth/
│   ├── guards/                  # JWT + Roles guards
│   └── decorators/              # @CurrentUser, @Roles
├── audio-monitoring/            # LiveKit integration
│   ├── livekit.service.ts       # Token generation, room management
│   └── audio-monitoring.*       # Recording streams
├── enumeration-Status/          # Shared enums
├── schema.gql                   # AUTO-GENERATED GraphQL schema
├── app.module.ts                # Root module imports
├── main.ts                      # Bootstrap + CORS + LiveKit proxy
└── prisma.service.ts            # Prisma client singleton
```

## DOMAIN MODULES

| Module | Entity | Key Operations |
|--------|--------|----------------|
| `directeur` | Director | CRUD, hierarchy root |
| `manager` | Manager | CRUD, under directeur |
| `commercial` | Commercial | CRUD, field salespeople |
| `zone` | Zone | Circular geo areas, assignment |
| `immeuble` | Immeuble | Buildings with portes |
| `porte` | Porte | Door status tracking |
| `statistic` | Statistic | Aggregated metrics |
| `recording` | Recording | Audio file storage (S3) |

## WHERE TO LOOK

| Task | Location |
|------|----------|
| Add new entity | Create `src/{name}/` with module, service, resolver, dto |
| Add GraphQL field | Modify resolver → schema.gql auto-updates |
| Database change | `prisma/schema.prisma` → `npx prisma migrate dev` |
| Add auth guard | `auth/guards/` - extend JwtAuthGuard |
| LiveKit tokens | `audio-monitoring/livekit.service.ts` |

## CONVENTIONS

- **Code-first GraphQL**: Schema generated from decorators in resolvers
- **PrismaService**: Injected everywhere, defined in `prisma.service.ts`
- **DTO pattern**: All inputs use `@InputType()`, outputs use `@ObjectType()`
- **French field names**: Domain terms match Prisma schema (nom, prenom, etc.)

## GRAPHQL PATTERNS

```typescript
// Resolver pattern
@Resolver(() => EntityType)
export class EntityResolver {
  @Query(() => [EntityType])
  async entities() { ... }

  @Mutation(() => EntityType)
  async createEntity(@Args('input') input: CreateEntityInput) { ... }
}
```

## ANTI-PATTERNS

- **DO NOT** edit `schema.gql` directly - it's auto-generated
- **DO NOT** create new PrismaService instances - use injection
- **DO NOT** skip DTO validation decorators (class-validator)
- **DO NOT** hardcode LiveKit host - use `process.env.LK_HOST`
