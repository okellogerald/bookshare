# Ory Kratos In BookShare

This document explains how BookShare currently uses Kratos after simplifying registration and settings.

Related docs:
- [AUTH-SYSTEM.md](./AUTH-SYSTEM.md)
- [REGISTRATION-FLOW.md](./REGISTRATION-FLOW.md)
- [LOGIN-FLOW.md](./LOGIN-FLOW.md)
- [kratos-registration-traces.md](./log-traces/kratos-registration-traces.md)

## What Kratos Does Here

Kratos is responsible for:

1. Identity storage
2. Password hashing and verification
3. Verification and recovery codes
4. Self-service flows
5. Browser sessions

Kratos is still headless. The Auth Portal reads Kratos flow JSON and decides what to render.

## The Current BookShare Stance

### Registration

The visible BookShare registration UX is password-first:

1. First name
2. Last name
3. Gender
4. Email
5. Password
6. Confirm password
7. Email verification after submit

### Login

The visible BookShare login UX is still:

1. Email
2. Password

### Settings

The visible BookShare settings UX is split into:

1. Profile settings
2. Password changes

All of that is done at the UI layer on top of Kratos flows.

## Current Kratos Reality

The config is now intentionally aligned with the chosen product flow:

```yaml
selfservice:
  methods:
    password:
      enabled: true
    code:
      enabled: true
      passwordless_enabled: false
```

Consequences:

1. password login is enabled
2. password registration is enabled
3. verification/recovery still use code
4. passwordless code login/registration is disabled

This is the key answer to “How will Ory behave by default here?”:

1. The Auth Portal will look simple.
2. Kratos underneath now largely matches that same shape.

## Identity Schema

BookShare identity traits live in:

- `infra/ory/kratos/identity.schema.json`

Current schema fields:

1. `traits.email`
2. `traits.name.first`
3. `traits.name.last`
4. `traits.gender`

The `email` trait is configured for:

1. Password identifier
2. Code identifier
3. Verification via email
4. Recovery via email

So the same email trait underpins login, verification, and recovery behavior.

## Registration Flow Mapping

### Raw Kratos

A registration flow from Kratos can include:

1. Default trait fields
2. Password submit branch
3. Code submit branch

### Auth Portal Rendering

File:
- `apps/auth/src/app/register/page.tsx`

The portal selects:

```tsx
sectionGroups={["password"]}
fieldAllowlist={[
  "traits.name.first",
  "traits.name.last",
  "traits.gender",
  "traits.email",
  "password",
]}
enablePasswordConfirmation
```

So the portal renders:

1. the default trait nodes
2. the password node
3. the password submit button

## What Happens After Password Registration

Kratos behavior is driven by:

```yaml
selfservice:
  flows:
    registration:
      after:
        password:
          hooks:
            - hook: session
            - hook: show_verification_ui
```

That means:

1. The identity is created immediately.
2. The password is written immediately.
3. A Kratos session is created immediately.
4. Kratos redirects into verification UI immediately.

This is simpler for the user, but it also means the identity exists before verification finishes.

## Verification Flow Mapping

File:
- `apps/auth/src/app/verification/page.tsx`

Kratos verification is still configured as:

```yaml
selfservice:
  flows:
    verification:
      enabled: true
      use: code
```

So BookShare verification remains email-code based.

The portal does not add custom verification business logic. It simply renders the verification flow nodes and lets Kratos validate them.

## Login Flow Mapping

File:
- `apps/auth/src/app/login/page.tsx`

The portal selects:

```tsx
sectionGroups={["password"]}
```

Because `buildSections()` merges default inputs into non-default groups, the rendered password section includes:

1. `identifier`
2. `password`
3. password submit

So the visible login form remains email + password and matches the current Kratos config.

## Settings Flow Mapping

Files:
- `apps/auth/src/app/settings/page.tsx`
- `apps/auth/src/app/setup/page.tsx`

Kratos settings flows already contain multiple groups, especially:

1. `profile`
2. `password`

BookShare now splits them with a `section` query param:

1. `/settings?section=profile`
2. `/settings?section=password`

The portal chooses which group to render from the same Kratos settings flow.

This is why the answer to “Can we have Profile Settings vs Password Changes without Ory tweaks?” is yes.

We are not adding a second Ory system or a second settings backend. We are just rendering different Kratos groups intentionally.

## Recovery Reset Behavior

When the user arrives from recovery, the settings page detects that context and forces the password section.

So recovery still behaves like:

1. Recovery email/code flow
2. Password reset in settings

That path does not use the normal profile/password section switcher.

## Privileged Session Behavior

Kratos settings are still protected by:

```yaml
selfservice:
  flows:
    settings:
      privileged_session_max_age: 15m
```

Meaning:

1. Sensitive settings changes require a recent session.
2. Password changes may force re-authentication if the session is too old.

That behavior comes from Kratos. The Auth Portal does not replace it.

## OAuth Login Gate

During Hydra login handling, the Auth Portal checks:

1. `getKratosSession()`
2. `isKratosEmailVerified()`
3. `isKratosProfileComplete()`

If the profile is incomplete, the user is redirected to:

```text
/settings?section=profile
```

If the email is unverified, the user is redirected to:

```text
/verification
```

This keeps BookShare access gated while still relying on standard Kratos session and verification behavior.

## Legacy `/setup`

`/setup` is no longer the real onboarding step.

It now exists as a compatibility redirect to:

```text
/settings?section=profile
```

That lets older links continue to work without keeping the old code-first-then-setup user journey alive.

## Practical Summary

### What We Changed In The UI

1. Registration is one password-first form.
2. Verification happens after registration.
3. Login stays email + password.
4. Settings are split into profile vs password views.

### What We Kept In Kratos

1. `code` is still enabled for verification and recovery.
2. `passwordless_enabled` is now false.
3. verification and recovery still use standard Kratos code flows.
