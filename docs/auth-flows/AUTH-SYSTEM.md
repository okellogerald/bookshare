# BookShare Authentication System

This is the current high-level reference for authentication in BookShare.

Companion docs:
- [REGISTRATION-FLOW.md](./REGISTRATION-FLOW.md)
- [LOGIN-FLOW.md](./LOGIN-FLOW.md)
- [FORGOT-PASSWORD-FLOW.md](./FORGOT-PASSWORD-FLOW.md)
- [KRATOS.md](./KRATOS.md)
- [SECURITY.md](../security/SECURITY.md)

## The Big Picture

BookShare auth is split across four parts:

1. `Ory Kratos`
   Identity system. Knows users, passwords, verification, recovery, and self-service flows.
2. `Ory Hydra`
   OAuth2/OIDC server. Issues codes and tokens to clients such as the web app.
3. `Auth Portal` (`apps/auth`)
   Custom UI for Kratos flows and the bridge for Hydra login / consent / logout challenges.
4. `Web App + API`
   The actual BookShare product. The web app is an OAuth client and the API trusts Hydra-issued tokens.

## Responsibilities By System

| Concern | Kratos | Hydra | Auth Portal | Web App |
|---|---|---|---|---|
| Store identities | Yes | No | No | Mirrors subset only |
| Hash passwords | Yes | No | No | No |
| Send verification/recovery codes | Yes | No | No | No |
| Render auth UI | No | No | Yes | Only redirects into auth |
| Issue OAuth tokens | No | Yes | No | Consumes tokens |
| Manage OAuth challenge flow | No | Yes | Yes | Starts flow |

## Current User-Facing Flows

### Registration

Current BookShare registration UX:

1. First Name
2. Last Name
3. Gender
4. Email
5. Password
6. Confirm Password
7. Email Verification

The Auth Portal renders a password-first registration form and then hands off to Kratos verification.

### Login

Current BookShare login UX:

1. Email
2. Password

The Auth Portal intentionally renders only the password login section.

### Settings

Current BookShare settings UX:

1. Profile Settings
2. Password Changes

Both are backed by the same Kratos settings flow. The portal chooses which Kratos group to render.

### Recovery

Recovery remains Kratos code-based:

1. Enter email
2. Receive code
3. Enter code
4. Reset password through the settings password section

### Verification

Verification remains Kratos code-based:

1. Receive code by email
2. Enter code in `/verification`
3. Kratos marks the address as verified

## Current Ory Configuration Shape

Key config lives in:

- `infra/ory/kratos/kratos.yml`
- `infra/ory/kratos/identity.schema.json`
- `infra/ory/hydra/hydra.yml`

Important Kratos behavior:

1. `password` is enabled.
2. `code` is enabled.
3. `code.passwordless_enabled` is false.
4. verification uses `code`.
5. recovery uses `code`.
6. settings enforce `privileged_session_max_age: 15m`.

The important nuance is this:

1. passwordless login/registration is off
2. verification/recovery still use codes
3. the config now closely matches the product flow

## Registration Overview

```text
User
  -> /register
  -> Kratos registration flow
  -> Auth Portal renders password-first form
  -> POST registration to Kratos
  -> Kratos creates identity + password + session
  -> Kratos redirects into verification UI
  -> User verifies email
  -> /welcome
  -> /login
```

Important consequence:

Because we are using password registration in the UI, the identity exists before verification is completed. BookShare compensates for that by enforcing email verification before granting access through the OAuth login gate.

## Login Overview

```text
Protected app route
  -> /api/auth/login
  -> Hydra authorization request
  -> Auth Portal /oauth/login
  -> check Kratos session / verification / profile completeness
  -> show /login if needed
  -> accept Hydra login challenge
  -> Hydra consent
  -> callback
  -> encrypted app session cookie
```

## OAuth Login Gatekeeping

Before the Auth Portal accepts the Hydra login challenge, it checks:

1. Kratos session exists
2. email is verified
3. profile is complete

If those checks fail, the user is redirected to:

1. `/login`
2. `/verification`
3. `/settings?section=profile`

This is how BookShare keeps access strict even while Kratos still exposes broader raw methods.

## Settings Overview

The settings split is implemented in the portal, not in Ory config.

Paths:

1. `/settings?section=profile`
2. `/settings?section=password`

Both use one Kratos settings flow.

Rendered Kratos groups:

1. `profile`
2. `password`

This is the practical answer to:

> Can we have Profile Settings vs Password Changes without tweaking Ory again?

Yes. The portal can split those views cleanly using the existing Kratos settings flow.

## Cookie Strategy

### Kratos Cookies

Kratos manages:

1. `ory_kratos_session`
2. `csrf_token_*`

These are Kratos-domain cookies used for self-service flow security and session state.

### Web App Cookies

The web app manages:

1. `bookshare_session`
2. `bookshare_token`
3. `bookshare_logged_out`
4. `oidc_code_verifier`
5. `oidc_state`
6. `oidc_return_to`

Sensitive app cookies are encrypted with AES-256-GCM. See:

- [COOKIE-ENCRYPTION.md](../security/COOKIE-ENCRYPTION.md)

### Registration Flow Cookie

There is no Auth Portal registration flow cookie anymore.

The previous `bookshare_register_flow` cookie existed only for the older code-first registration journey and is no longer part of the current flow.

## Legacy `/setup`

`/setup` is no longer a product step. It remains only as a compatibility redirect to:

```text
/settings?section=profile
```

That preserves old links without preserving the old onboarding model.

## File Map

### Auth Portal

1. `apps/auth/src/app/register/page.tsx`
2. `apps/auth/src/app/verification/page.tsx`
3. `apps/auth/src/app/login/page.tsx`
4. `apps/auth/src/app/settings/page.tsx`
5. `apps/auth/src/app/oauth/login/route.ts`
6. `apps/auth/src/components/kratos-flow-form.tsx`
7. `apps/auth/src/components/flow/section.tsx`

### Web App

1. `apps/web/src/app/auth/register/page.tsx`
   Compatibility redirect to login. The web app does not expose registration as a first-class path.
2. `apps/web/src/app/auth/login/page.tsx`
3. `apps/web/src/app/auth/settings/page.tsx`
4. `apps/web/src/features/auth/lib/auth-portal.ts`
5. `apps/web/src/app/(app)/settings/page.tsx`

### Infrastructure

1. `infra/ory/kratos/kratos.yml`
2. `infra/ory/kratos/identity.schema.json`
3. `infra/ory/hydra/hydra.yml`
4. `infra/ory/hydra/init-client.sh`

## Practical Summary

### What Changed

1. Registration is now password-first with profile fields on the first screen.
2. Verification happens after registration.
3. Login stays email + password.
4. Settings are split into profile and password sections.

### What Did Not Change

1. Verification still uses Kratos email codes.
2. Recovery still uses Kratos email codes.
3. Hydra still handles OAuth/OIDC for the web app.

### What We Deliberately Kept

1. code-based verification
2. code-based recovery
3. password registration followed by verification
