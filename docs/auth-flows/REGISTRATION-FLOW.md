# Registration Flow

This is the current BookShare registration flow after simplifying onboarding.

Related docs:
- [AUTH-SYSTEM.md](./AUTH-SYSTEM.md)
- [KRATOS.md](./KRATOS.md)
- [kratos-registration-traces.md](./log-traces/kratos-registration-traces.md)

## Product Shape

The registration UX is now:

1. `Email`
2. `First Name`
3. `Last Name`
4. `Gender`
5. Submit profile step
6. `Password`
7. `Confirm Password`
8. Submit password step
9. Verify email
10. Sign in with email + password

There is no BookShare-specific post-registration `/setup` step anymore.

`/setup` still exists only as a compatibility redirect to:

```text
/settings?section=profile
```

## What Ory Does vs What The UI Shows

### What The Auth Portal Shows

The Auth Portal now renders two registration steps from the same Kratos flow:

1. Profile step
   - `traits.email`
   - `traits.name.first`
   - `traits.name.last`
   - `traits.gender`
2. Password step
   - `password`
   - client-side `Confirm Password`

### What Kratos Exposes

With the current config, registration uses Kratos' default two-step browser flow and verification happens afterward.

That means the product flow and Kratos configuration are aligned:

1. profile step
2. password step
2. verification by code after registration

## End-To-End Flow

```text
User
  -> Auth Portal /register
  -> Kratos registration browser flow
  -> Auth Portal renders profile step form
  -> POST profile step to /self-service/registration?flow=...
  -> Auth Portal renders password step form
  -> POST password step to /self-service/registration?flow=...
  -> Kratos creates identity + password
  -> Kratos redirects into verification UI
  -> User enters verification code
  -> Kratos marks email verified
  -> Auth Portal /login
  -> User signs in with email + password
```

## File By File

### 1. Registration Route + Loader

File:
- `apps/auth/src/app/register/page.tsx`
- `apps/auth/src/features/auth-flows/registration/server/load-registration-page.ts`

Responsibilities:

1. Keep `/register` as a thin entrypoint.
2. Read `flow` and optional `return_to`.
3. Create or reload the Kratos browser registration flow.
4. Hand the page a registration-owned view model instead of generic form props.

Important implementation detail:

Registration is no longer configured by passing `sectionGroups`, `fieldAllowlist`, and `enablePasswordConfirmation` into the shared `KratosFlowForm`.

The registration route now delegates to a registration-specific loader and model builder:

1. `loadRegistrationPageData()` owns flow bootstrap and redirect handling.
2. `buildRegistrationModel()` maps Kratos nodes into explicit `profile` and `password` step models.
3. Mapping failures degrade into a recoverable error screen with `Start over`.

### 2. Registration Model Builder

File:
- `apps/auth/src/features/auth-flows/registration/server/build-registration-model.ts`

Responsibilities:

1. Detect whether the current flow is on the `profile` step or the `password` step.
2. Build a step-specific model for that exact registration screen.
3. Preserve hidden Kratos inputs needed to move from one step to the next.
4. Keep the Back action on the password step separate from the main password submit.

Important implementation detail:

This mapping is explicit on purpose. Registration no longer depends on the shared generic flow renderer; each step is modeled and rendered independently.

### 3. Registration Step Components

File:
- `apps/auth/src/features/auth-flows/registration/components/registration-form.tsx`
- `apps/auth/src/features/auth-flows/registration/components/registration-profile-step-form.tsx`
- `apps/auth/src/features/auth-flows/registration/components/registration-password-step-form.tsx`

Responsibilities:

1. Dispatch to the correct step component based on the mapped registration variant.
2. Keep the profile step and password step in separate forms and separate files.
3. Keep client-side confirm-password validation local to the password step only.
4. Always expose `Start over` as a recovery path.

This is UI validation only. Kratos still receives the real password field and remains the source of truth.

### 4. Verification Page

File:
- `apps/auth/src/app/verification/page.tsx`

Responsibilities:

1. Loads the Kratos verification flow.
2. Renders whatever verification nodes Kratos provides.
3. Lets Kratos handle code validation and success/error messaging.

Verification still uses email codes:

```yaml
selfservice:
  flows:
    verification:
      enabled: true
      use: code
```

### 5. Login Page After Verification

File:
- `apps/auth/src/app/login/page.tsx`

Responsibilities:

1. Receives the user after verification succeeds.
2. Starts the normal password login flow.

### 6. Legacy `/setup`

File:
- `apps/auth/src/app/setup/page.tsx`

Responsibilities:

1. Preserves compatibility for old links and bookmarks.
2. Redirects to `settings?section=profile`.

It is no longer part of the primary registration journey.

## Step By Step

### Step 1. User Opens `/register`

If the URL has no `flow`, the page redirects to Kratos:

```text
GET /self-service/registration/browser
```

Kratos responds with a browser redirect back to the portal:

```text
/register?flow={registration_flow_id}
```

### Step 2. Portal Renders The Profile Step

Kratos first returns the profile step with visible trait fields and a `profile` submit button.

Mechanically, that happens like this:

1. [`apps/auth/src/features/auth-flows/registration/server/build-registration-model.ts`](../../apps/auth/src/features/auth-flows/registration/server/build-registration-model.ts) detects the profile step.
2. [`apps/auth/src/features/auth-flows/registration/components/registration-profile-step-form.tsx`](../../apps/auth/src/features/auth-flows/registration/components/registration-profile-step-form.tsx) renders the first form.

Expected visible form:

1. Email
2. First Name
3. Last Name
4. Gender
5. Continue button

### Step 3. Portal Renders The Password Step

After the profile step is submitted, Kratos redirects back to the same `/register?flow=...` URL with the same flow id.

The portal then:

1. Detects the password step because Kratos now exposes the visible `password` node.
2. Preserves the submitted profile values via hidden trait inputs.
3. Renders a separate password form plus a separate Back form.

Expected visible form:

1. Password
2. Confirm Password
3. Create account button
4. Back button

### Step 4. User Submits Password Registration

Browser posts directly to Kratos using the flow action URL.

Kratos then:

1. Creates the identity.
2. Stores the password hash.
3. Starts email verification.
4. Redirects to the verification UI because `show_verification_ui` is configured for password registration.

Relevant config:

```yaml
selfservice:
  flows:
    registration:
      after:
        password:
          hooks:
            - hook: show_verification_ui
```

### Step 5. User Verifies Email

The verification flow is a separate Kratos flow.

The portal page at `/verification` renders the verification nodes and posts them back to Kratos. Kratos checks the code and updates the identity's verifiable address state.

### Step 6. User Signs In

After verification, the user lands on `/login` and signs in with:

1. Email
2. Password

The login form itself remains password-only.

## Settings After Registration

The profile/password split is handled in the settings UI, not by adding more Ory customization.

Paths:

1. `/settings?section=profile`
2. `/settings?section=password`

Both use the same Kratos settings flow and just render different groups:

- `profile`
- `password`

That means:

1. Yes, we can have “Profile Settings” vs “Password Changes”.
2. No, this does not require another significant Ory reconfiguration round.

## OAuth Gatekeeping After Registration

During the Hydra login challenge, the Auth Portal still checks:

1. Kratos session exists.
2. Email is verified.
3. Profile is complete (`first` + `last` name).

If profile data is incomplete, the user is sent to:

```text
/settings?section=profile
```

If email is unverified, the user is sent to:

```text
/verification
```

## Important Tradeoff

Password registration still creates the identity before email verification completes.

BookShare accepts that tradeoff, keeps registration and login separate by not creating a registration session, and still enforces verification before OAuth login is accepted.

## Files To Check When This Flow Changes

1. `apps/auth/src/app/register/page.tsx`
2. `apps/auth/src/app/verification/page.tsx`
3. `apps/auth/src/app/login/page.tsx`
4. `apps/auth/src/app/settings/page.tsx`
5. `apps/auth/src/app/oauth/login/route.ts`
6. `apps/web/src/app/auth/register/page.tsx` (compatibility redirect to login)
7. `infra/ory/kratos/kratos.yml`
8. `infra/ory/kratos/identity.schema.json`
