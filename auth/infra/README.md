# Ory in This Project (Kratos + Hydra + Auth Portal)

This is the short project-specific reference for how BookShare currently uses Ory.

## Mental Model

1. `Kratos` owns identities, passwords, verification state, recovery, and self-service flows.
2. `Hydra` owns OAuth2/OIDC for client applications such as `bookshare-web`.
3. `auth/web` is the custom Auth Portal that renders Kratos flows and answers Hydra login / consent / logout challenges.

BookShare Web is not the identity provider. It is an OAuth client that sends users into the Auth Portal when identity work is needed.

## What The User Sees

### Registration

Current BookShare UX:

1. Open `/register`.
2. Fill `First Name`, `Last Name`, `Gender`, `Email`, `Password`, `Confirm Password`.
3. Submit the Kratos password registration flow.
4. Kratos creates the identity, stores the password, creates a session, and redirects into email verification.
5. User verifies the email with the code sent by Kratos.
6. After verification, the user signs in with email + password.

Important detail:
- Registration is password-first.
- Email verification still happens afterward with the Kratos verification flow.
- The web app does not expose registration directly.

### Login

Current BookShare UX:

1. Open `/login`.
2. Enter `Email` and `Password`.
3. Kratos creates a session.
4. Hydra login challenge resumes and OAuth tokens are issued to the web app.

The Auth Portal login form and Kratos config now both align on email + password only.

### Settings

Kratos settings are split in the UI, not in Ory configuration:

1. `/settings?section=profile`
   Updates email, first name, last name, and gender.
2. `/settings?section=password`
   Updates the password.

Both views use the same Kratos settings flow. The portal chooses which Kratos group to render:
- `profile`
- `password`

This means the profile/password split does **not** require extra Ory customization.

### Recovery And Verification

1. Recovery still uses Kratos email codes.
2. Verification still uses Kratos email codes.
3. Recovery resets land in the password section of the settings flow.

## Main Files

### Infrastructure

1. `auth/infra/kratos/kratos.yml`
   Main Kratos behavior: enabled methods, self-service flow URLs, verification/recovery settings.
2. `auth/infra/kratos/identity.schema.json`
   BookShare identity traits:
   - `traits.email`
   - `traits.name.first`
   - `traits.name.last`
   - `traits.gender`
3. `auth/infra/hydra/hydra.yml`
   Hydra issuer and Auth Portal challenge URLs.
4. `auth/infra/hydra/init-client.sh`
   Upserts OAuth client `bookshare-web`.

### Auth Portal

1. `auth/web/src/app/register/page.tsx`
   Password-first registration UI.
2. `auth/web/src/app/verification/page.tsx`
   Verification UI.
3. `auth/web/src/app/login/page.tsx`
   Password-only login UI.
4. `auth/web/src/app/settings/page.tsx`
   Split profile/password settings UI on top of one Kratos settings flow.
5. `auth/web/src/app/setup/page.tsx`
   Legacy compatibility redirect to profile settings.
6. `auth/web/src/app/oauth/login/route.ts`
   Hydra login gatekeeper. Redirects incomplete users to verification or profile settings before accepting the login challenge.

### Web App

1. `apps/web/src/app/auth/register/page.tsx`
   Compatibility redirect. Sends users into login instead of exposing registration from the web app.
2. `apps/web/src/app/auth/settings/page.tsx`
   Sends users into the requested Auth Portal settings section.
3. `apps/web/src/app/(app)/settings/page.tsx`
   App-side entry points for profile settings and password changes.

## Current Kratos Config Notes

From `auth/infra/kratos/kratos.yml`:

1. `selfservice.methods.password.enabled: true`
   Required for registration and login.
2. `selfservice.methods.code.enabled: true`
   Still used for verification and recovery.
3. `selfservice.methods.code.passwordless_enabled: false`
   Prevents passwordless code login / registration branches.
4. `selfservice.flows.verification.use: code`
   Verification is still email-code based.
5. `selfservice.flows.settings.privileged_session_max_age: 15m`
   Sensitive settings actions require a recent session.

## Why `/setup` Still Exists

`/setup` is no longer the primary onboarding step.

It now exists only as a compatibility redirect to:

```text
/settings?section=profile
```

That keeps old links or bookmarks working while the real UX is now:

```text
register -> verification -> login
```

## Common Failure Modes

1. `invalid_client`
   Hydra client `bookshare-web` is missing or not initialized.
2. Verification loop
   User is authenticated in Kratos but the email is still unverified, so the OAuth login gate sends them to `/verification`.
3. Profile completion loop
   User exists but is missing `first` or `last` name, so the OAuth login gate sends them to `/settings?section=profile`.
4. Passwordless flow unexpectedly appears
   Check that `selfservice.methods.code.passwordless_enabled` is still `false`.

## Practical Answer To “Do We Need More Ory Tweaks?”

For the requested UX:

1. Password-first registration form
2. Email verification afterward
3. Password-only login
4. Separate profile settings vs password changes

The answer is: **mostly no**.

We can do that in the Auth Portal by:

1. Rendering the `password` registration section plus the profile traits.
2. Letting Kratos handle verification with the existing verification flow.
3. Rendering only the `password` login section.
4. Rendering `profile` and `password` groups separately on the settings page.

The config now matches the chosen product flow closely.
