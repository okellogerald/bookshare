# Ory in This Project (Kratos + Hydra + Auth Portal)

This document explains the auth system in very simple terms, then maps each part to the real config/code.

## 1) Mental Model (Very Simple)

Think of auth as 3 workers:

1. `Kratos` is the **identity worker**.
It stores users, passwords, verification state, recovery state, MFA, and profile traits.

2. `Hydra` is the **OAuth/OIDC worker**.
It issues authorization codes, access tokens, ID tokens, and refresh tokens for apps.

3. `Auth Portal` (`apps/auth`) is the **UI + glue worker**.
It renders login/register/recovery/settings pages from Kratos flows, and handles Hydra login/consent/logout challenges.

BookShare Web (`apps/web`) is an OAuth client only. It should not directly own identity logic.

## 2) What Runs in Docker and Why

In `docker-compose.dev.yml`, auth needs these services:

1. `hydra-migrate` (one-shot)
Runs Hydra DB migrations before Hydra starts. Without it, Hydra can fail on boot.

2. `hydra` (long-running)
OAuth/OIDC server. Public API on `4444`, admin API on `4445`.

3. `hydra-client-init` (one-shot)
Creates or updates OAuth client `bookshare-web` via Hydra Admin API.
Without this, login fails with `invalid_client`.

4. `kratos-migrate` (one-shot)
Runs Kratos DB migrations before Kratos starts.

5. `kratos` (long-running)
Identity/self-service engine. Public API on `4433`, admin API on `4434`.

6. `auth` (long-running)
Your custom auth UI and Hydra challenge handlers on `3337`.

7. `mailpit` (dev only)
Catches emails (verification/recovery codes) at `http://localhost:4436`.

## 3) File Map

1. `infra/ory/kratos/kratos.yml`
Kratos behavior (flows, methods, redirects, SMTP, schema link).

2. `infra/ory/kratos/identity.schema.json`
What user traits exist (`email`, `name.first`, `name.last`, `gender`) and what can be used as credentials identifiers.

3. `infra/ory/hydra/hydra.yml`
Hydra issuer and where Hydra sends login/consent/logout challenges.

4. `infra/ory/hydra/init-client.sh`
Idempotent upsert for OAuth client `bookshare-web`.

5. `apps/auth/src/app/*`
Auth pages and Hydra challenge endpoints.

## 4) How Requests Flow (End-to-End)

### 4.1 Sign in from BookShare

1. User opens protected page in `apps/web`.
2. `apps/web/src/middleware.ts` redirects to `/api/auth/login` if no valid session.
3. `/api/auth/login` starts OAuth Authorization Code + PKCE with Hydra (`/oauth2/auth`).
4. Hydra redirects to Auth Portal `/oauth/login?login_challenge=...`.
5. Auth Portal checks Kratos session:
- no Kratos session: redirect to `/login`
- email not verified: redirect to `/verification`
- profile incomplete: redirect to `/setup`
6. If checks pass, Auth Portal accepts Hydra login challenge.
7. Hydra calls Auth Portal `/oauth/consent?consent_challenge=...`.
8. Auth Portal builds claims (`sub`, `email`, `name`, `given_name`, `family_name`, `email_verified`) and accepts consent.
9. Hydra redirects to `apps/web` callback (`/api/auth/callback`).
10. Web exchanges code for tokens, stores app session cookie, then returns user to requested page.

### 4.2 Registration in Auth Portal

1. User opens `http://localhost:3337/register`.
2. Kratos registration flow first collects only email (code method).
3. Kratos emails a 6-digit code.
4. User enters code on same flow.
5. On success, Kratos creates session (`hook: session`) and redirects to `/setup`.
6. `/setup` runs Kratos settings flow and collects profile + password.

Important details:

1. Registration flow ID is remembered in cookie `bookshare_register_flow` via `apps/auth/src/middleware.ts`.
2. `/register/reset` clears that cookie and starts fresh registration flow.
3. If user requests multiple codes, only the latest code/flow pairing should be used.

### 4.3 Recovery and Verification

1. Recovery page: `/recovery` (Kratos `use: code`).
2. Verification page: `/verification` (Kratos `use: code`).
3. Emails are sent through Kratos courier to Mailpit in dev.

## 5) `kratos.yml` Explained

Path: `infra/ory/kratos/kratos.yml`

1. `dsn`
Kratos DB location (SQLite volume in dev).

2. `serve.public.base_url`
Public Kratos URL used by browser-facing self-service redirects.

3. `selfservice.default_browser_return_url`
Fallback browser return URL if flow has no `return_to`.

4. `selfservice.allowed_return_urls`
Allowlist of safe redirect targets.
If a URL is not here, Kratos refuses `return_to`.

5. `selfservice.methods`
Enabled auth methods:
- `password`
- `code` (with `passwordless_enabled: true`, used for code flows)
- `link` (enabled for future use)

6. `selfservice.flows.*.ui_url`
Where Kratos sends the browser for each UI flow (`/login`, `/register`, `/settings`, etc.) on Auth Portal.

7. `selfservice.flows.registration`
`lifespan: 1h`, `style: unified`, and after registration:
- default redirect to `/setup`
- `after.code.hooks: [session]`

8. `identity.schemas`
Points Kratos to `identity.schema.json`.

9. `courier.smtp.connection_uri`
SMTP transport. In dev this points to Mailpit container.

## 6) `identity.schema.json` Explained

Path: `infra/ory/kratos/identity.schema.json`

1. Required trait: `traits.email`.
2. Optional traits: `traits.name.first`, `traits.name.last`, `traits.gender`.
3. `ory.sh/kratos.credentials.password.identifier: true`
Email can be used as password login identifier.
4. `ory.sh/kratos.credentials.code.identifier: true`
Email can be used for code flows.
5. `verification.via: email`
Kratos email verification channel.
6. `recovery.via: email`
Kratos password recovery channel.

## 7) `hydra.yml` Explained

Path: `infra/ory/hydra/hydra.yml`

1. `urls.self.issuer`
Public issuer URL used by OIDC discovery/JWKS/token validation.

2. `urls.error`
Error redirect target (`/error` in Auth Portal).

3. `urls.login`, `urls.consent`, `urls.logout`
Hydra challenge endpoints owned by Auth Portal.
Hydra delegates human interaction there.

4. `secrets.system`
Hydra crypto secret.
Must be changed outside dev.

5. `oidc.subject_identifiers`
Supported `sub` styles (`public`, `pairwise`) and pairwise salt.

## 8) Why Hydra Is Still Needed Here

Kratos handles identity and self-service UX/state.
Hydra handles OAuth/OIDC for client applications (`bookshare-web`, future apps).

If you want multi-app login with standard OAuth/OIDC tokens, Hydra is the right server in this split design.

## 9) Common Failure Modes

1. `invalid_client`
Cause: `bookshare-web` OAuth client missing in Hydra.
Fix: ensure `hydra-client-init` ran successfully.

2. `registration code is invalid or already used`
Cause: stale flow, code from older email, or mismatched flow/code.
Fix: go to `/register/reset`, request fresh code once, use latest code in same tab.

3. Login loops to auth pages
Cause: missing Kratos session, unverified email, or incomplete profile.
Fix: complete `/verification` and `/setup`.

## 10) Security Notes for Contributors

1. Do not expose Hydra/Kratos admin ports publicly.
2. Keep secrets out of git and rotate for non-dev environments.
3. Keep `allowed_return_urls` strict.
4. Keep consent claims minimal and explicit.

## 11) Admin UI Reality

1. Self-hosted Kratos/Hydra are API-first and do not ship a full built-in admin dashboard.
2. Day-to-day operations are usually done with Admin APIs and the Ory CLI.
3. Ory Network includes the hosted Ory Console (web UI).
4. Community UI projects may exist, but they are not the official management plane for self-hosted deployments.

## 12) Quick Local Checks

1. Kratos health: `curl -sS http://localhost:4433/health/ready`
2. Hydra health: `curl -sS http://localhost:4444/health/ready`
3. OAuth client exists: `curl -sS http://localhost:4445/admin/clients/bookshare-web`
4. Mailpit UI: `http://localhost:4436`
