# Registration Flow — Complete Technical Reference

> This document traces the full BookShare registration flow from first click to authenticated session. It includes real Kratos API responses captured from a live local environment, explains every decision and redirect, and calls out exactly what happens at the database level.
>
> **Prerequisites:** Read [AUTH-SYSTEM-V2.md](./AUTH-SYSTEM-V2.md) first for key concepts (flows, methods, hooks, CSRF, etc.)
>
> **Raw traces:** [kratos-registration-traces.md](./kratos-registration-traces.md) — Contains both the code and password registration paths with SQLite row dumps.

---

## Table of Contents

- [Execution Path — File by File](#execution-path--file-by-file)
- [The Registration Journey at a Glance](#the-registration-journey-at-a-glance)
- [What Kratos Exposes vs. What the UI Shows](#what-kratos-exposes-vs-what-the-ui-shows)
- [Phase 1: Entering Registration](#phase-1-entering-registration)
- [Phase 2: Email Entry](#phase-2-email-entry)
- [Phase 3: Code Verification](#phase-3-code-verification)
- [Phase 4: Password Setup](#phase-4-password-setup)
- [Phase 5: Profile Completion](#phase-5-profile-completion)
- [Phase 6: Post-Registration Redirect](#phase-6-post-registration-redirect)
- [Alternate Path: Password Registration (Raw Kratos)](#alternate-path-password-registration-raw-kratos)
- [Configuration That Drives This Flow](#configuration-that-drives-this-flow)
- [Error Scenarios](#error-scenarios)
- [Database State at Each Phase](#database-state-at-each-phase)
- [File Reference](#file-reference)

---

## Execution Path — File by File

This is the complete linear execution path of the registration flow. Every file is listed in the exact order it executes. Each entry says who arrives, what it does, and where the user goes next.

> **💡 Tip: Why this section exists**
> Bookshare-Web no longer exposes account creation. Registration is now an Auth Portal concern, independent from the client sign-in entrypoint.

```
STEP 1  Auth Portal middleware ─→ STEP 2  Auth Portal register page ─→ STEP 3  Auth Portal register/reset
                                          (email entry → code entry)             (optional: "use different email")
                                                                 │
                                                                 ▼
STEP 4  Auth Portal setup page ─→ STEP 5  Post-registration destination
          (password → profile)                (/login by default, or explicit return_to)
```

---

### Step 1: Auth Portal Middleware

**File:** `apps/auth/src/middleware.ts`

**Who comes here:** Every request to `/register` or `/setup` passes through this middleware.

**What it does:** Flow ID persistence — ensures the Kratos flow ID survives browser redirects:

| Request | Action |
|---|---|
| `/register?flow=abc123` | Save flow ID in `bookshare_register_flow` cookie (httpOnly, sameSite=lax, 1h TTL) |
| `/register` (no `?flow`) | Check cookie → if exists, redirect to `/register?flow={saved}` |
| `/register` (no `?flow`, no cookie) | Pass through (page will create a new flow) |
| `/setup` | Delete the `bookshare_register_flow` cookie (registration phase is over) |

**Why this exists:** During code verification, Kratos redirects the browser back to `/register` after form submission. Some redirects can lose the `?flow=` parameter. Without this cookie, the Auth Portal would lose track of the flow and start over.

**Where they go next:** Request continues to the register page (Step 2) or setup page (Step 4).

---

### Step 2: Auth Portal Register Page

**File:** `apps/auth/src/app/register/page.tsx`

**Who comes here:** User arriving at `/register` directly, or returning from Kratos with a flow ID.

**What it does:** This single page handles two states of the same Kratos registration flow:
1. Email entry (`traits.email`)
2. Code verification (`code`)

If `flow` is missing or invalid, it redirects to Kratos `GET /self-service/registration/browser` to create a new one. Once the flow exists, the page renders the email step first, then the code step after Kratos updates the flow.

**Where they go next:** Kratos redirects back here until code verification succeeds, then redirects to `/setup` (Step 4).

---

### Step 3: Auth Portal Register Reset

**File:** `apps/auth/src/app/register/reset/route.ts`

**Who comes here:** User clicks "Use a different email" during code verification.

**What it does:** Deletes the `bookshare_register_flow` cookie and redirects back to `/register` without a flow ID, forcing Kratos to create a fresh registration flow.

**Where they go next:** Fresh registration flow → Step 1 → Step 2.

---

### Step 4: Auth Portal Setup Page

**File:** `apps/auth/src/app/setup/page.tsx`

**Who comes here:** User arriving after successful code verification.

**What it does:** Handles the two-step settings flow:
1. Password setup
2. Profile completion

Both steps reuse the same Kratos settings flow. After the profile step succeeds, the page redirects to `return_to` if one exists, or `/login` if it does not.

**Where they go next:** Default path is the Auth Portal sign-in page; externally supplied `return_to` values are resumed in Step 5.

---

### Step 5: Post-Registration Destination

**File:** `apps/auth/src/app/setup/page.tsx`

**Who comes here:** User after password and profile setup completes.

**What it does:** Finishes the registration flow by redirecting:
1. To `/login` by default
2. To the provided `return_to` when registration was initiated by some external flow

**Why this matters:** Registration no longer implies an immediate Bookshare-Web sign-in. The client only exposes sign-in; registration is separate.

---
- Section: code group only (`sectionGroups=["code"]`)
- Button: "Sign up with code" (`submitAllowlist=["method"]`)
- Links: "Back to sign in"

The form POSTs directly to Kratos (not to the Auth Portal). Kratos sends the verification code and redirects back to this same page with the same flow ID.

#### State B: Code Verification (`isCodeStep = true`)

Same flow ID, but Kratos has transitioned the flow to `state: "sent_email"`. The `code` input node now exists.

- `codeEmail` — Extracted from the hidden `traits.email` node to display "Enter code sent to X"
- Renders: code field only (`fieldAllowlist=["code"]`)
- Links: "Back to sign in", "Use a different email" (→ Step 4)

The form POSTs the code to Kratos. On success, Kratos creates the identity, creates a session, and redirects to `/setup` (→ Step 5).

> **💡 Tip: Why one page for two states?**
> Both states operate on the same Kratos flow ID. Kratos models this as a state machine — the flow object transforms (different nodes appear) but the ID stays the same. Splitting into two pages would mean two pages sharing a flow ID and fighting over state. Worse, it would require passing the flow ID between pages, introducing more failure points. One page, one flow, two visual states — this is the cleanest approach.

**Where they go next:**
- State A → Kratos redirects back here (same page, now State B)
- State B → Kratos redirects to `/setup` (Step 7)
- "Use a different email" → Step 6

---

### Step 6: Auth Portal Register Reset

**File:** `apps/auth/src/app/register/reset/route.ts`

**Who comes here:** User clicks "Use a different email" during code verification (State B of Step 5).

**What it does:** Two things:
1. Deletes the `bookshare_register_flow` cookie
2. Redirects to `/register` (no `?flow=` param)

**Why:** This abandons the current flow entirely. The old flow (with the wrong email) still exists in Kratos but will expire after 1 hour. The user starts fresh with a new email. Since the cookie is deleted and there's no `?flow=` param, Step 3 will redirect to Kratos to create a brand new flow.

**Where they go next:** 302 → `/register` → Step 4 (middleware) → Step 5 (fresh flow).

---

### Step 7: Auth Portal Setup Page

**File:** `apps/auth/src/app/setup/page.tsx`

**Who comes here:** User arriving after successful code verification (Kratos redirected here from Step 5, State B).

**What it does:** Handles **two sequential steps** using the **same Kratos settings flow**:

The page checks params:
- `flowId` — If missing, creates a settings flow via `initBrowserFlow("settings", returnTo)`. This server-side call requires the `ory_kratos_session` cookie (created in Step 3). If the session is missing, Kratos returns 401 and the flow creation fails.
- `step` — Determines which section to render. Defaults to `"password"` unless explicitly `"profile"`.
- `return_to` — Preserved across both steps. After profile completion, this is where the user goes if the flow was started externally; otherwise the page falls back to `/login`.
- `hasSuccessMessage` — Triggers auto-transition between steps.

#### Step A: Password (`step=password`)

- Renders: password field + client-side confirm field (`enablePasswordConfirmation=true`)
- Section: `sectionGroups=["password"]`, `fieldAllowlist=["password"]`
- Links: "Back to sign in"
- On Kratos success message → auto-redirects to Step B:
  ```ts
  if (setupStep === "password" && hasSuccessMessage) {
    redirect(`/setup?flow=${flow.id}&step=profile`);
  }
  ```

#### Step B: Profile (`step=profile`)

- Same flow ID, different section
- Renders: email (readonly), first name, last name, gender
- Section: `sectionGroups=["profile"]`, `readonlyFieldNames=["traits.email"]`
- Links: "Back to password"
- On Kratos success message → redirects to `return_to` (or `/login` fallback):
  ```ts
  if (setupStep === "profile" && hasSuccessMessage) {
    if (returnTo) redirect(returnTo);
    redirect("/login");
  }
  ```

> **💡 Tip: Why the same settings flow for both steps?**
> Kratos settings flows contain ALL sections (profile + password) simultaneously. Creating two separate flows would mean two privileged session validations, two CSRF token exchanges, and twice the HTTP round-trips. By reusing one flow, both steps share the same CSRF token and session context.

**Where they go next:**
- Step A → auto-redirect to Step B (same page, different `?step=`)
- Step B → redirect to `return_to` if present, otherwise `/login`

---

## The Registration Journey at a Glance

```
User opens          Auth Portal             Kratos
/register
     │
     ├────────────→ /register
     │                │
     │                ├────────────→ GET /self-service/registration/browser
     │                │
     │                ◄──────────── 303 + ?flow={id} + csrf cookie
     │◄──────────── render email form
     │
     │ enters email
     ├──────────────────────────────────────────────────────────────→ POST /self-service/registration?flow=...
     │                                                                       │
     │                                                        ◄───────────── 303 (flow updated, code sent)
     │◄──────────── render code form                          📧
     │
     │ enters code
     ├──────────────────────────────────────────────────────────────→ POST /self-service/registration?flow=...
     │                                                                       │
     │                                                        ◄───────────── 303 + ory_kratos_session
     │                                                                       │ identity created, email verified
     │
     ├────────────→ /setup?step=password
     │                │
     │                ├────────────→ GET /self-service/settings/browser
     │                │
     │                ◄──────────── 303 + ?flow={settings-id}
     │◄──────────── render password form
     │
     │ enters password
     ├──────────────────────────────────────────────────────────────→ POST /self-service/settings?flow=...
     │                                                                       │
     │                                                        ◄───────────── 303 (password saved)
     │
     ├────────────→ /setup?step=profile
     │◄──────────── render profile form
     │
     │ enters name, gender
     ├──────────────────────────────────────────────────────────────→ POST /self-service/settings?flow=...
     │                                                                       │
     │                                                        ◄───────────── 303 (traits updated)
     │
     ├────────────→ /login (default)
     │
     │   or
     │
     └────────────→ return_to (if explicitly supplied)
```

---

## What Kratos Exposes vs. What the UI Shows

When Kratos creates a registration flow, it exposes **all enabled methods** in the `ui.nodes` array. The Auth Portal then **filters** what to show.

### Raw Kratos Registration Flow (all methods)

From a live trace (flow ID: `4db47807-f3a9-4d26-8f0f-7d599370359c`):

```json
{
  "state": "choose_method",
  "ui": {
    "action": "http://localhost:4433/self-service/registration?flow=4db47807-...",
    "nodes": [
      { "group": "default", "name": "csrf_token",       "type": "hidden" },
      { "group": "default", "name": "traits.email",     "type": "email" },
      { "group": "default", "name": "traits.name.first", "type": "text" },
      { "group": "default", "name": "traits.name.last",  "type": "text" },
      { "group": "default", "name": "traits.gender",     "type": "text" },
      { "group": "code",    "name": "method",            "type": "submit", "value": "code" },
      { "group": "password","name": "password",          "type": "password" },
      { "group": "password","name": "method",            "type": "submit", "value": "password" }
    ]
  }
}
```

Kratos offers two registration paths:
1. **Code method** — Email + verification code (group: `code`)
2. **Password method** — Email + password directly (group: `password`)

> **💡 Tip: Why does Kratos show both?**
> Kratos follows a principle of "expose everything, let the UI decide." Both methods are enabled in `kratos.yml`, so both appear. The `style: unified` setting means they share the same flow (as opposed to separate flows per method).
>
> This design means the Auth Portal can change what's offered to users without reconfiguring Kratos. But it also means the password registration path is technically available via direct API calls, even though the UI doesn't show it.

### What the Auth Portal Renders

The `/register` page filters aggressively:

```tsx
<KratosFlowForm
  flow={flow}
  sectionGroups={["code"]}              // Only show the code section
  fieldAllowlist={["traits.email"]}     // Only show email (not name/gender yet)
  submitAllowlist={["method"]}          // Only show the "method" submit button
/>
```

Result: The user sees **only** an email field and a "Sign up with code" button. All password fields, name fields, and gender fields are hidden.

> **💡 Tip: Why hide name and gender at this stage?**
> The registration is split into phases: first prove you own the email (code verification), then set up your account (password + profile). Showing all fields at once would be overwhelming and would collect data before the email is verified. If the user types a wrong email, all that data entry would be wasted.

---

## Phase 1: Entering Registration

### Step 1.1: User Opens `/register`

Bookshare-Web no longer exposes account creation. Users who need registration arrive directly at:

```
http://localhost:3337/register
```

The Auth Portal asks Kratos to create a browser registration flow when `flow` is missing:

```http
GET http://localhost:4433/self-service/registration/browser
```

Kratos responds with a redirect back to `/register?flow={flow_id}` plus a CSRF cookie.

### Step 1.2: Flow ID Persistence (Middleware)

The Auth Portal middleware (`apps/auth/src/middleware.ts`) intercepts the `/register` request and stores the flow ID:

```ts
// On /register with ?flow=X
response.cookies.set("bookshare_register_flow", flow, {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  maxAge: 60 * 60,  // 1 hour (matches Kratos flow lifespan)
});
```

> **💡 Tip: Why store the flow ID in a cookie?**
> During the code verification step, Kratos may redirect the browser in a way that loses the `?flow=` parameter from the URL. Without the cookie, the Auth Portal would lose track of which flow it's working with and create a new one — losing the user's progress.
>
> The middleware also handles the reverse: if a request to `/register` has no `?flow=` parameter but the cookie exists, it redirects with the flow ID restored:
>
> ```ts
> const savedFlow = request.cookies.get("bookshare_register_flow")?.value;
> if (savedFlow) {
>   redirectUrl.searchParams.set("flow", savedFlow);
>   return NextResponse.redirect(redirectUrl);
> }
> ```

---

## Phase 2: Email Entry

### Step 2.1: Fetch Flow and Render

The Auth Portal fetches the flow from Kratos:

```
GET http://kratos:4433/self-service/registration/flows?id=4db47807-...
Cookie: csrf_token_...=6EZeayeTY80HrXK3eoNDbYJrRSYm3IYvT1JCdX+7zU4=
```

> **💡 Tip: `kratos:4433` vs `localhost:4433`**
> The Auth Portal makes server-to-server calls using the Docker internal hostname `kratos` (configured as `getKratosInternalPublicUrl()`). Browser-facing URLs use `localhost:4433` (configured as `getKratosBrowserUrl()`). This is because the Auth Portal runs inside Docker and can resolve `kratos` directly, while the browser can only access `localhost`.

Kratos returns the full flow JSON (shown in the [previous section](#raw-kratos-registration-flow-all-methods)). The page detects it's the email step (no `code` field yet):

```ts
const isCodeStep = flow.ui.nodes.some(
  (node) => node.type === "input" && node.attributes.name === "code"
);
// isCodeStep = false → show email form
```

**Rendered UI:**
- Title: "Register"
- Description: "Enter your email to start account creation."
- Fields: Email only
- Button: "Sign up with code"
- Links: "Back to sign in"

### Step 2.2: Submit Email

The form POSTs directly to Kratos (not to the Auth Portal):

```http
POST http://localhost:4433/self-service/registration?flow=4db47807-...
Content-Type: application/x-www-form-urlencoded

csrf_token=KKwFHIaTRLi7kYcmtLfh5XGHDsBkAtHsjIGA60s9BfPA6lt3oQAndbw89ZHONKKI8+xL5kLeV8PD08KeNIbIvQ==
traits.email=codex.1773385571@example.com
method=code
```

> **💡 Tip: The `method=code` field tells Kratos which method to execute**
> Since the flow supports both `code` and `password` methods, the `method` field disambiguates. If the user had submitted `method=password` with a password field, Kratos would process password registration instead.

**Kratos response:**

```http
HTTP/1.1 303 See Other
Location: http://localhost:3337/register?flow=4db47807-...
```

**What happened server-side:**
1. Kratos validated the email format (JSON Schema: `"format": "email"`)
2. Kratos checked for duplicate identities (none found)
3. Kratos generated a 6-digit code and stored it hashed in `identity_registration_codes`
4. Kratos queued an email via the courier (SMTP to Mailpit)
5. Kratos updated the flow state from `choose_method` to `sent_email`
6. Kratos redirected back to the registration UI

**Email sent (captured from Mailpit):**
```
Subject: Use code 141153 to complete your account registration
Body:    Complete your account registration with the following code: 141153
```

**Important: No identity exists yet.** The code was sent, but the identity won't be created until the code is verified. This is a key difference from password registration (where the identity is created immediately).

> **💡 Tip: What happens if the email already exists?**
> Kratos returns the same `sent_email` state regardless of whether the email exists. This prevents user enumeration — an attacker can't tell if an email is registered by watching the flow response. The error only appears if the user tries to complete registration with a duplicate email.

---

## Phase 3: Code Verification

### Step 3.1: Fetch Updated Flow

The Auth Portal re-fetches the same flow ID. Kratos returns the updated state:

```json
{
  "id": "4db47807-f3a9-4d26-8f0f-7d599370359c",
  "state": "sent_email",
  "active": "code",
  "ui": {
    "messages": [
      {
        "id": 1040005,
        "text": "A code has been sent to the address(es) you provided. If you have not received a message, check the spelling of the address and retry the registration.",
        "type": "info"
      }
    ],
    "nodes": [
      { "group": "default", "name": "csrf_token",   "type": "hidden" },
      { "group": "default", "name": "traits.email",  "type": "hidden", "value": "codex.1773385571@example.com" },
      { "group": "code",    "name": "method",         "type": "hidden", "value": "code" },
      { "group": "code",    "name": "code",           "type": "text" },
      { "group": "code",    "name": "method",         "type": "submit", "value": "code" },
      { "group": "code",    "name": "resend",         "type": "submit", "value": "code" }
    ]
  }
}
```

> **💡 Tip: Notice how the flow transformed**
> Compare with Phase 2:
> - `state` changed from `choose_method` to `sent_email`
> - `active` is now `"code"` — the code method is active
> - `traits.email` moved from a visible email input to a **hidden** input (the email is locked in)
> - A new `code` text input appeared
> - The `password` group nodes are completely gone
> - A `resend` submit button appeared (to resend the code)
>
> This is how Kratos models multi-step flows: the same flow ID, but the UI nodes change based on the current state. The flow is a state machine.

### Step 3.2: Auth Portal Renders Code Form

The page now detects the code step:

```ts
const isCodeStep = flow.ui.nodes.some(
  (node) => node.type === "input" && node.attributes.name === "code"
);
// isCodeStep = true → show code form
```

```tsx
<KratosFlowForm
  flow={flow}
  title="Verify your email"
  description={`Enter the latest 6-digit code sent to ${codeEmail}.`}
  sectionGroups={["code"]}
  fieldAllowlist={["code"]}          // Only the code input
  submitAllowlist={["method"]}       // "Submit" but NOT "Resend" or "Back"
  hideBackOnlySections
  links={[
    { href: loginHref, label: "Back to sign in" },
    { href: "/register/reset", label: "Use a different email" },
  ]}
/>
```

> **💡 Tip: "Use a different email" link**
> This link goes to `/register/reset`, which is a route handler that deletes the `bookshare_register_flow` cookie and redirects to `/register`. This forces a fresh registration flow — the user starts over with a new email.

### Step 3.3: Submit Code

```http
POST http://localhost:4433/self-service/registration?flow=4db47807-...
Content-Type: application/x-www-form-urlencoded

csrf_token=57tZxXzdbd6HJzD9Ba+T9ld43FEdek+MD+7X3mzbwaUP/QeuW04OE4CKQkp/LNCb1ROZdzumyaNAvJWrE2AM6w==
traits.email=codex.1773385571@example.com
method=code
code=141153
```

**Kratos response (success):**

```http
HTTP/1.1 303 See Other
Location: http://localhost:3337/setup
Set-Cookie: ory_kratos_session=...; HttpOnly; SameSite=Lax
```

**What happened server-side (critical moment):**
1. Kratos validated the code against the hashed value in `identity_registration_codes`
2. **Identity created** — A new row in the `identities` table
3. **Email verified** — `verifiable_addresses[].verified = true`, `status = "completed"`
4. **Both credentials created** — Password credential (empty hash) and code credential (email address)
5. **Hook: `session`** — Created a Kratos session → set `ory_kratos_session` cookie
6. **Redirect** to `registration.after.default_browser_return_url` = `http://localhost:3337/setup`

> **💡 Tip: Why is a session created right after code verification?**
> The next step is password setup, which uses the Kratos **settings** flow. Settings flows require an active session (because they modify the current user's data). Without the session created by the `hook: session`, the settings flow would return 401.
>
> This is the hook configuration in `kratos.yml`:
> ```yaml
> registration:
>   after:
>     code:
>       hooks:
>         - hook: session    # Creates session so settings flow works
> ```

### Kratos State After Code Verification

**`GET /sessions/whoami`:**

```json
{
  "active": true,
  "authentication_methods": [
    { "method": "code", "aal": "aal1", "completed_at": "2026-03-13T07:07:50Z" }
  ],
  "identity": {
    "id": "f9c95ce2-8654-4ea2-8f89-eb85f877352f",
    "traits": {
      "email": "codex.1773385571@example.com",
      "name": {}
    },
    "verifiable_addresses": [
      {
        "value": "codex.1773385571@example.com",
        "verified": true,
        "status": "completed"
      }
    ]
  }
}
```

Note:
- `authentication_methods[0].method` = `"code"` — The session was created via code verification
- `traits.name` = `{}` — No name set yet (profile incomplete)
- `verifiable_addresses[0].verified` = `true` — Email already verified
- No password hash exists yet

---

## Phase 4: Password Setup

### Step 4.1: Auth Portal Creates Settings Flow

The `/setup` page (file: `apps/auth/src/app/setup/page.tsx`) with `step=password`:

1. Auth Portal middleware deletes the `bookshare_register_flow` cookie (registration is over)
2. Page calls `initBrowserFlow("settings", returnTo)` — creates a settings flow via Kratos
3. Kratos requires an active session → checks the `ory_kratos_session` cookie → succeeds

```
GET http://kratos:4433/self-service/settings/browser?return_to=...
Cookie: ory_kratos_session=...
```

```http
HTTP/1.1 303 See Other
Location: http://localhost:3337/settings?flow=0a250174-fa05-49a4-8ae4-f58ffd357ddd
```

### Step 4.2: Fetch Settings Flow

```json
{
  "state": "show_form",
  "identity": {
    "traits": { "email": "codex.1773385571@example.com", "name": {} }
  },
  "ui": {
    "nodes": [
      { "group": "profile", "name": "traits.email",      "type": "email", "value": "codex.1773385571@example.com" },
      { "group": "profile", "name": "traits.name.first",  "type": "text" },
      { "group": "profile", "name": "traits.name.last",   "type": "text" },
      { "group": "profile", "name": "traits.gender",      "type": "text" },
      { "group": "profile", "name": "method",             "type": "submit", "value": "profile" },
      { "group": "password","name": "password",            "type": "password" },
      { "group": "password","name": "method",              "type": "submit", "value": "password" }
    ]
  }
}
```

> **💡 Tip: Settings flow has all groups at once**
> Unlike registration (which has methods), the settings flow has sections: `profile` (trait fields) and `password` (password change). Both exist in the same flow. The Auth Portal shows one section at a time using `sectionGroups`.

### Step 4.3: Render Password Form

```tsx
<KratosFlowForm
  flow={flow}
  title="Set your password"
  description={`Choose a password for ${accountEmail}.`}
  sectionGroups={["password"]}
  fieldAllowlist={["password"]}
  enablePasswordConfirmation={true}    // Adds confirm field (client-side only)
/>
```

The user sees: password field + confirm password field + "Save" button.

> **💡 Tip: Password confirmation is client-side only**
> The "Confirm password" input has no `name` attribute — it's never sent to Kratos. The `FlowSection` component validates that both fields match before allowing the form to submit. Kratos only sees one `password` field.

### Step 4.4: Submit Password

```http
POST http://localhost:4433/self-service/settings?flow=0a250174-...
csrf_token=...&password=TempPassw0rd!234&method=password
```

**Response:**
```http
HTTP/1.1 303 See Other
Location: http://localhost:3337
Set-Cookie: ory_kratos_session=...; HttpOnly; SameSite=Lax
```

**Flow state after submission:**
```json
{
  "state": "success",
  "ui": {
    "messages": [
      { "id": 1050001, "text": "Your changes have been saved!", "type": "success" }
    ]
  }
}
```

### Step 4.5: Auto-Transition to Profile

The setup page detects the success message and auto-redirects:

```ts
const hasSuccessMessage = allMessages.some((msg) => msg.type === "success");

if (setupStep === "password" && hasSuccessMessage) {
  redirect(`/setup?flow=${flow.id}&step=profile`);
}
```

---

## Phase 5: Profile Completion

### Step 5.1: Render Profile Form

Same flow ID, different section:

```tsx
<KratosFlowForm
  flow={flow}
  title="Create your profile"
  description={`Now complete your profile details for ${accountEmail}.`}
  sectionGroups={["profile"]}
  fieldAllowlist={["traits.email", "traits.name.first", "traits.name.last", "traits.gender"]}
  readonlyFieldNames={["traits.email"]}
/>
```

The user sees: email (read-only), first name, last name, gender dropdown.

> **💡 Tip: Trait value fallback**
> The settings flow includes `flow.identity.traits` with current values. The `FlowSection` component has a fallback: if a node's `attributes.value` is empty and the field name starts with `traits.`, it looks up the value from `flow.identity.traits`. This ensures the email field is pre-populated even if Kratos didn't set it on the node.

### Step 5.2: Submit Profile

```http
POST http://localhost:4433/self-service/settings?flow=0a250174-...
csrf_token=...&traits.email=codex.1773385571@example.com&traits.name.first=Jane&traits.name.last=Doe&traits.gender=female&method=profile
```

On success, the setup page detects the success message and redirects to `return_to`:

```ts
if (setupStep === "profile" && hasSuccessMessage) {
  if (returnTo) redirect(returnTo);
  redirect("/login");
}
```

If `returnTo` is absent, the setup page redirects to `http://localhost:3337/login`. If it is present, the Auth Portal resumes that explicit destination instead.

---

## Phase 6: Post-Registration Redirect

At this point, the user has:
- ✅ Verified email
- ✅ Set password
- ✅ Completed profile
- ✅ Active Kratos session (`ory_kratos_session`)

Now the Auth Portal decides where to send the user next.

### Step 6.1: Default Redirect to Sign In

If no explicit `return_to` was supplied, the setup page redirects to:

```
http://localhost:3337/login
```

By default the setup page redirects to:

```
http://localhost:3337/login
```

This keeps registration and sign-in independent.

If an external system initiated registration with a `return_to`, that value is used instead:

```ts
if (setupStep === "profile" && hasSuccessMessage) {
  if (returnTo) redirect(returnTo);
  redirect("/login");
}
```

This makes registration and Bookshare-Web sign-in independent. Registration finishes at the Auth Portal; Bookshare-Web still only exposes sign-in.

---

## Alternate Path: Password Registration (Raw Kratos)

This path is NOT used by the Auth Portal but is available via direct Kratos API calls. It's documented here because understanding it clarifies why the code path was chosen.

### How It Differs

| Aspect | Code Registration | Password Registration |
|---|---|---|
| User submits | Email → code → (then password in settings) | Email + password together |
| Identity created | After code verification | Immediately on submit |
| Email verified | Immediately (code proves ownership) | Later, in separate verification flow |
| Session auth method | `code` | `password` |
| Password hash stored | Later (settings flow) | Immediately |
| Hooks | `session` only | `session` + `show_verification_ui` |

### Password Registration Trace

```http
POST /self-service/registration?flow=61351b19-...
csrf_token=...&traits.email=user@example.com&password=MyPass&method=password
```

```http
HTTP/1.1 303 See Other
Location: http://localhost:3337/verification?flow=065f20ba-...
Set-Cookie: ory_kratos_session=...; HttpOnly; SameSite=Lax
```

The password path:
1. Creates identity immediately (with password hash)
2. Creates session immediately
3. Redirects to verification (the `show_verification_ui` hook)
4. User must verify email before the Auth Portal's OAuth handler will accept them

**Kratos session after password registration:**
```json
{
  "authentication_methods": [{ "method": "password", "aal": "aal1" }],
  "identity": {
    "verifiable_addresses": [
      { "value": "user@example.com", "verified": false, "status": "sent" }
    ]
  }
}
```

Note: `verified: false` — the email is NOT yet verified.

> **💡 Tip: This is why BookShare chose code registration**
> With password registration, there's a window where an identity exists with an unverified email. The Auth Portal's OAuth handler blocks unverified users (`isKratosEmailVerified` check), but the identity already exists in the database. With code registration, the identity doesn't exist until the email is proven — cleaner from a data integrity perspective.

---

## Configuration That Drives This Flow

### kratos.yml — Registration Section

```yaml
registration:
  lifespan: 1h                          # Flow expires after 1 hour
  style: unified                         # Both methods in one flow
  ui_url: http://localhost:3337/register  # Where to send the browser
  after:
    default_browser_return_url: http://localhost:3337/setup  # After successful registration
    code:
      hooks:
        - hook: session     # Create session after code verification
    password:
      hooks:
        - hook: session                 # Create session immediately
        - hook: show_verification_ui    # Then redirect to verification
```

> **💡 Tip: What is `style: unified`?**
> Kratos has two registration styles:
> - `unified` — All methods share one flow. The `ui.nodes` array contains nodes from all enabled methods. The UI picks which to show.
> - `multi_step` — Methods are presented in sequence (not used here).
>
> With `unified`, a single flow fetch gives you everything — the code submit button AND the password fields. The Auth Portal filters at render time.

### Methods

```yaml
methods:
  password:
    enabled: true
  code:
    enabled: true
    passwordless_enabled: true   # Allows code-only registration AND login
    config:
      lifespan: 1h               # Code valid for 1 hour
```

> **💡 Tip: `passwordless_enabled` cannot be turned off — it's load-bearing**
> Setting `passwordless_enabled: true` enables both code registration AND code login in Kratos. You might think you could disable it and rely on password-only flows, but you can't: BookShare's registration flow **depends** on the code method. During registration, the user "logs in" with email + code — Kratos calls this a login (it creates a session with `method: code`), even though BookShare doesn't present it that way. In BookShare's terms, this is a **"partial login"** — you've proven email ownership, but you're not fully logged in until you've set a password and completed your profile.
>
> Because the code method must stay enabled at the Kratos level, code login is also technically available at `POST /self-service/login`. The Auth Portal handles this by only rendering `sectionGroups={["password"]}` on the login page — hiding the code login UI entirely. But this is a UI-level restriction, not an API-level one. Raw Kratos API calls can still trigger code login.
>
> This is a deliberate design choice, not an oversight. The multi-step registration dance (code → password → profile) is fully embraced in BookShare for the registration experience it enables: email verification first, then account setup.

---

## Error Scenarios

### Wrong Verification Code

Kratos returns the flow with an error on the `code` node:

```json
{
  "state": "sent_email",
  "ui": {
    "nodes": [
      {
        "group": "code",
        "attributes": { "name": "code", "type": "text" },
        "messages": [
          {
            "id": 4000001,
            "text": "The code is not valid. Please try again.",
            "type": "error"
          }
        ]
      }
    ]
  }
}
```

The `FlowField` component renders this as red text below the code input.

### Expired Flow

If the flow's 1-hour lifespan elapses:

```json
{
  "error": {
    "id": "self_service_flow_expired",
    "code": 410,
    "reason": "The registration flow expired X minutes ago, please try again.",
    "status": "Gone"
  }
}
```

The Auth Portal's `getBrowserFlow()` returns `null` → page redirects to create a new flow.

### Duplicate Email

Kratos doesn't reveal whether an email exists (to prevent enumeration). The code is sent regardless, but if the user completes the flow, Kratos returns an error about the identifier already being taken.

---

## Database State at Each Phase

From the live SQLite trace (identity: `f9c95ce2-8654-4ea2-8f89-eb85f877352f`):

### After Phase 2 (Email Submitted, Code Sent)

```
identities:                     (no row)
identity_registration_codes:    1 row (hashed code, linked to flow)
selfservice_registration_flows: 1 row (state: sent_email, active: code)
sessions:                       (no row)
```

### After Phase 3 (Code Verified)

```
identities:                     1 row (traits: {email, name: {}}, state: active)
identity_verifiable_addresses:  1 row (verified: true, status: completed)
identity_credential_identifiers: 1 row (code credential)
identity_registration_codes:    1 row (used_at set)
selfservice_registration_flows: 1 row (state: passed_challenge)
sessions:                       1 row (method: code, aal: aal1)
```

### After Phase 4 (Password Set)

```
identity_credentials:           2 rows (code + password with bcrypt hash)
identity_credential_identifiers: 2 rows (code + password)
```

### After Phase 5 (Profile Complete)

```
identities:                     1 row (traits: {email, name: {first, last}, gender})
```

---

## File Reference

| Step | File | Purpose |
|---|---|---|
| 1 | `apps/auth/src/middleware.ts` | Flow ID cookie persistence across `/register` and `/setup` redirects |
| 2 | `apps/auth/src/app/register/page.tsx` | Email entry + code verification UI (two states, one flow) |
| 3 | `apps/auth/src/app/register/reset/route.ts` | "Use different email" — abandons flow, starts fresh |
| 4 | `apps/auth/src/app/setup/page.tsx` | Password + profile setup (two steps, one settings flow) |
| — | `apps/auth/src/lib/kratos.ts` | Kratos API client (flow fetch, session check) |
| — | `apps/auth/src/components/kratos-flow-form.tsx` | Main form renderer |
| — | `apps/auth/src/components/flow/partition.ts` | Node grouping + filtering |
| — | `apps/auth/src/components/flow/section.tsx` | Password confirmation logic |
| — | `apps/auth/src/components/flow/field.tsx` | Code input (numeric, 6-digit) |
| — | `apps/web/src/features/auth/lib/auth-portal.ts` | `buildAppLoginUrl()`, `sanitizeReturnTo()` |
| — | `infra/ory/kratos/kratos.yml` | Flow lifespans, hooks, methods |
| — | `infra/ory/kratos/identity.schema.json` | Trait definitions |
