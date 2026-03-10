# BookShare

A closed-access platform where approved community members list books they're willing to lend, sell, or give away. Other members browse and search to discover locally available books. All exchange happens outside the platform.

## Tech Stack

| Layer | Technology | Dev Port |
|---|---|---|
| Frontend | Next.js 15, ShadCN, Tailwind, TanStack Query | 3334 |
| Write API | NestJS | 3333 |
| Read API | PostgREST | 3336 |
| Workflows | Motia | 3335 |
| Database | PostgreSQL 16 + Drizzle ORM | 5434 |
| Auth | Ory (Hydra + Kratos, default dev flavor) | 4444 / 4433 |
| Object Storage | MinIO | 9002 / 9003 |

## Project Structure

```
.
├── apps/
│   ├── api/          # NestJS write API
│   ├── web/          # Next.js frontend
│   ├── ory-login-consent/ # Hydra login/consent bridge backed by Kratos session
│   └── workflows/    # Motia workflow steps
├── packages/
│   ├── db/           # Drizzle schema, migrations
│   └── shared/       # Shared types, enums, constants
├── infra/
│   ├── postgres/     # init.sql, post-migration.sql (RLS, views)
│   ├── ory/          # Ory Hydra/Kratos config (default dev)
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
   - Login/consent is handled by the local bridge service on `http://localhost:3000`, which validates Kratos sessions and maps Kratos traits into Hydra token claims.

5. **Register a Kratos user (first time)**
   - Open `http://localhost:4455/registration`
   - Create an account with email and password (name fields optional but recommended for profile prefill)

6. **Set PostgREST JWT keyset**
   ```sh
   curl -sS http://localhost:4444/.well-known/jwks.json
   ```
   Put the returned JSON in `.env` as `OIDC_JWT_SECRET=<jwks_json_single_line>`.

7. **Reload auth consumers**
   ```sh
   docker compose -f docker-compose.dev.yml up -d --force-recreate web postgrest
   ```

8. **Run database migrations**
   ```sh
   make -f Makefile.dev db-migrate
   ```

9. **Apply RLS policies and views**
   ```sh
   make -f Makefile.dev db-post-migrate
   ```

The app is available at `http://localhost:3334`.

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
| `db-migrate` | Run pending migrations |
| `db-post-migrate` | Apply RLS, views, grants |
| `db-studio` | Open Drizzle Studio |
| `db-psql` | Open psql shell |
| `db-reset` | Destroy volumes and restart |
| `clean` | Remove all containers and volumes |

Production uses `Makefile.prod` with `docker-compose.prod.yml`.
