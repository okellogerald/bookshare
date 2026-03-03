# BookTrack - Book Inventory Management System

## Context

Build a multi-tenant book inventory tracker for bookstores (companies) and booksellers (individuals). The system tracks physical book copies — their condition, status, location, and lifecycle events (sold, rented, donated, lost, damaged, etc.). It does NOT handle e-commerce, payments, or shipping. Authentication and organization management are delegated to Zitadel.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js (App Router) |
| Backend API | NestJS |
| Workflows | Motia |
| Database | PostgreSQL |
| ORM | Drizzle |
| Auth | Zitadel (self-hosted) |
| Object Storage | MinIO |
| Monorepo | bun workspaces |
| Containerization | Docker + Docker Compose |

---

## Project Structure

```
library/
├── package.json                 # bun workspace root
├── bun.lockb
├── docker-compose.dev.yml       # Development environment
├── docker-compose.prod.yml      # Production environment
├── .env.example
├── apps/
│   ├── web/                     # Next.js frontend
│   │   ├── Dockerfile.dev
│   │   ├── Dockerfile.prod
│   │   ├── package.json
│   │   └── src/
│   │       ├── features/        # Feature-based organization
│   │       │   ├── auth/        # Login, logout, session
│   │       │   │   ├── components/
│   │       │   │   ├── hooks/
│   │       │   │   └── lib/
│   │       │   ├── dashboard/   # Overview, stats, recent activity
│   │       │   │   ├── components/
│   │       │   │   ├── hooks/
│   │       │   │   └── lib/
│   │       │   ├── books/       # Book catalog, search, detail
│   │       │   │   ├── components/
│   │       │   │   ├── hooks/
│   │       │   │   └── lib/
│   │       │   ├── editions/    # Edition management per book
│   │       │   │   ├── components/
│   │       │   │   ├── hooks/
│   │       │   │   └── lib/
│   │       │   ├── copies/      # Copy inventory, status mgmt
│   │       │   │   ├── components/
│   │       │   │   ├── hooks/
│   │       │   │   └── lib/
│   │       │   └── events/      # Event history, audit trail
│   │       │       ├── components/
│   │       │       ├── hooks/
│   │       │       └── lib/
│   │       ├── shared/          # Cross-feature shared code
│   │       │   ├── components/  # Layout, navigation, UI primitives
│   │       │   ├── hooks/
│   │       │   └── lib/
│   │       └── app/             # Next.js App Router pages (thin routing layer)
│   ├── api/                     # NestJS backend
│   │   ├── Dockerfile.dev
│   │   ├── Dockerfile.prod
│   │   ├── package.json
│   │   └── src/
│   │       ├── modules/
│   │       │   ├── auth/        # Zitadel JWT validation, guards
│   │       │   ├── books/       # Book CRUD (shared catalog)
│   │       │   ├── authors/     # Author CRUD
│   │       │   ├── editions/    # Edition CRUD (shared catalog)
│   │       │   ├── copies/      # Copy CRUD (tenant-scoped)
│   │       │   ├── events/      # CopyEvent log
│   │       │   ├── quotes/      # BookQuote CRUD (shared catalog)
│   │       │   ├── organizations/ # Org sync with Zitadel
│   │       │   └── upload/      # MinIO file upload
│   │       ├── common/
│   │       │   ├── guards/      # AuthGuard, TenantGuard
│   │       │   ├── decorators/  # @CurrentUser, @CurrentOrg
│   │       │   ├── interceptors/
│   │       │   └── filters/
│   │       └── drizzle/         # Drizzle client & config
│   └── workflows/               # Motia workflows
│       ├── Dockerfile.dev
│       ├── Dockerfile.prod
│       ├── package.json
│       └── steps/
│           ├── isbn-lookup.step.ts
│           ├── copy-status-change.step.ts
│           └── inventory-report.step.ts
├── packages/
│   ├── shared/                  # Shared TypeScript types & constants
│   │   ├── package.json
│   │   └── src/
│   │       ├── types/
│   │       └── constants/       # Enums: BookFormat, CopyStatus, EventType, etc.
│   └── db/                      # Drizzle schema, migrations, client
│       ├── package.json
│       ├── drizzle.config.ts
│       └── src/
│           ├── schema/          # Table definitions
│           ├── migrations/
│           └── index.ts         # Drizzle client export
├── infra/
│   ├── zitadel/
│   │   ├── masterkey            # Zitadel master key
│   │   └── steps.yaml           # Zitadel init config (project, app, roles)
│   ├── postgres/
│   │   └── init.sql             # Create databases (app + zitadel)
│   ├── minio/
│   │   └── init.sh              # Create default buckets
│   └── nginx/
│       └── nginx.conf           # Production reverse proxy
└── scripts/
    └── setup.sh                 # First-time setup script
```

### Frontend Organization (Feature-Based)

Each feature is self-contained with its own components, hooks, and utilities. The App Router `app/` directory is a thin routing layer that imports from features.

- **Feature folder** = everything needed for that domain area
- **shared/** = truly cross-cutting concerns (layout, UI primitives, API client)
- **app/** = Next.js route files that compose feature components

If a feature is replaced or removed, nothing else breaks.

---

## Data Model (Drizzle Schema)

### Shared (not tenant-scoped)

**Book** (the work — represents the abstract content)
- `id` UUID (PK)
- `title` String
- `subtitle` String?
- `description` Text? (longer content)
- `language` String (default: "en")
- `createdAt`, `updatedAt`

**Author**
- `id` UUID (PK)
- `name` String
- `createdAt`, `updatedAt`

**BookAuthor** (join table)
- `bookId` → Book
- `authorId` → Author
- Composite PK: (bookId, authorId)

**Edition** (a specific format/publication of a Book — each has its own ISBN)
- `id` UUID (PK)
- `bookId` → Book
- `isbn` String (unique, nullable — some old books lack ISBN)
- `format` Enum: HARDCOVER, PAPERBACK, MASS_MARKET, EBOOK, AUDIOBOOK
- `publisher` String?
- `publishedYear` Int?
- `pageCount` Int?
- `coverImageUrl` String? (MinIO path)
- `createdAt`, `updatedAt`

**BookQuote** (notable quotes — linked to a specific Edition since revisions can change text)
- `id` UUID (PK)
- `editionId` → Edition
- `text` Text
- `chapter` String?
- `addedBy` String (Zitadel user ID)
- `createdAt`

### Tenant-scoped (every query filtered by organizationId)

**Organization**
- `id` UUID (PK)
- `zitadelOrgId` String (unique — links to Zitadel)
- `name` String
- `type` Enum: BOOKSTORE, BOOKSELLER
- `createdAt`, `updatedAt`

**Copy** (a physical item owned by an org, linked to a specific Edition)
- `id` UUID (PK)
- `organizationId` → Organization (tenant key)
- `editionId` → Edition
- `condition` Enum: NEW, LIKE_NEW, GOOD, FAIR, POOR
- `status` Enum: AVAILABLE, RESERVED, RENTED, CHECKED_OUT, SOLD, DONATED, GIVEN_AWAY, LOST, DAMAGED
- `acquisitionType` Enum: PURCHASED, DONATED, CONSIGNED, OTHER
- `acquisitionDate` DateTime?
- `location` String? (shelf, warehouse section, etc.)
- `notes` Text?
- `createdAt`, `updatedAt`

**CopyEvent** (audit trail with optional financial data)
- `id` UUID (PK)
- `organizationId` → Organization (tenant key)
- `copyId` → Copy
- `eventType` Enum: ACQUIRED, STATUS_CHANGE, CONDITION_CHANGE, SOLD, RENTED, RETURNED, DONATED, GIVEN_AWAY, LOST, DAMAGED, NOTE_ADDED
- `fromStatus` CopyStatus?
- `toStatus` CopyStatus?
- `performedBy` String (Zitadel user ID)
- `amount` Decimal? (financial: acquisition cost, sale price, rental fee)
- `currency` String? (ISO 4217: "USD", "EUR", etc.)
- `notes` Text?
- `metadata` Json? (flexible extra data per event type)
- `createdAt`

### Entity Relationship Summary

```
Book (work)
├── has many Authors (via BookAuthor)
├── has many Editions (format-specific: ISBN, publisher, etc.)
│   ├── has many Copies (tenant-scoped physical items)
│   │   └── has many CopyEvents (audit trail + financials)
│   └── has many BookQuotes (quotes from this specific edition)

Organization (tenant)
├── has many Copies
└── has many CopyEvents
```

---

## Multi-Tenancy Strategy

- **Row-level isolation**: Every tenant-scoped table includes `organizationId`
- **NestJS TenantGuard**: Middleware extracts org from Zitadel JWT claims, sets it on request context
- **Drizzle query wrapper**: Service method that automatically injects `organizationId` filter via `.where()` on all tenant-scoped queries
- **Books, Authors, Editions, Quotes are global**: Any org can search and reference them; no tenant scoping. Quotes are queried via Edition → Book for "all quotes for this work"
- **Organization mapping**: On first login, sync the user's Zitadel org to our Organization table

---

## Authentication Flow (Zitadel)

1. Zitadel self-hosted via Docker with PostgreSQL backend (separate DB)
2. Configure a **Project** with two **Applications**:
   - Web app (Next.js) — PKCE/Authorization Code flow
   - API app (NestJS) — JWT token introspection
3. **Roles** defined in Zitadel: `owner`, `manager`, `staff`, `viewer`
4. Next.js uses `@zitadel/next` or generic OIDC library for login
5. NestJS validates JWTs, extracts `org_id` and `roles` from claims
6. Organization/member management happens in Zitadel's UI — we just consume it

---

## Motia Workflows

- **ISBN Lookup**: When an edition is created with an ISBN, fetch metadata from OpenLibrary API and auto-fill fields (publisher, year, page count, cover image)
- **Copy Status Change**: When a copy's status changes, auto-create a CopyEvent record
- **Inventory Report**: Scheduled workflow to generate inventory summaries per org

---

## Docker Setup

### Naming Convention

All environment-specific files use explicit suffixes: `.dev` and `.prod`. No unmarked defaults.

- Dockerfiles: `Dockerfile.dev`, `Dockerfile.prod`
- Compose files: `docker-compose.dev.yml`, `docker-compose.prod.yml`

### Development (`docker-compose.dev.yml`)

Services:
- `postgres` — Port 5434, two databases (app + zitadel)
- `zitadel` — Port 8085, depends on postgres
- `minio` — Port 9002 (API) + 9003 (console)
- `api` — NestJS dev server, hot-reload via volume mount, port 3333
- `web` — Next.js dev server, hot-reload via volume mount, port 3334
- `workflows` — Motia, volume mount, port 3335
- `minio-init` — One-shot container to create buckets

All app services mount source code as volumes for hot-reload. Dockerfiles use `bun` as the runtime.

### Production (`docker-compose.prod.yml`)

Same services but:
- Multi-stage Dockerfiles (build → slim runtime image)
- No volume mounts
- `nginx` reverse proxy in front of web + api
- Restart policies, health checks
- Resource limits

---

## Implementation Order

### Phase 1: Project Scaffolding
1. Initialize bun workspace root with `package.json`
2. Create `packages/shared` with enums and types
3. Create `packages/db` with Drizzle schema
4. Scaffold NestJS app (`apps/api`)
5. Scaffold Next.js app (`apps/web`) with feature-based structure
6. Scaffold Motia app (`apps/workflows`)

### Phase 2: Docker Infrastructure
7. Write Dockerfiles (`.dev` + `.prod`) for each app
8. Write `docker-compose.dev.yml` with postgres, zitadel, minio
9. Write postgres init script (create both databases)
10. Write minio init script (create `book-covers` bucket)
11. Configure Zitadel init steps (project, apps, roles)
12. Write `docker-compose.prod.yml`

### Phase 3: Auth & Tenancy
13. Implement Zitadel JWT validation in NestJS (AuthGuard)
14. Implement TenantGuard and @CurrentOrg decorator
15. Implement Drizzle tenant query wrapper
16. Set up Next.js OIDC authentication (auth feature)

### Phase 4: Core API (NestJS)
17. Books module — CRUD (shared/global)
18. Authors module — CRUD, link to books
19. Editions module — CRUD, ISBN search (shared/global)
20. Quotes module — CRUD (shared/global)
21. Copies module — CRUD, status management (tenant-scoped)
22. Events module — Auto-log copy events with financials (tenant-scoped)
23. Upload module — MinIO presigned URL generation for cover images

### Phase 5: Workflows (Motia)
24. ISBN lookup step — OpenLibrary API integration (populates Edition data)
25. Copy status change step — Auto-create events
26. Inventory report step

### Phase 6: Frontend (Next.js)
27. Auth feature (login/logout with Zitadel)
28. Dashboard feature (inventory overview, recent events)
29. Books feature (catalog search, detail view, add book + editions)
30. Copies feature (list, add, update status, financial tracking)
31. Events feature (history view, audit trail)

---

## Verification

- `docker compose -f docker-compose.dev.yml up` starts all services with hot-reload
- Zitadel UI accessible at `localhost:8085`, can create orgs and users
- MinIO console at `localhost:9003`, can verify bucket creation
- NestJS API at `localhost:3333/api`, Swagger docs available
- Next.js at `localhost:3334`, can log in via Zitadel
- Create a book → add editions with different ISBNs/formats → verify structure
- Create a copy of an edition → verify tenant scoping (different org can't see it)
- Change copy status → verify CopyEvent auto-created with financial fields
- Add a quote to a book → verify visible across orgs
- Upload cover image to an edition → verify stored in MinIO
- `docker compose -f docker-compose.prod.yml up` for production build test
