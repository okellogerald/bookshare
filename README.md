# BookShare

A closed-access platform where approved community members list books they're willing to lend, sell, or give away. Other members browse and search to discover locally available books. All exchange happens outside the platform.

## Tech Stack

| Layer | Technology | Dev Port |
|---|---|---|
| Frontend | Next.js 15, ShadCN, Tailwind, TanStack Query | 3334 |
| Write API | NestJS | 3333 |
| Workflows Engine | Motia / iii | 3335 |
| Workflows Console | iii-console | 3113 |
| Read API | PostgREST | 3336 |
| Database | PostgreSQL 16 + Drizzle ORM | 5434 |
| Auth | Ory (Hydra + Kratos + Auth Portal) | 4444 / 4433 / 3337 |
| Object Storage | MinIO | 9002 / 9003 |

## Project Structure

```
.
├── apps/
│   ├── api/          # NestJS write API
│   ├── auth/         # Reusable Auth Portal (Kratos flows + Hydra challenges)
│   ├── web/          # Next.js frontend
│   └── workflows/    # Background workflows + iii console
├── packages/
│   ├── db/           # Drizzle schema, migrations
│   └── shared/       # Shared types, enums, constants
├── auth/
│   ├── api/          # Auth NestJS service (org-scoped auth)
│   ├── web/          # Reusable Auth Portal (Kratos flows + Hydra challenges)
│   ├── infra/        # Ory Hydra/Kratos config (default dev)
│   └── docs/         # Auth flows + security references
├── infra/
│   ├── postgres/     # init.sql + manual PostgREST recovery wrapper
│   ├── minio/        # Object storage init
│   └── nginx/        # Production reverse proxy
├── docker-compose.dev.yml
├── docker-compose.prod.yml
├── Makefile.dev
└── Makefile.prod
```

Monorepo managed with **bun workspaces**. All services run in **Docker** for both dev and prod.

## Architecture

- **Read/write split** -- PostgREST handles reads (with RLS), NestJS handles writes
- **User-scoped data** -- copies, collections, and events are scoped by `userId` with row-level security
- **Two-layer book model** -- `Book` (work/content) + `Edition` (format-specific: ISBN, publisher, etc.)
- **Copy lifecycle** -- status field + `CopyEvent` audit log
- **Browse** -- a cross-user PostgREST view (`browse_listings`) shows all available copies
- **Wants** -- users post books they're looking for; others browse the wanted board
- **Submission intake** -- `Add Copy` and missing-book wants submit to admin email for manual processing in v1

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) + Docker Compose
- [Bun](https://bun.sh/)
- `psql` CLI (for `db-post-migrate`)

## Getting Started

1. **Copy environment file**
   ```sh
   cp .env.example .env
   ```

   Configure SMTP + submissions inbox variables in `.env` before using add-copy or missing-want submissions:
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`
   - `SMTP_FROM`, `SUBMISSIONS_EMAIL_TO`

2. **Install dependencies**
   ```sh
   bun install
   ```

3. **Start all services**
   ```sh
   make -f Makefile.dev up-build
   ```

4. **Hydra OAuth client is auto-provisioned**
   - `hydra-client-init` creates/updates `bookshare-web` on startup.
   - Login, consent, and logout challenges are handled by Auth Portal at `http://localhost:3337`.
   - Config reference for contributors: `auth/infra/README.md`
   - Login destination resolution is documented in `auth/docs/flows/login-resolution.md`.

5. **Register a user (first time)**
   - Open `http://localhost:3337/register`
   - Create an account with email/password, verify email, then continue to BookShare login.

6. **PostgREST JWT keyset (auto in dev)**
   - `postgrest-jwt-init` now fetches JWKS from `OIDC_JWKS_URI` and writes it to a shared volume before PostgREST starts.
   - PostgREST reads that keyset from `@/jwt/jwks.json`, so read queries work without manually copying JWKS into `.env`.
   - Optional: set `OIDC_JWT_SECRET` in `.env` to override fetched JWKS (useful for external/non-default OIDC setups).

7. **Run database migrations**
   ```sh
   make -f Makefile.dev db-migrate
   ```

   This now applies schema changes and the PostgREST read API setup
   (RLS policies, views, grants, and schema-cache reload).

8. **Seed categories before imports**
   ```sh
   make -f Makefile.dev db-seed CATEGORIES_FILE=/absolute/path/to/categories.csv
   ```

   - Book imports require every `category_slugs` value to already exist in `categories`.
   - The seed accepts custom `.csv` / `.tsv` taxonomy files using `name,slug,parent_slug`.
   - The recommended default is Thema: use `CATEGORIES_FORMAT=thema` with an official public Thema `.csv` / `.xlsx` export to generate slugs like `thema-umz`.
   - BISAC remains supported as `CATEGORIES_FORMAT=bisac`, but BISG’s current guidance requires a licensed file download for internal database use of the full list.
   - Templates live at `packages/db/examples/categories.template.csv` and `packages/db/examples/thema.template.csv`.

The app is available at `http://localhost:3334`.

## Auth Compose Jobs (Why They Exist)

`docker-compose.dev.yml` includes three important one-shot jobs for Ory startup:

| Service | Type | Why it is necessary | What it does |
|---|---|---|---|
| `hydra-migrate` | One-shot migration job | Hydra will fail or behave unpredictably if DB schema is missing/outdated. | Runs `hydra migrate sql up` against Hydra's SQLite DB volume before `hydra` starts. |
| `kratos-migrate` | One-shot migration job | Kratos requires its SQL schema to exist before serving self-service/session APIs. | Runs `kratos migrate sql` against Kratos's SQLite DB volume before `kratos` starts. |
| `hydra-client-init` | One-shot bootstrap job | Without this, OAuth login fails with `invalid_client` because `bookshare-web` client does not exist. | Calls Hydra Admin API to create/update client `bookshare-web` with callback/logout URLs and grant settings. |

### Startup Order

1. `hydra-migrate` completes, then `hydra` starts.
2. `kratos-migrate` completes, then `kratos` starts.
3. `hydra-client-init` runs after Hydra is up and upserts the OAuth client.
4. `web` depends on `hydra-client-init` completion so auth redirects have a valid client.

### Script Notes

- `auth/infra/hydra/init-client.sh` is idempotent by design.
- It waits for `http://hydra:4445/health/ready`, then `POST`s `/admin/clients` on first boot and `PUT`s `/admin/clients/bookshare-web` on later boots.
- Re-running compose does not duplicate clients; it keeps client config in sync.

## Submission Behavior (V1)

- `My Library → Add Copy` sends a copy submission email (with MinIO image links) to admin and a confirmation email to the submitting user.
- `My Wants → Add Want` first searches existing catalog books; selecting a match creates a normal want.
- If no match is found, `Add Want` sends a missing-book request email to admin (including user ID) and a confirmation email to the user.
- These submission flows do not create pending database records; admin performs manual entry.

## Makefile Targets

Run with `make -f Makefile.dev <target>`:

| Target | Description |
|---|---|
| `up` | Start all services |
| `up-build` | Start with image rebuild |
| `down` | Stop all services |
| `logs` | Tail all logs |
| `logs-<svc>` | Tail logs for a service (e.g. `logs-api`) |
| `db-generate` | Generate Drizzle migrations from schema |
| `db-migrate` | Run pending migrations (schema + PostgREST read API) |
| `db-post-migrate` | Apply RLS, views, grants |
| `db-studio` | Open Drizzle Studio |
| `db-psql` | Open psql shell |
| `db-reset` | Destroy volumes and reapply all DB migrations |
| `clean` | Remove all containers and volumes |

Production uses `Makefile.prod` with `docker-compose.prod.yml`.
