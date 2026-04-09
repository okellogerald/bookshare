# Forgot Password Flow — Complete Technical Reference

> This document traces the full BookShare password recovery flow from clicking "Forgot password?" to setting a new password and signing back in. It includes real Kratos API responses captured from a live local environment, explains every decision and redirect, and calls out exactly what happens at the database level.
>
> **Prerequisites:** Read [AUTH-SYSTEM.md](./AUTH-SYSTEM.md) first for key concepts (flows, methods, hooks, CSRF, etc.)
>
> **Raw traces:** [kratos-recovery-traces.md](./kratos-recovery-traces.md) — Contains the full recovery path with SQLite row dumps.

---

## Table of Contents

- [Execution Path — File by File](#execution-path--file-by-file)
- [The Recovery Journey at a Glance](#the-recovery-journey-at-a-glance)
- [How Recovery Actually Works (The Surprising Part)](#how-recovery-actually-works-the-surprising-part)
- [What Kratos Exposes vs. What the UI Shows](#what-kratos-exposes-vs-what-the-ui-shows)
- [Phase 1: Start Recovery Flow](#phase-1-start-recovery-flow)
- [Phase 2: Submit Email Address](#phase-2-submit-email-address)
- [Phase 3: Submit Recovery Code](#phase-3-submit-recovery-code)
- [Phase 4: Set New Password (Settings Flow)](#phase-4-set-new-password-settings-flow)
- [Phase 5: Return to Login](#phase-5-return-to-login)
- [How the Auth Portal Detects Recovery vs. Normal Settings](#how-the-auth-portal-detects-recovery-vs-normal-settings)
- [Configuration That Drives This Flow](#configuration-that-drives-this-flow)
- [Error Scenarios](#error-scenarios)
- [Database State at Each Phase](#database-state-at-each-phase)
- [Security Considerations](#security-considerations)
- [File Reference](#file-reference)

---

## Execution Path — File by File

This is the complete linear execution path of the forgot-password flow. Every file is listed in the exact order it executes.

> **💡 Tip: Why this section exists**
> The recovery flow touches 4 files across 1 app (Auth Portal). Unlike registration, the Web App is not involved until after the password is reset and the user logs in normally. When debugging, you need to know "which file handles this step?" without reading the entire document.

```
STEP 1  Auth Portal login page ──→ STEP 2  Auth Portal recovery page
   ("Forgot password?" link)             (email entry → code entry)
                                                  │
                                                  ▼
                                          STEP 3  Auth Portal settings page
                                             (password reset mode)
                                                  │
                                                  ▼
                                          STEP 4  Auth Portal login page
                                             (user logs in normally)
```

---

### Step 1: Auth Portal Login Page

**File:** `apps/auth/src/app/login/page.tsx`

**Who comes here:** User who can't remember their password and is on the login page.

**What it does:** Renders a dedicated login form that includes a "Forgot password?" footer link to `/recovery`.

```tsx
<FlowFooterLinks
  links={[
    { href: model.registerHref, label: "Register" },
    { href: model.recoveryHref, label: "Forgot password?" },
  ]}
/>
```

**Where they go next:** Navigation to `/recovery` → Step 2.

---

### Step 2: Auth Portal Recovery Page

**File:** `apps/auth/src/app/recovery/page.tsx`

**Who comes here:** User who clicked "Forgot password?".

**What it does:** This page handles the Kratos recovery flow. Unlike the registration page (which filters aggressively), the recovery page delegates all rendering to `KratosFlowForm` **without any filtering**:

```tsx
<KratosFlowForm
  flow={flow}
  title="Recover account"
  description="Reset your password via email code."
  links={[{ href: "/login", label: "Back to sign in" }]}
/>
```

No `sectionGroups`, no `fieldAllowlist`, no `submitAllowlist`. Why? Because the recovery flow only has one method (`code`), so there's nothing to filter out. Kratos's state machine controls the progression:
- `choose_method` state → email input + submit button
- `sent_email` state → code input + submit button + resend button

The page checks:
- `flowId` — If missing, creates a new recovery flow via Kratos
- `return_to` — Preserved but not critical for this flow
- If flow is expired/invalid → creates a new one

**Where they go next:** After code verification, Kratos creates a privileged session and redirects to `/settings?flow={settings-id}` → Step 3.

---

### Step 3: Auth Portal Settings Page (Recovery Mode)

**File:** `apps/auth/src/app/settings/page.tsx`

**Who comes here:** Kratos redirected here after successful recovery code verification.

**What it does:** This page serves dual purpose — normal account settings AND recovery-triggered password resets. It detects the context:

```ts
const isRecoveryReset =
  hasKratosAuthenticationMethod(session, "code_recovery") ||
  flowMessages.some((message) => message.id === 1060001);
```

| Context | Title | Section | On Success |
|---|---|---|---|
| Normal settings | "Account settings" | `["profile"]` | Stays on settings |
| Recovery reset | "Reset password" | `["password"]` | Redirects to `/login` |

Two signals identify recovery: the `code_recovery` session method and the recovery success message (ID 1060001). Either triggers password-only mode.

**Where they go next:** On success → redirect to `/login` → Step 4.

---

### Step 4: Auth Portal Login Page

**File:** `apps/auth/src/app/login/page.tsx`

**Who comes here:** User who just reset their password.

**What it does:** Standard login. The user enters their email + new password and goes through the normal login flow (see [LOGIN-FLOW.md](./LOGIN-FLOW.md)).

**Why not auto-login:** The recovery session (`code_recovery`) is a Kratos session, not an OAuth session. The Web App needs OAuth tokens. Rather than building a recovery-to-OAuth bridge, the user simply logs in — confirming the new password works.

---

## The Recovery Journey at a Glance

```
User clicks          Auth Portal          Kratos                          Web App
"Forgot password?"
     |
     +--------------> /recovery
     |                    |
     |                    +--------------> GET /self-service/recovery/browser
     |                    |                    |
     |                    |<--------------- 303 + ?flow={id} + csrf cookie
     |                    |
     |                    +--------------> GET /self-service/recovery/flows?id=...
     |                    |<--------------- 200 { state: "choose_method", nodes: [email, submit] }
     |                    |
     |<--------------- render email form
     |
     | enters email
     +--------------> POST /self-service/recovery?flow=...
     |                                   |
     |                    |<------------- 303 (flow updated, code sent)
     |                    |
     |                    +--------------> GET /self-service/recovery/flows?id=...
     |                    |<--------------- 200 { state: "sent_email", nodes: [code input, submit] }
     |                    |
     |<--------------- render code form
     |                                   mail: "Use code 093334 to recover..."
     | enters code
     +--------------> POST /self-service/recovery?flow=...
     |                                   |
     |                    |<------------- 303 + ory_kratos_session cookie
     |                                   |   privileged session created (method: code_recovery)
     |                                   |   NEW settings flow created
     |                    |
     |                    +--- redirected to /settings?flow={settings_flow_id}
     |                    |
     |                    +--------------> GET /self-service/settings/flows?id=...
     |                    |<--------------- 200 { nodes: [password, profile], message: "change password within 15 min" }
     |                    |
     |                    |--- detects code_recovery session
     |                    |--- renders ONLY the password section
     |                    |
     |<--------------- render new password form ("Reset password")
     |
     | enters new password
     +--------------> POST /self-service/settings?flow=...
     |                                   |
     |                    |<------------- 303 (password hash updated)
     |                    |
     |                    |--- detects success + recovery context
     |                    |
     |<--------------- redirect to /login
     |
     | user logs in normally with new password
```

> **💡 Tip: This flow involves TWO Kratos flows, not one**
> Recovery in Kratos is a two-flow operation: a **recovery flow** (verify identity via code) followed by a **settings flow** (change the password). The recovery flow proves "you own this email." The settings flow performs the actual credential change. This is different from many auth systems where "forgot password" is a single-step reset.
>
> 📖 [Ory docs: Account recovery](https://www.ory.sh/docs/kratos/self-service/flows/account-recovery-password-reset)

---

## How Recovery Actually Works (The Surprising Part)

Most developers expect a "forgot password" flow like this:

```
Enter email → Get code → Enter code + new password → Done
```

Kratos does something different. The recovery flow itself **never touches the password**. Instead:

1. **Recovery flow** — Verifies identity via emailed code
2. **Privileged session** — Creates a temporary session (method: `code_recovery`) that grants the right to change sensitive settings
3. **Settings flow** — A normal settings flow where the user changes their password

This is a deliberately modular design. The recovery flow's only job is to prove identity. What happens next (password change, MFA reset, etc.) is handled by the settings flow, which already knows how to update credentials.

> **💡 Tip: What is a "privileged session"?**
> In Kratos, certain actions (changing password, changing email) require a "privileged" session — one where authentication happened recently enough that Kratos is confident the right person is acting. The `privileged_session_max_age` in `kratos.yml` controls this window (BookShare: 15 minutes). After a recovery code is accepted, Kratos creates a fresh session that is inherently privileged because authentication *just* happened.
>
> If the user takes longer than 15 minutes to submit a new password, the settings flow would require re-authentication. In practice this rarely happens because users reset their password immediately.
>
> 📖 [Ory docs: Privileged sessions](https://www.ory.sh/docs/kratos/session-management/session#privileged-sessions)

---

## What Kratos Exposes vs. What the UI Shows

### Raw Kratos Recovery Flow (initial state)

From a live trace (flow ID: `b64f1b19-8eff-4132-9921-12da8ada424a`):

```json
{
  "id": "b64f1b19-8eff-4132-9921-12da8ada424a",
  "state": "choose_method",
  "expires_at": "2026-03-13T11:08:03.973524255Z",
  "return_to": "http://localhost:3337",
  "ui": {
    "action": "http://localhost:4433/self-service/recovery?flow=b64f1b19-...",
    "nodes": [
      { "group": "default", "name": "csrf_token", "type": "hidden" },
      { "group": "code",    "name": "email",      "type": "email",  "required": true },
      { "group": "code",    "name": "method",     "type": "submit", "value": "code" }
    ]
  }
}
```

> **💡 Tip: Recovery only has ONE method — `code`**
> Unlike login (which has both `password` and `code` methods), recovery only uses `code`. This is set in `kratos.yml` under `recovery.use: code`. There is no "recovery via password" — that would be circular (you forgot your password, so enter your password to recover?). The alternative method `link` sends a clickable URL instead of a numeric code.
>
> 📖 [Ory docs: Recovery strategies](https://www.ory.sh/docs/kratos/self-service/flows/account-recovery-password-reset#recovery-method)

### What the Auth Portal Renders

File: `apps/auth/src/app/recovery/page.tsx`

```tsx
<KratosFlowForm
  flow={flow}
  title="Recover account"
  description="Reset your password via email code."
  links={[{ href: "/login", label: "Back to sign in" }]}
/>
```

The recovery page is the simplest Auth Portal page — no `sectionGroups` filter, no `fieldAllowlist`. It renders whatever Kratos provides directly. Since the recovery flow only has the `code` group, this naturally shows:

- An email input field
- A "Submit" button
- A "Back to sign in" link

> **💡 Tip: No `sectionGroups` prop means "render all sections"**
> When `sectionGroups` is not passed to `KratosFlowForm`, the `buildSections()` function in `partition.ts` includes all non-default groups. For recovery, there's only one group (`code`), so it renders a single section. The login flow now has its own dedicated email-and-password form, and the config still disables passwordless code login underneath.

---

## Phase 1: Start Recovery Flow

### Step 1.1: User Clicks "Forgot password?"

The "Forgot password?" link appears on the login page as a footer link:

```tsx
// apps/auth/src/app/login/page.tsx
links={[
  { href: "/recovery", label: "Forgot password?" },
]}
```

This navigates to `/recovery` on the Auth Portal — no query parameters.

### Step 1.2: Auth Portal Creates Recovery Flow

The recovery page checks for a `?flow=` parameter. None exists, so it redirects to Kratos:

```ts
if (!flowId) {
  redirect(createBrowserFlowUrl("recovery", returnTo));
}
```

This calls:

```http
GET http://localhost:4433/self-service/recovery/browser?return_to=http://localhost:3337
```

### Step 1.3: Kratos Creates Flow and Redirects

**Kratos response:**

```http
HTTP/1.1 303 See Other
Location: http://localhost:3337/recovery?flow=b64f1b19-8eff-4132-9921-12da8ada424a
Set-Cookie: csrf_token_...=IvQ3t85Ts13W51LUKsSVRPBCKJV1ueyXI+lCUNX2hoo=
```

**What happened server-side:**
1. Kratos created a `selfservice_recovery_flows` row in the database
2. Set the flow state to `choose_method`
3. Set a CSRF cookie for the browser
4. Redirected back to the Auth Portal's `recovery` page with the flow ID

> **💡 Tip: Recovery flows have no explicit lifespan in `kratos.yml`**
> Unlike login (`lifespan: 10m`) and registration (`lifespan: 1h`), the recovery flow uses Kratos's default lifespan. From the trace, the flow expired at +1 hour (`11:08` vs `10:08` creation time). This default can be overridden with `recovery.lifespan` in the config.

### Step 1.4: Auth Portal Fetches Flow

```http
GET http://localhost:4433/self-service/recovery/flows?id=b64f1b19-8eff-4132-9921-12da8ada424a
Cookie: csrf_token_...=IvQ3t85Ts13W51LUKsSVRPBCKJV1ueyXI+lCUNX2hoo=
```

Returns the flow JSON shown [above](#raw-kratos-recovery-flow-initial-state). The page renders the email form.

### Kratos State at This Point

- **No session exists** — the user clicked "Forgot password?" from the login page (not authenticated)
- **No recovery code exists** — the code is only created when the user submits their email
- **`GET /sessions/whoami` returns 401**

---

## Phase 2: Submit Email Address

### Step 2.1: User Enters Email

The form submits directly to Kratos (the `action` URL from the flow JSON):

```http
POST http://localhost:4433/self-service/recovery?flow=b64f1b19-8eff-4132-9921-12da8ada424a
Content-Type: application/x-www-form-urlencoded

csrf_token=dYiy8RRTYPeexBfJus%2Bkxg4q9XGPKo8MBBdMamjFhV9XfIVG2gDTqkgjRR2QCzGC%2Fmjd5PqTY5sn%2Fg46vTMD1Q%3D%3D
email=codex.1773385571%40example.com
method=code
```

### Step 2.2: Kratos Processes the Submission

**Kratos response:**

```http
HTTP/1.1 303 See Other
Location: http://localhost:3337/recovery?flow=b64f1b19-8eff-4132-9921-12da8ada424a
```

**What happened server-side:**
1. Kratos validated the CSRF token
2. Looked up the identity by email address
3. Created an `identity_recovery_codes` row with a hashed code
4. Sent the code via email (through the SMTP courier → Mailpit)
5. Updated the flow state from `choose_method` to `sent_email`
6. Redirected back to the same flow (the Auth Portal re-fetches and renders the new state)

### Step 2.3: Flow State After Email Submission

```json
{
  "id": "b64f1b19-8eff-4132-9921-12da8ada424a",
  "state": "sent_email",
  "active": "code",
  "ui": {
    "messages": [
      {
        "id": 1060003,
        "text": "An email containing a recovery code has been sent to the email address you provided. If you have not received an email, check the spelling of the address and make sure to use the address you registered with.",
        "type": "info"
      }
    ],
    "nodes": [
      { "group": "default", "name": "csrf_token",  "type": "hidden" },
      { "group": "code",    "name": "code",         "type": "text",   "required": true },
      { "group": "code",    "name": "method",        "type": "hidden", "value": "code" },
      { "group": "code",    "name": "method",        "type": "submit", "value": "code" },
      { "group": "code",    "name": "email",         "type": "submit", "value": "codex.1773385571@example.com" }
    ]
  }
}
```

> **💡 Tip: Flow state transition: `choose_method` → `sent_email`**
> This is the same state machine pattern used in registration's code flow. The `state` field tells the UI what screen to show. When `state` is `choose_method`, show the email input. When `state` is `sent_email`, show the code input. The Auth Portal doesn't need to track this manually — Kratos tells it what to render by changing the nodes.

> **💡 Tip: The `email` node changed from an input to a submit button**
> In the initial flow, `email` was `type: "email"` (an input field). After submission, it becomes `type: "submit"` with the email as its `value`. This is Kratos's way of offering a "Resend code" button — clicking it re-submits the email to trigger a new code. The `FlowSection` component renders submit nodes as buttons.

### Step 2.4: The Email

Mailpit received:

```
Subject: Use code 093334 to recover access to your account
Body:    Recover access to your account by entering the following code: 093334
```

> **💡 Tip: Recovery code vs. registration code**
> Both use the `code` method, but they're stored in different tables:
> - Registration codes → `identity_verification_codes`
> - Recovery codes → `identity_recovery_codes`
>
> The recovery code is a 6-digit number. Like registration codes, it is stored as a SHA-256 hash — the plaintext never persists in the database.

> **💡 Tip: What if the email doesn't exist?**
> Kratos still transitions to `sent_email` and shows the same info message. It does NOT tell the user "this email isn't registered." This prevents user enumeration — an attacker can't use the recovery flow to discover which emails have accounts. No email is actually sent for non-existent addresses.
>
> 📖 [Ory docs: Anti-enumeration](https://www.ory.sh/docs/kratos/concepts/security#account-enumeration-defenses)

---

## Phase 3: Submit Recovery Code

### Step 3.1: User Enters Code

```http
POST http://localhost:4433/self-service/recovery?flow=b64f1b19-8eff-4132-9921-12da8ada424a
Content-Type: application/x-www-form-urlencoded

csrf_token=JsXfr7Omw1GCwwVeIcIH0fZ1XObeBzW1zvQalHgcTtkEMegYffVwDFQkV4oLBpKVBjd0c6u%2B2SLtHVjErerIUw%3D%3D
method=code
code=093334
```

### Step 3.2: Kratos Validates Code and Creates Session

**Kratos response:**

```http
HTTP/1.1 303 See Other
Location: http://localhost:3337/settings?flow=1c33d1fa-4112-4a37-997a-95b4a010ffcd
Set-Cookie: ory_kratos_session=...; HttpOnly; SameSite=Lax
```

This is the **critical transition point**. Three things happened simultaneously:

1. **Recovery flow completed** — Kratos verified the code hash, marked the recovery code as used, and updated the flow state to `passed_challenge`
2. **Privileged session created** — A new Kratos session with `authentication_methods: [{ method: "code_recovery" }]`
3. **Settings flow created** — A brand-new settings flow, ready for password change

> **💡 Tip: Why `code_recovery` and not just `code`?**
> The session method `code_recovery` is distinct from `code` (which is used for code-based login). This distinction is critical for the Auth Portal — it's the signal that says "this settings visit came from account recovery, not from a normal login or direct navigation to settings." The Auth Portal checks this to decide whether to show the password form or the profile form.

> **💡 Tip: The recovery flow did NOT redirect to `return_to`**
> Even though the recovery flow had `return_to: "http://localhost:3337"`, Kratos ignored it and redirected to the settings UI (`/settings?flow=...`). This is by design — after recovery, the user MUST change their password (or set up an alternative). The `return_to` is used after the settings flow succeeds.

### Step 3.3: Immediate Post-Recovery Session

`GET /sessions/whoami` now returns:

```json
{
  "id": "6d3e9693-5c30-41a4-a836-09514245985d",
  "active": true,
  "authentication_methods": [
    {
      "method": "code_recovery",
      "aal": "aal1",
      "completed_at": "2026-03-13T10:08:33.983639297Z"
    }
  ],
  "identity": {
    "id": "f9c95ce2-8654-4ea2-8f89-eb85f877352f",
    "traits": {
      "email": "codex.1773385571@example.com",
      "name": {}
    }
  }
}
```

> **💡 Tip: `aal1` — Authenticator Assurance Level 1**
> AAL1 means "single-factor authentication." The recovery code proves email ownership (one factor). If the app required AAL2 (multi-factor), the user would need to complete an additional step before changing their password. BookShare uses AAL1 only.
>
> 📖 [Ory docs: Session AAL](https://www.ory.sh/docs/kratos/mfa/overview)

---

## Phase 4: Set New Password (Settings Flow)

### Step 4.1: Auth Portal Fetches Settings Flow

The browser was redirected to:

```
http://localhost:3337/settings?flow=1c33d1fa-4112-4a37-997a-95b4a010ffcd
```

The settings page fetches this flow:

```http
GET http://localhost:4433/self-service/settings/flows?id=1c33d1fa-4112-4a37-997a-95b4a010ffcd
Cookie: ory_kratos_session=...
```

### Step 4.2: The Settings Flow Response

```json
{
  "id": "1c33d1fa-4112-4a37-997a-95b4a010ffcd",
  "state": "show_form",
  "return_to": "http://localhost:3337",
  "identity": {
    "id": "f9c95ce2-8654-4ea2-8f89-eb85f877352f",
    "traits": {
      "email": "codex.1773385571@example.com",
      "name": {}
    }
  },
  "ui": {
    "messages": [
      {
        "id": 1060001,
        "text": "You successfully recovered your account. Please change your password or set up an alternative login method (e.g. social sign in) within the next 15.00 minutes.",
        "type": "success"
      }
    ],
    "nodes": [
      { "group": "default",  "name": "csrf_token",       "type": "hidden" },
      { "group": "profile",  "name": "traits.email",     "type": "email" },
      { "group": "profile",  "name": "traits.name.first", "type": "text" },
      { "group": "profile",  "name": "traits.name.last",  "type": "text" },
      { "group": "profile",  "name": "traits.gender",     "type": "text" },
      { "group": "profile",  "name": "method",            "type": "submit", "value": "profile" },
      { "group": "password", "name": "password",          "type": "password", "autocomplete": "new-password" },
      { "group": "password", "name": "method",            "type": "submit", "value": "password" }
    ]
  }
}
```

> **💡 Tip: Kratos returns BOTH `profile` and `password` sections**
> This is important: Kratos doesn't know the context. It returns the full settings form — profile fields AND password field — every time. The Auth Portal is responsible for choosing which section to show based on context. Without this logic, the recovery flow would show the profile editor instead of the password reset form.

> **💡 Tip: Message ID `1060001` — the recovery success message**
> The text says you have 15 minutes to change your password. This isn't just a warning — it's the `privileged_session_max_age: 15m` from `kratos.yml`. After 15 minutes, the session is no longer privileged and Kratos will reject the password change with a `session_refresh_required` error.

### Step 4.3: Auth Portal Detects Recovery Context

File: `apps/auth/src/app/settings/page.tsx`

The settings page runs two detection checks:

```ts
const session = await getKratosSession();
const isRecoveryReset =
  hasKratosAuthenticationMethod(session, "code_recovery") ||
  flowMessages.some((message) => message.id === 1060001);
```

| Check | What It Detects | Why Both? |
|---|---|---|
| `hasKratosAuthenticationMethod(session, "code_recovery")` | Session was created by the recovery flow | Primary signal — checks the session's `authentication_methods` array |
| `flowMessages.some(m => m.id === 1060001)` | Flow contains the recovery success message | Fallback — in case the session check fails or the session method changes in a future Kratos version |

When `isRecoveryReset` is `true`, the page adapts:

| Aspect | Normal Settings | Recovery Reset |
|---|---|---|
| **Title** | "Account settings" | "Reset password" |
| **Description** | "Manage profile details for {email}." | "Set a new password for {email}." |
| **`sectionGroups`** | `["profile"]` | `["password"]` |
| **`fieldAllowlist`** | `["traits.email", "traits.name.first", ...]` | `["password"]` |
| **Password confirmation** | Disabled | Enabled (`enablePasswordConfirmation={true}`) |

> **💡 Tip: `enablePasswordConfirmation` adds a client-side confirm field**
> This is NOT a Kratos field — Kratos only sends one `password` input. The Auth Portal's `FlowSection` component adds a second "Confirm password" input when `enablePasswordConfirmation` is true. Validation happens client-side before submitting to Kratos. Only the main `password` field is sent to Kratos.

### Step 4.4: Submit New Password

```http
POST http://localhost:4433/self-service/settings?flow=1c33d1fa-4112-4a37-997a-95b4a010ffcd
Content-Type: application/x-www-form-urlencoded

csrf_token=C2t%2FlyIvyfaww%2BMDGzjWq%2BgforoFMDoZJ4K7n%2FdCzwlGwuxySXEZ8g3C1dKrMk5qQaC2fz7YauUvtvpTqv84SA%3D%3D
password=RecoveredPassw0rd%219
method=password
```

**Kratos response:**

```http
HTTP/1.1 303 See Other
Location: http://localhost:3337
Set-Cookie: ory_kratos_session=...; HttpOnly; SameSite=Lax
```

**What happened server-side:**
1. Kratos validated the session is still privileged (within the 15-minute window)
2. Hashed the new password with bcrypt (cost: 8)
3. Updated the `identity_credentials` row — same row ID, new `config.hashed_password`
4. Updated the `updated_at` timestamp on the credential
5. Marked the settings flow as `success`
6. Re-issued the `ory_kratos_session` cookie (session continues)

### Step 4.5: Flow State After Password Update

Fetching the same settings flow now returns:

```json
{
  "id": "1c33d1fa-4112-4a37-997a-95b4a010ffcd",
  "state": "success",
  "ui": {
    "messages": [
      {
        "id": 1050001,
        "text": "Your changes have been saved!",
        "type": "success"
      }
    ]
  }
}
```

> **💡 Tip: The session method stays `code_recovery`**
> Even after the password is changed, the session's `authentication_methods` still shows `code_recovery`. The password update does NOT upgrade the session to a `password` method session. This makes sense — the user proved identity via code, then used a privileged settings flow to change the password. The session remains as it was created.

---

## Phase 5: Return to Login

### Step 5.1: Auth Portal Detects Success + Recovery Context

The settings page re-fetches the flow and evaluates:

```ts
if (isRecoveryReset && hasSuccessMessage) {
  redirect("/login");
}
```

Both conditions are true:
- `isRecoveryReset`: session method is `code_recovery`
- `hasSuccessMessage`: flow messages contain a `type: "success"` message (ID 1050001)

**The user is redirected to `/login`.**

> **💡 Tip: Why redirect to login instead of directly into the app?**
> After a password reset, the user has a `code_recovery` session — not a normal `password` session. The Web App expects an OAuth token-based session (access token, ID token, DPoP key), which only comes from completing the full login flow through Hydra. Redirecting to `/login` ensures:
> 1. The user confirms their new password works
> 2. A proper OAuth session is created with all tokens
> 3. The DPoP keypair is generated fresh
>
> The `code_recovery` Kratos session is still active, so depending on Hydra's remember settings, the login may be fast-tracked (the user enters their new password and the OAuth flow completes automatically).

---

## How the Auth Portal Detects Recovery vs. Normal Settings

This is the core challenge: Kratos uses the **same** settings flow for both "user editing their profile" and "user resetting their password after recovery." The Auth Portal must distinguish between these.

### Detection Logic (in `settings/page.tsx`)

```ts
const isRecoveryReset =
  hasKratosAuthenticationMethod(session, "code_recovery") ||
  flowMessages.some((message) => message.id === 1060001);
```

### Three signals that indicate recovery:

| Signal | Source | Reliability |
|---|---|---|
| Session method is `code_recovery` | `GET /sessions/whoami` → `authentication_methods[].method` | **Primary** — most reliable |
| Flow message ID `1060001` | Settings flow JSON → `ui.messages[].id` | **Secondary** — recovery-specific message |
| Settings flow `request_url` points to recovery | Settings flow JSON → `request_url` | **Informational** — not used in code, but visible in DB |

### The bug this detection fixes

Without this logic, the settings page defaulted to `sectionGroups={["profile"]}`. When a user completed recovery, they saw the profile editor (name, email, gender) instead of the password reset form. The password section was present in the Kratos response but hidden by the UI.

---

## Configuration That Drives This Flow

### kratos.yml — Recovery Section

```yaml
recovery:
  enabled: true
  ui_url: http://localhost:3337/recovery
  use: code
```

| Setting | Value | Effect |
|---|---|---|
| `enabled` | `true` | Recovery flows can be created. If `false`, Kratos returns 404 for recovery endpoints |
| `ui_url` | `http://localhost:3337/recovery` | Where Kratos redirects the browser after creating a recovery flow |
| `use` | `code` | Recovery method — numeric code via email. Alternative: `link` (clickable URL) |

### kratos.yml — Settings Section (Used After Recovery)

```yaml
settings:
  ui_url: http://localhost:3337/settings
  privileged_session_max_age: 15m
```

| Setting | Value | Effect |
|---|---|---|
| `privileged_session_max_age` | `15m` | How long after authentication the session can perform sensitive changes (password, email). After 15 minutes, the session is downgraded and sensitive operations require re-authentication |

### kratos.yml — Code Method

```yaml
methods:
  code:
    enabled: true
    config:
      lifespan: 1h
```

The `lifespan: 1h` applies to the code validity. Recovery codes expire after 1 hour.

### kratos.yml — Password Hasher

```yaml
hashers:
  algorithm: bcrypt
  bcrypt:
    cost: 8
```

The new password is hashed with bcrypt cost 8 (development setting — production should use 12+).

---

## Error Scenarios

### Wrong Recovery Code

Kratos returns the flow with an error message:

```json
{
  "state": "sent_email",
  "ui": {
    "messages": [
      {
        "id": 4060005,
        "text": "The recovery code is invalid or has already been used. Please try again.",
        "type": "error"
      }
    ]
  }
}
```

The flow remains in `sent_email` state. The user can try again with a new code (if they request a resend) or re-enter the correct code.

### Expired Recovery Flow

If the recovery flow lifespan elapses:

```json
{
  "error": {
    "id": "self_service_flow_expired",
    "code": 410,
    "reason": "The recovery flow expired, please try again."
  }
}
```

`getBrowserFlow()` returns `null`. The recovery page creates a fresh flow:

```ts
const flow = await getBrowserFlow("recovery", flowId);
if (!flow) {
  redirect(createBrowserFlowUrl("recovery", returnTo));
}
```

### Expired Recovery Code

Recovery codes have their own lifespan (aligned with the `code.config.lifespan: 1h` setting). If the code expires before submission, Kratos returns an error similar to the "wrong code" case.

### Privileged Session Expired (15-Minute Window)

If the user waits too long before submitting the new password:

```json
{
  "error": {
    "id": "session_refresh_required",
    "code": 403,
    "reason": "The login session is too old and must be re-authenticated."
  }
}
```

The user must restart the recovery flow from scratch.

> **💡 Tip: This is rare in practice**
> The 15-minute window starts when the recovery code is accepted. Users almost always enter a new password within seconds. This timeout mainly protects against scenarios where someone walks away from their computer with the password reset form open.

### Email Not Found (Anti-Enumeration)

As noted in Phase 2, Kratos does NOT reveal whether an email exists. The flow transitions to `sent_email` regardless. No error is returned for non-existent emails.

---

## Database State at Each Phase

From the live SQLite trace (identity: `f9c95ce2-8654-4ea2-8f89-eb85f877352f`):

### Phase 1: Recovery Flow Created

```
selfservice_recovery_flows:  1 new row
  id: b64f1b19-8eff-4132-9921-12da8ada424a
  state: choose_method
  active_method: code
  expires_at: +1 hour from creation
```

### Phase 2: Email Submitted

```
identity_recovery_codes:  1 new row
  code: SHA-256 hash (plaintext NEVER stored)
  flow_id: b64f1b19-... (links to recovery flow)
  identity_id: f9c95ce2-... (links to identity)
  used_at: NULL (not yet submitted)
  expires_at: +1 hour from creation

selfservice_recovery_flows:
  state: sent_email (updated from choose_method)
```

### Phase 3: Recovery Code Accepted

```
identity_recovery_codes:
  used_at: 2026-03-13T10:08:33Z (now populated)

sessions:  1 new row
  id: 6d3e9693-5c30-41a4-a836-09514245985d
  authentication_methods: [{"method":"code_recovery","aal":"aal1"}]
  identity_id: f9c95ce2-...

selfservice_settings_flows:  1 new row
  id: 1c33d1fa-4112-4a37-997a-95b4a010ffcd
  state: show_form
  request_url: points back to recovery flow origin

selfservice_recovery_flows:
  state: passed_challenge (updated from sent_email)
```

### Phase 4: New Password Submitted

```
identity_credentials (password row):
  config.hashed_password: NEW bcrypt hash (replaced in place)
  updated_at: 2026-03-13T10:09:05Z (moved forward)
  (same row ID — credential not deleted/recreated)

selfservice_settings_flows:
  state: success (updated from show_form)

sessions:
  (unchanged — still code_recovery method)
```

> **💡 Tip: The password credential row is updated in place**
> Kratos doesn't delete the old credential and create a new one. It updates the `config` JSON (new bcrypt hash) and the `updated_at` timestamp. The credential type ID and identity link remain the same. This means the credential's creation date still reflects when the user first set a password, while `updated_at` shows the last password change.

---

## Security Considerations

### Anti-Enumeration

The recovery flow never reveals whether an email is registered. Both existing and non-existing emails produce identical user-visible behavior (same flow state transition, same UI message).

### Recovery Code Hashing

Recovery codes are stored as SHA-256 hashes. Even with database access, an attacker cannot extract valid codes.

### Privileged Session Window

The 15-minute window limits exposure. If an attacker somehow obtains the recovery session cookie, they have a limited window to change the password.

### No Direct Password Reset

Kratos deliberately avoids a "enter code + new password in one step" design. The two-flow approach means:
1. The recovery flow can't be abused to set arbitrary passwords without proving email ownership first
2. The settings flow reuses the same battle-tested code path that handles all credential changes
3. The privileged session mechanism provides a uniform security model for sensitive operations

### Session After Recovery

The `code_recovery` session is functional but limited — the Auth Portal redirects to `/login` after the password is changed, ensuring the user gets a proper OAuth session. The recovery session is not used for application access.

---

## File Reference

| Step | File | Purpose |
|---|---|---|
| 1, 4 | `apps/auth/src/app/login/page.tsx` | "Forgot password?" link + post-reset login |
| 2 | `apps/auth/src/app/recovery/page.tsx` | Email entry + code verification (delegates to Kratos) |
| 3 | `apps/auth/src/app/settings/page.tsx` | Password reset form (detects `code_recovery` context) |
| — | `apps/auth/src/lib/kratos.ts` | `getKratosSession()`, `hasKratosAuthenticationMethod()`, flow fetch |
| — | `apps/auth/src/components/kratos-flow-form.tsx` | Form renderer |
| — | `apps/auth/src/components/flow/partition.ts` | Node grouping — merges default into sections |
| — | `apps/auth/src/components/flow/section.tsx` | Password confirmation validation |
| — | `apps/auth/src/components/flow/field.tsx` | Code field rendering (numeric, 6-digit) |
| — | `infra/ory/kratos/kratos.yml` | Recovery enable, method, privileged session max age |
