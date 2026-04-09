# Login Flow

This is the current BookShare login flow.

Related docs:
- [AUTH-SYSTEM.md](./AUTH-SYSTEM.md)
- [KRATOS.md](./KRATOS.md)
- [kratos-login-traces.md](./log-traces/kratos-login-traces.md)

For the live step-by-step HTTP capture of redirects, cookies, Hydra challenges, Kratos responses, consent, callback, and final app state, see [`log-traces/kratos-login-traces.md`](./log-traces/kratos-login-traces.md).

## Product Shape

Login remains:

1. Email
2. Password

The web app does not expose registration as a first-class flow. Users who need an account are sent into login first, and the Auth Portal login page contains the Register link.

## End-To-End Flow

```text
Protected web route
  -> /api/auth/login
  -> Hydra authorization request
  -> Auth Portal /oauth/login
  -> no Kratos session -> /login
  -> user submits email + password
  -> Kratos creates session
  -> Auth Portal re-checks session / verification / profile completeness
  -> Hydra login accepted
  -> Hydra consent accepted
  -> web callback exchanges code for tokens
  -> app session stored
  -> user returned to requested page
```

## What Kratos Exposes Now

With the current `kratos.yml`:

1. `password` login is enabled.
2. `code.passwordless_enabled` is set to `false`.
3. `link` is not enabled.

That means the chosen BookShare login flow and raw Kratos login behavior are aligned:

1. login is email + password
2. no passwordless code login branch
3. no link-based login branch

## Auth Portal Login Page

File:
- `apps/auth/src/app/login/page.tsx`
- `apps/auth/src/features/auth-flows/login/server/load-login-page.ts`
- `apps/auth/src/features/auth-flows/login/server/build-login-model.ts`
- `apps/auth/src/features/auth-flows/login/components/login-form.tsx`

The portal no longer renders login through the generic `KratosFlowForm`.

Instead:

1. the route stays thin
2. the login loader owns flow bootstrap and fallback handling
3. the login mapper requires the explicit BookShare login shape
4. the login form renders the two supported fields directly

The visible form is:

1. Email
2. Password
3. Register link
4. Forgot password link

## OAuth Gatekeeping

Before the Auth Portal accepts Hydra's login challenge, it checks:

1. Kratos session exists
2. email is verified
3. profile is complete

Redirect targets:

1. missing session -> `/login`
2. unverified email -> `/verification`
3. incomplete profile -> `/settings?section=profile`

## Why This Matches The Current Product Decision

You wanted:

1. the web app to know nothing about registration methods
2. the web app to send users into login
3. registration to remain an Auth Portal concern
4. login itself to remain email + password only

That is now consistent across:

1. the web app routes
2. the Auth Portal login UI
3. the Kratos config

## Main Files

1. `apps/web/src/app/api/auth/login/route.ts`
2. `apps/auth/src/app/login/page.tsx`
3. `apps/auth/src/features/auth-flows/login/server/load-login-page.ts`
4. `apps/auth/src/features/auth-flows/login/server/build-login-model.ts`
5. `apps/auth/src/features/auth-flows/login/components/login-form.tsx`
6. `apps/auth/src/app/oauth/login/route.ts`
7. `apps/web/src/app/auth/register/page.tsx`
8. `infra/ory/kratos/kratos.yml`
