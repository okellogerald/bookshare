# Admin Dashboard Implementation

Last updated: 2026-04-10

## Objective

Build `apps/admin` as the internal BookShare staff console.

This app is for platform staff only. It is distinct from:

- `apps/web` for community members
- a future bookstore/organization app

## Current Status

Current milestone: `Scaffold & Wiring`

## Milestones

- [x] Create an implementation tracker in the repository
- [x] Scaffold `apps/admin` as a separate Next.js app
- [x] Add a dedicated Hydra OAuth client for `apps/admin`
- [x] Add local Docker Compose wiring for the admin app
- [x] Add protected admin routes with isolated auth cookies
- [ ] Carry staff roles through OIDC token claims
- [ ] Restrict admin-capable NestJS endpoints with `@Roles(...)`
- [ ] Add admin API proxy and query layer
- [ ] Ship Catalog Workbench v0
- [ ] Ship batch ingestion UI
- [ ] Ship Staff Management v0

## Decisions

- `apps/admin` is a separate app, not a section inside `apps/web`.
- `staff` is a platform role model.
- `organizations` are reserved for the future bookstore/shop app.
- The first functional surface is `Catalog Workbench`, not analytics.
- The first slice should favor a usable vertical path over broad coverage.

## Scope For The First Slice

The first slice in progress is:

1. Staff can open `apps/admin`
2. Staff can authenticate through Hydra/Ory
3. Staff can reach protected admin routes
4. The app exposes the initial admin navigation:
   - Catalog
   - Batches
   - Staff

This slice does not yet include:

- role-based authorization enforcement
- persisted staff management actions
- catalog CRUD backed by API data
- import/batch execution from the browser

## Next Tasks

1. Add role claims to tokens during Hydra consent
2. Persist or resolve staff role membership from a reliable source
3. Enforce staff-only access in the API
4. Build Catalog Workbench search and creation flow
5. Reuse importer concepts for browser-based batch validation/commit

## Key Files

- `docs/admin-dashboard-implementation.md`
- `apps/admin`
- `infra/ory/hydra/init-client.sh`
- `docker-compose.dev.yml`
