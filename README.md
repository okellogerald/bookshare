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
| Auth | Zitadel (OIDC, MFA enforced) | 8085 |
| Object Storage | MinIO | 9002 / 9003 |

## Project Structure

```
.
├── apps/
│   ├── api/          # NestJS write API
│   ├── web/          # Next.js frontend
│   └── workflows/    # Motia workflow steps
├── packages/
│   ├── db/           # Drizzle schema, migrations
│   └── shared/       # Shared types, enums, constants
├── infra/
│   ├── postgres/     # init.sql, post-migration.sql (RLS, views)
│   ├── zitadel/      # Auth provider config
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

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) + Docker Compose
- [Bun](https://bun.sh/)
- `psql` CLI (for `db-post-migrate`)

## Getting Started

1. **Copy environment file**
   ```sh
   cp .env.example .env
   ```

2. **Install dependencies**
   ```sh
   bun install
   ```

3. **Start all services**
   ```sh
   make -f Makefile.dev up-build
   ```

4. **Configure Zitadel client manually**
   1. Open the Zitadel console at `http://localhost:8085/ui/console`.
   2. Create an OIDC web application client for BookShare (Authorization Code + PKCE).
   3. Set redirect URI to `http://localhost:3334/api/auth/callback`.
   4. Set post-logout redirect URI to `http://localhost:3334`.
   5. Put the client ID into `.env` as `ZITADEL_CLIENT_ID=<your_client_id>`.

5. **Set PostgREST JWT keyset**
   ```sh
   docker run --rm --network library_default curlimages/curl:8.12.1 -sS -H 'Host: localhost' http://zitadel:8080/oauth/v2/keys
   ```
   Put the returned JSON in `.env` as `ZITADEL_JWT_SECRET=<jwks_json_single_line>`.

6. **Reload auth consumers**
   ```sh
   docker compose -f docker-compose.dev.yml up -d --force-recreate web postgrest
   ```

7. **Run database migrations**
   ```sh
   make -f Makefile.dev db-migrate
   ```

8. **Apply RLS policies and views**
   ```sh
   make -f Makefile.dev db-post-migrate
   ```

The app is available at `http://localhost:3334`.

## Makefile Targets

Run with `make -f Makefile.dev <target>`:

| Target | Description |
|---|---|
| `up` | Start all services |
| `up-build` | Start with image rebuild |
| `down` | Stop all services |
| `logs` | Tail all logs |
| `logs-<svc>` | Tail logs for a service (e.g. `logs-api`) |
| `zitadel-client-ids` | List available Zitadel OIDC client IDs |
| `db-generate` | Generate Drizzle migrations from schema |
| `db-migrate` | Run pending migrations |
| `db-post-migrate` | Apply RLS, views, grants |
| `db-studio` | Open Drizzle Studio |
| `db-psql` | Open psql shell |
| `db-reset` | Destroy volumes and restart |
| `clean` | Remove all containers and volumes |

Production uses `Makefile.prod` with `docker-compose.prod.yml`.
