# Registration Flow

This is the current BookShare registration flow after simplifying onboarding.

Related docs:
- [AUTH-SYSTEM.md](./AUTH-SYSTEM.md)
- [KRATOS.md](./KRATOS.md)
- [kratos-registration-traces.md](./log-traces/kratos-registration-traces.md)

## Product Shape

The registration UX is now:

1. `First Name`
2. `Last Name`
3. `Gender`
4. `Email`
5. `Password`
6. `Confirm Password`
7. Submit
8. Verify email
9. Sign in with email + password

There is no BookShare-specific post-registration `/setup` step anymore.

`/setup` still exists only as a compatibility redirect to:

```text
/settings?section=profile
```

## What Ory Does vs What The UI Shows

### What The Auth Portal Shows

The Auth Portal registration page renders the Kratos `password` registration section plus the profile traits:

- `traits.name.first`
- `traits.name.last`
- `traits.gender`
- `traits.email`
- `password`
- client-side `Confirm Password`

### What Kratos Exposes

With the current config, registration is password-based and verification happens afterward.

That means the product flow and Kratos configuration are aligned:

1. password registration
2. verification by code after registration

## End-To-End Flow

```text
User
  -> Auth Portal /register
  -> Kratos registration browser flow
  -> Auth Portal renders full registration form
  -> POST /self-service/registration?flow=...
  -> Kratos creates identity + password + session
  -> Kratos redirects into verification UI
  -> User enters verification code
  -> Kratos marks email verified
  -> Auth Portal /welcome
  -> User signs in with email + password
```

## File By File

### 1. Registration Page

File:
- `apps/auth/src/app/register/page.tsx`

Responsibilities:

1. Reads `flow` and optional `return_to`.
2. Creates or reloads the Kratos browser registration flow.
3. Renders one password-first form through `KratosFlowForm`.
4. Restricts the visible fields to the registration fields we want.

Important implementation detail:

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

That tells the portal to prefer Kratos' `password` section, but the important behavior is in the flow partitioning code:

1. Kratos trait inputs like `traits.email`, `traits.name.first`, `traits.name.last`, and `traits.gender` usually come from the `default` group.
2. [`buildSections()`](/Users/mac/Desktop/Projects/library/apps/auth/src/components/flow/partition.ts) merges those default inputs into any non-default section it renders.
3. [`FlowSection`](/Users/mac/Desktop/Projects/library/apps/auth/src/components/flow/section.tsx) renders one HTML `<form>` per section.

So:

1. if Kratos exposes a `password` submit group, the trait inputs are merged into that same password form and submitted together
2. if Kratos exposes separate `profile` and `password` submit groups, the portal will render separate forms
3. if Kratos only exposes `profile`, the portal cannot invent a password input on its own

### 2. Password Confirmation

File:
- `apps/auth/src/components/flow/section.tsx`

Responsibilities:

1. Adds a client-side confirm-password field when the rendered section is `password`.
2. Prevents submission when the two passwords do not match.

This is UI validation only. Kratos still receives the real password field and remains the source of truth.

### 3. Verification Page

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

### 4. Welcome Page

File:
- `apps/auth/src/app/welcome/page.tsx`

Responsibilities:

1. Gives the user a clean post-verification finish screen.
2. Sends them to sign in with the account they just created.

### 5. Legacy `/setup`

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

### Step 2. Portal Renders The Full Registration Form

Kratos returns registration UI nodes, and the portal narrows them to the fields we want.

Mechanically, that happens like this:

1. [`apps/auth/src/app/register/page.tsx`](/Users/mac/Desktop/Projects/library/apps/auth/src/app/register/page.tsx) asks for the `password` section and allowlists the trait fields plus `password`.
2. [`apps/auth/src/components/flow/partition.ts`](/Users/mac/Desktop/Projects/library/apps/auth/src/components/flow/partition.ts) merges `default` inputs into the chosen non-default section.
3. [`apps/auth/src/components/flow/section.tsx`](/Users/mac/Desktop/Projects/library/apps/auth/src/components/flow/section.tsx) renders the resulting section as one `<form>` posting to Kratos' `flow.ui.action`.

Expected visible form:

1. First Name
2. Last Name
3. Gender
4. Email
5. Password
6. Confirm Password
7. Register button

### Step 3. User Submits Password Registration

Browser posts directly to Kratos using the flow action URL.

Kratos then:

1. Creates the identity.
2. Stores the password hash.
3. Creates a Kratos session.
4. Starts email verification.
5. Redirects to the verification UI because `show_verification_ui` is configured for password registration.

Relevant config:

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

### Step 4. User Verifies Email

The verification flow is a separate Kratos flow.

The portal page at `/verification` renders the verification nodes and posts them back to Kratos. Kratos checks the code and updates the identity's verifiable address state.

### Step 5. User Signs In

After verification, the user lands on `/welcome` and signs in with:

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

BookShare accepts that tradeoff and enforces verification before OAuth login is accepted.

## Files To Check When This Flow Changes

1. `apps/auth/src/app/register/page.tsx`
2. `apps/auth/src/app/verification/page.tsx`
3. `apps/auth/src/app/welcome/page.tsx`
4. `apps/auth/src/app/settings/page.tsx`
5. `apps/auth/src/app/oauth/login/route.ts`
6. `apps/web/src/app/auth/register/page.tsx` (compatibility redirect to login)
7. `infra/ory/kratos/kratos.yml`
8. `infra/ory/kratos/identity.schema.json`
