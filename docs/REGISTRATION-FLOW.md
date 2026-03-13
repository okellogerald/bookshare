# Registration Flow — Complete Technical Reference

> This document traces the full BookShare registration flow from first click to authenticated session. It includes real Kratos API responses captured from a live local environment, explains every decision and redirect, and calls out exactly what happens at the database level.
>
> **Prerequisites:** Read [AUTH-SYSTEM-V2.md](./AUTH-SYSTEM-V2.md) first for key concepts (flows, methods, hooks, CSRF, etc.)
>
> **Raw traces:** [kratos-registration-traces.md](./kratos-registration-traces.md) — Contains both the code and password registration paths with SQLite row dumps.

---

## Table of Contents

- [The Registration Journey at a Glance](#the-registration-journey-at-a-glance)
- [What Kratos Exposes vs. What the UI Shows](#what-kratos-exposes-vs-what-the-ui-shows)
- [Phase 1: Entering the Auth Portal](#phase-1-entering-the-auth-portal)
- [Phase 2: Email Entry](#phase-2-email-entry)
- [Phase 3: Code Verification](#phase-3-code-verification)
- [Phase 4: Password Setup](#phase-4-password-setup)
- [Phase 5: Profile Completion](#phase-5-profile-completion)
- [Phase 6: OAuth2 Token Acquisition](#phase-6-oauth2-token-acquisition)
- [Alternate Path: Password Registration (Raw Kratos)](#alternate-path-password-registration-raw-kratos)
- [Configuration That Drives This Flow](#configuration-that-drives-this-flow)
- [Error Scenarios](#error-scenarios)
- [Database State at Each Phase](#database-state-at-each-phase)
- [File Reference](#file-reference)

---

## The Registration Journey at a Glance

```
User clicks          Auth Portal          Kratos               Hydra            Web App
"Create account"
     │
     ├──────────────→ /register
     │                    │
     │                    ├──────────────→ GET /self-service/registration/browser
     │                    │                    │
     │                    │◄───────────── 303 + ?flow={id} + csrf cookie
     │                    │
     │                    ├──────────────→ GET /self-service/registration/flows?id=...
     │                    │◄───────────── 200 { ui: { nodes: [email, code submit] } }
     │                    │
     │◄───────────── render email form
     │
     │ enters email
     ├──────────────→ POST /self-service/registration?flow=...
     │                                   │
     │                    │◄───────────── 303 (flow updated, code sent)
     │                    │
     │◄───────────── render code form
     │                                   📧 code sent to email
     │ enters code
     ├──────────────→ POST /self-service/registration?flow=...
     │                                   │
     │                    │◄───────────── 303 + ory_kratos_session cookie
     │                                   │ identity created, email verified
     │                    │
     ├──────────────→ /setup?step=password
     │                    │
     │                    ├──────────────→ GET /self-service/settings/browser
     │                    │◄───────────── 303 + ?flow={settings-id}
     │                    │
     │◄───────────── render password form
     │
     │ enters password
     ├──────────────→ POST /self-service/settings?flow=...
     │                                   │
     │                    │◄───────────── 303 (password saved)
     │                    │
     ├──────────────→ /setup?step=profile
     │                    │
     │◄───────────── render profile form
     │
     │ enters name, gender
     ├──────────────→ POST /self-service/settings?flow=...
     │                                   │
     │                    │◄───────────── 303 (traits updated)
     │                    │
     ├──────────────→ return_to → Web App /api/auth/login
     │                                                        │
     │                                              ◄──────── /oauth2/auth (PKCE)
     │                                                        │
     │                    ◄─────────────────────────────────── login_challenge
     │                    │
     │                    ├──────────────→ GET /sessions/whoami ✅
     │                    │
     │                    ├──────────────────────────────────→ PUT /login/accept
     │                    │                                    │
     │                    ◄─────────────────────────────────── consent_challenge
     │                    │
     │                    ├──────────────────────────────────→ PUT /consent/accept
     │                                                        │
     │                                              ◄──────── auth code → /callback
     │                                                        │
     │                                              ────────→ token exchange (PKCE+DPoP)
     │                                                        │
     │◄────────────────────────────────────────────────────── redirect /browse (session set)
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

## Phase 1: Entering the Auth Portal

### Step 1.1: User Clicks "Create Account"

The Web App landing page has a link to:

```
http://localhost:3337/register?return_to=http://localhost:3334/api/auth/login
```

> **💡 Tip: Why does `return_to` point to `/api/auth/login`?**
> After registration is fully complete (email verified, password set, profile filled), the user needs OAuth tokens to use the Web App. The `return_to` URL tells Kratos "when everything is done, send the user here." `/api/auth/login` is the Web App's OAuth flow entry point — it generates PKCE credentials and redirects to Hydra.
>
> So the chain is: registration complete → return to Web App login route → OAuth flow → tokens acquired → user lands on /browse.

### Step 1.2: Auth Portal Creates Kratos Flow

The `/register` page (file: `apps/auth/src/app/register/page.tsx`) checks for a `flow` query parameter. If missing, it redirects to Kratos to create one:

```
Browser → GET http://localhost:4433/self-service/registration/browser
            ?return_to=http://localhost:3334/api/auth/login
```

**Kratos response:**

```http
HTTP/1.1 303 See Other
Location: http://localhost:3337/register?flow=4db47807-f3a9-4d26-8f0f-7d599370359c
Set-Cookie: csrf_token_...=6EZeayeTY80HrXK3eoNDbYJrRSYm3IYvT1JCdX+7zU4=; HttpOnly; SameSite=Lax
```

**What happened:**
1. Kratos created a registration flow object in the database with a 1-hour lifespan
2. Kratos set a CSRF cookie on the Kratos domain
3. Kratos redirected to the configured `registration.ui_url` with the flow ID

> **💡 Tip: The CSRF cookie is on the Kratos domain, not the Auth Portal domain**
> The cookie is set on `localhost:4433` (Kratos). When the Auth Portal later POSTs the form to `localhost:4433/self-service/registration?flow=...`, the browser automatically sends this cookie. Kratos compares it to the `csrf_token` hidden field in the form. This is the double-submit cookie pattern.

### Step 1.3: Flow ID Persistence (Middleware)

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
- Title: "Create account"
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

The `returnTo` is `http://localhost:3334/api/auth/login` — which starts the OAuth2 flow.

---

## Phase 6: OAuth2 Token Acquisition

At this point, the user has:
- ✅ Verified email
- ✅ Set password
- ✅ Completed profile
- ✅ Active Kratos session (`ory_kratos_session`)

Now they need OAuth tokens.

### Step 6.1: Web App Initiates PKCE Flow

`GET /api/auth/login` (file: `apps/web/src/app/api/auth/login/route.ts`):

1. Generate PKCE: `codeVerifier`, `codeChallenge` (SHA-256), `state`
2. Store encrypted cookies: `oidc_code_verifier`, `oidc_state`, `oidc_return_to`
3. Redirect to Hydra: `http://localhost:4444/oauth2/auth?response_type=code&client_id=bookshare-web&scope=openid+profile+email+offline_access&code_challenge={challenge}&code_challenge_method=S256&state={state}&redirect_uri=http://localhost:3334/api/auth/callback&prompt=login&max_age=0`

### Step 6.2: Hydra Login Challenge

Hydra creates a `login_challenge` and redirects to:
```
http://localhost:3337/oauth/login?login_challenge={challenge}
```

### Step 6.3: Auth Portal Accepts Login

`GET /oauth/login` (file: `apps/auth/src/app/oauth/login/route.ts`):

1. Fetch challenge from Hydra admin: `GET /admin/oauth2/auth/requests/login?login_challenge={challenge}`
2. Check Kratos session: `GET /sessions/whoami` → **Session exists** (from Phase 3)
3. Check email verified: `isKratosEmailVerified(session)` → **true** (verified in Phase 3)
4. Check profile complete: `isKratosProfileComplete(session)` → **true** (completed in Phase 5)
5. Accept login challenge:

```http
PUT /admin/oauth2/auth/requests/login/accept?login_challenge={challenge}
Body: {
  "subject": "f9c95ce2-8654-4ea2-8f89-eb85f877352f",
  "remember": true,
  "remember_for": 3600,
  "context": { "traits": { "email": "...", "name": { "first": "Jane", "last": "Doe" } } }
}
```

### Step 6.4: Hydra Consent Challenge (Auto-Granted)

Hydra creates a `consent_challenge`. Auth Portal auto-grants with ID token claims:

```json
{
  "grant_scope": ["openid", "profile", "email", "offline_access"],
  "session": {
    "id_token": {
      "email_verified": true,
      "email": "codex.1773385571@example.com",
      "preferred_username": "codex.1773385571",
      "given_name": "Jane",
      "family_name": "Doe",
      "name": "Jane Doe"
    },
    "access_token": {
      "sub": "f9c95ce2-8654-4ea2-8f89-eb85f877352f",
      "email_verified": true
    }
  }
}
```

### Step 6.5: Token Exchange with DPoP

`GET /api/auth/callback?code={authCode}&state={state}`:

1. Decrypt cookies: `oidc_code_verifier`, `oidc_state`
2. Validate state matches
3. Generate DPoP keypair (P-256 ECDSA)
4. Exchange code for tokens at `http://hydra:4444/oauth2/token` with PKCE verifier + DPoP proof
5. Receive: access_token, id_token, refresh_token
6. Store encrypted session in `bookshare_session` cookie
7. POST to `/api/profiles/sync` to ensure member profile exists
8. Redirect to `/browse`

**User is now fully authenticated** with:
- Encrypted Web App session cookie containing all tokens + DPoP private key
- Kratos identity with verified email, password, and complete profile

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

> **💡 Tip: `passwordless_enabled` has broader effects than you might expect**
> Setting `passwordless_enabled: true` doesn't just enable code registration — it also enables code LOGIN. A user can log in by entering their email and receiving a login code, bypassing their password entirely. The Auth Portal hides this by only rendering `sectionGroups={["password"]}` on the login page, but raw Kratos still accepts it.

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

| File | Phase | Purpose |
|---|---|---|
| `apps/auth/src/app/register/page.tsx` | 2-3 | Email entry + code verification UI |
| `apps/auth/src/app/register/reset/route.ts` | 3 | "Use different email" handler |
| `apps/auth/src/app/setup/page.tsx` | 4-5 | Password + profile setup UI |
| `apps/auth/src/middleware.ts` | 1-3 | Flow ID cookie persistence |
| `apps/auth/src/lib/kratos.ts` | All | Kratos API client (flow fetch, session check) |
| `apps/auth/src/components/kratos-flow-form.tsx` | 2-5 | Main form renderer |
| `apps/auth/src/components/flow/partition.ts` | 2-5 | Node grouping + filtering |
| `apps/auth/src/components/flow/section.tsx` | 4 | Password confirmation logic |
| `apps/auth/src/components/flow/field.tsx` | 3 | Code input (numeric, 6-digit) |
| `apps/auth/src/app/oauth/login/route.ts` | 6 | Hydra login challenge handler |
| `apps/auth/src/app/oauth/consent/route.ts` | 6 | Hydra consent challenge handler |
| `apps/web/src/app/api/auth/login/route.ts` | 6 | PKCE flow initiation |
| `apps/web/src/app/api/auth/callback/route.ts` | 6 | Token exchange with DPoP |
| `apps/web/src/features/auth/lib/auth-portal.ts` | 1 | `buildAuthPortalRegisterUrl()` |
| `infra/ory/kratos/kratos.yml` | Config | Flow lifespans, hooks, methods |
| `infra/ory/kratos/identity.schema.json` | Config | Trait definitions |
