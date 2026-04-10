# Admin Dashboard Implementation

Last updated: 2026-04-10

## Objective

Build `apps/admin` as the internal BookShare staff console.

This app is for platform staff only. It is distinct from:

- `apps/web` for community members
- a future bookstore/organization app

## Current Status

Current milestone: `Catalog Operations & Batch Ingestion`

## Milestones

- [x] Create an implementation tracker in the repository
- [x] Scaffold `apps/admin` as a separate Next.js app
- [x] Add a dedicated Hydra OAuth client for `apps/admin`
- [x] Add local Docker Compose wiring for the admin app
- [x] Add protected admin routes with isolated auth cookies
- [x] Add and migrate the persistent `staff_roles` table
- [x] Carry staff roles through OIDC token claims
- [x] Restrict admin-capable NestJS endpoints with `@Roles(...)`
- [x] Add admin API proxy and query layer
- [x] Ship Catalog Workbench v0
- [x] Ship Staff Management v0
- [ ] Ship batch ingestion UI

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
5. Staff can search the current catalog from the admin app
6. Staff roles are enforced from auth claims through admin route protection and API writes
7. Staff can search identities, grant platform access, and revoke roles from the admin app

This slice does not yet include:

- full catalog CRUD backed by API data
- import/batch execution from the browser
- duplicate-aware catalog tooling beyond search
- staff-role audit history beyond current assignment state

## Next Tasks

1. Build Catalog Workbench create/edit flows on top of the new search path
2. Surface staff-role audit context in the admin UI
3. Add batch-ingestion validation and preview workflow
4. Add create-on-behalf member listing flow
5. Build browser-based batch commit flow

## Key Files

- `docs/admin-dashboard-implementation.md`
- `apps/admin`
- `apps/admin/src/features/catalog/components/catalog-workbench.tsx`
- `apps/admin/src/features/staff/components/staff-management.tsx`
- `infra/ory/hydra/init-client.sh`
- `docker-compose.dev.yml`
- `packages/db/src/schema/staff-roles.ts`
- `packages/db/src/migrations/0003_add_staff_roles.sql`
