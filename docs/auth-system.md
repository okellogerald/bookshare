# BookShare Authentication System — Technical Reference

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Services & Ports](#services--ports)
- [Identity Schema](#identity-schema)
- [Cookie Inventory](#cookie-inventory)
- [Flow 1: Registration](#flow-1-registration)
- [Flow 2: Login (Returning User)](#flow-2-login-returning-user)
- [Flow 3: Logout](#flow-3-logout)
- [Flow 4: Password Recovery](#flow-4-password-recovery)
- [Flow 5: Email Verification](#flow-5-email-verification)
- [Flow 6: Account Settings (Profile Update)](#flow-6-account-settings-profile-update)
- [Cookie Encryption (AES-256-GCM)](#cookie-encryption-aes-256-gcm)
- [DPoP Token Binding (RFC 9449)](#dpop-token-binding-rfc-9449)
- [API Authentication Guard](#api-authentication-guard)
- [Security Mechanisms Summary](#security-mechanisms-summary)
- [File Reference](#file-reference)

---

## Architecture Overview

BookShare uses a **four-tier authentication architecture**:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          USER'S BROWSER                                  │
└────────┬───────────────────┬──────────────────────┬──────────────────────┘
         │                   │                      │
         ▼                   ▼                      ▼
┌─────────────────┐  ┌───────────────┐  ┌─────────────────────────────────┐
│   Web App       │  │  Auth Portal  │  │   Ory Stack                     │
│   (Next.js)     │  │  (Next.js)    │  │                                 │
│   Port 3334     │  │  Port 3337    │  │  Kratos (Port 4433) — Identity  │
│                 │  │               │  │  Hydra  (Port 4444) — OAuth2    │
│  OAuth2 Client  │  │  Kratos UI +  │  │                                 │
│  (PKCE + DPoP)  │  │  Hydra Bridge │  │  Admin APIs: 4434 / 4445       │
└────────┬────────┘  └───────────────┘  └─────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│  NestJS API     │
│  Port 3333      │
│                 │
│  JWT + DPoP     │
│  Validation     │
└─────────────────┘
```

**Ory Kratos** — Identity management. Stores user accounts, handles self-service flows (registration, login, recovery, verification, settings). Issues Kratos browser sessions (httpOnly cookies scoped to the Kratos domain).

**Ory Hydra** — OAuth 2.0 / OpenID Connect server. Issues access tokens, ID tokens, and refresh tokens. Delegates authentication UI to the Auth Portal via login/consent/logout challenges.

**Auth Portal** (`apps/auth`) — Custom Next.js app that renders Kratos self-service flow UIs (login form, registration form, etc.) and handles Hydra's challenge endpoints (`/oauth/login`, `/oauth/consent`, `/oauth/logout`). It is the bridge between Kratos (identity) and Hydra (OAuth2).

**Web App** (`apps/web`) — The main BookShare frontend. Acts as an OAuth 2.0 public client using Authorization Code flow with PKCE and DPoP. Stores encrypted session cookies and proxies authenticated requests to the NestJS API.

**NestJS API** (`apps/api`) — The backend. Validates JWT access tokens via Hydra's JWKS endpoint and verifies DPoP proofs on every protected request.

---

## Services & Ports

| Service | Port | Role |
|---|---|---|
| PostgreSQL | 5434 | Main database |
| Kratos (public) | 4433 | Identity self-service API (browser-facing) |
| Kratos (admin) | 4434 | Identity admin API (internal) |
| Hydra (public) | 4444 | OAuth2/OIDC endpoints (authorization, token, JWKS, discovery) |
| Hydra (admin) | 4445 | OAuth2 admin API (challenge acceptance, client management) |
| Auth Portal | 3337 | Kratos UI + Hydra challenge handlers |
| Mailpit | 4436 | Dev email sink (receives verification codes) |
| NestJS API | 3333 | Protected backend API |
| Web App | 3334 | Main frontend |

---

## Identity Schema

Defined in `infra/ory/kratos/identity.schema.json`:

```
traits:
  email     — required, format: email, min 3 chars
              Used as identifier for: password login, code verification, recovery
  name:
    first   — optional string (Title: "First Name")
    last    — optional string (Title: "Last Name")
  gender    — optional enum: "female" | "male" | "prefer_not_to_say"
```

The `email` field is the sole credential identifier for both password-based login and code-based registration/verification. Kratos handles verification and recovery via email.

---

## Cookie Inventory

### Web App Cookies (domain: localhost:3334)

| Cookie | Content | httpOnly | maxAge | Purpose |
|---|---|---|---|---|
| `bookshare_session` | AES-256-GCM encrypted JSON (SessionData) | Yes | 24h | Main session: tokens + user info + DPoP key |
| `bookshare_token` | AES-256-GCM encrypted JWT | Yes | 24h | Quick access to API token (avoids parsing full session) |
| `bookshare_logged_out` | `"1"` | Yes | 30min | Marker to prevent login redirect loops after logout |
| `oidc_code_verifier` | AES-256-GCM encrypted PKCE verifier | Yes | 10min | PKCE code verifier for token exchange |
| `oidc_state` | AES-256-GCM encrypted random state | Yes | 10min | CSRF protection during OAuth flow |
| `oidc_return_to` | AES-256-GCM encrypted path | Yes | 10min | Where to redirect after login completes |

### Auth Portal Cookies (domain: localhost:3337)

| Cookie | Content | httpOnly | maxAge | Purpose |
|---|---|---|---|---|
| `bookshare_register_flow` | Kratos flow ID (plaintext) | Yes | 1h | Persists registration flow across browser redirects |

### Kratos Cookies (domain: localhost:4433)

| Cookie | Content | Purpose |
|---|---|---|
| `ory_kratos_session` | Kratos session token | Kratos browser session (set by Kratos, read by Auth Portal) |

All cookies use `sameSite: "lax"` and `secure: true` in production.

---

## Flow 1: Registration

### Overview

Registration is a multi-step process: email entry, code verification, password setup, and profile completion. It spans Kratos flows and ends with an OAuth2 login to obtain tokens.

### Detailed Steps

```
Step 1: User clicks "Create account"
──────────────────────────────────────
Web App landing page → link points to Auth Portal:
  http://localhost:3337/register?return_to=http://localhost:3334/api/auth/login

  > QN: Why should register return to http://localhost:3334/api/auth/login?

Step 2: Auth Portal /register page loads
──────────────────────────────────────
• If no `flow` query param:
  → Redirect to Kratos: GET /self-service/registration/browser?return_to=...
  → Kratos creates registration flow, redirects back with ?flow={flowId}
  → Auth Portal middleware stores flowId in `bookshare_register_flow` cookie

  > QN: Why is the flowId stored in the `bookshare_register_flow` cookie?

• If `flow` param present:
  → Fetch flow from Kratos: GET /self-service/registration/flows?id={flowId}
  → Render KratosFlowForm component

  > QN: Can you share an exampele of the result of the flow, especially in different stages in the flow

Step 3: Email entry (registration step 1)
──────────────────────────────────────
• UI shows single field: "Email"
• Allowed fields: ["traits.email"]
• Section group: "code"
• User enters email and submits
• Form POSTs to Kratos flow action URL
• Kratos sends 6-digit verification code to the email
  (delivered to Mailpit in dev: smtp://mailpit:1025)
• Kratos updates flow state — now includes a "code" input node

Step 4: Code verification (registration step 2)
──────────────────────────────────────
• Same /register page re-renders with the updated flow
• UI shows: "Enter the latest 6-digit code sent to {email}"
• Allowed fields: ["code"]
• Links offered: "Back to sign in", "Use a different email"
  ("Use a different email" → /register/reset → deletes flow cookie, starts over)
• User enters code and submits
• Kratos validates code
• Kratos executes after-registration hook: `session`
  → Creates a Kratos browser session (ory_kratos_session cookie set)
• Kratos redirects to: http://localhost:3337/setup
  (configured in kratos.yml: registration.after.default_browser_return_url)

  > QN: Why is a session needed to be generated right after the email address is validated?
  > QN: What are hooks exactly in Ory Kratos? Is "style" config enabled? It shows an error on my end

Step 5: Password setup (setup step 1)
──────────────────────────────────────
• Auth Portal /setup page loads with step=password
• Auth Portal middleware deletes `bookshare_register_flow` cookie
• If no flow param:
  → Calls initBrowserFlow("settings", returnTo) on Kratos
  → Kratos creates settings flow (requires active session — which we have from step 4)
  → Redirect back to /setup?flow={flowId}&step=password
• UI shows: "Set your password" with password + confirmation fields
• Section group: "password"
• User enters password and submits
• Kratos validates and stores password credential
• On success: flow messages contain type="success"
• Setup page detects success message → redirects to step=profile

Step 6: Profile completion (setup step 2)
──────────────────────────────────────
• Same /setup page with step=profile
• UI shows: "Create your profile" with fields:
  - Email (read-only, pre-filled from identity traits)
  - First Name
  - Last Name
  - Gender (select: female, male, prefer not to say)
• Section group: "profile"
• User fills in details and submits
• Kratos updates identity traits
• On success: redirects to return_to URL
  → Which is: http://localhost:3334/api/auth/login
  → This starts the OAuth2 login flow (Flow 2 below)

Step 7: OAuth2 token acquisition
──────────────────────────────────────
• Web App /api/auth/login fires (see Flow 2)
• Since user already has a Kratos session from step 4, the Auth Portal
  /oauth/login handler auto-accepts the Hydra login challenge
• User gets tokens without re-entering credentials
• Session cookie set, redirect to /browse
```

### Registration Flow Persistence

The Auth Portal middleware (`apps/auth/src/middleware.ts`) handles a specific problem: when Kratos redirects the browser during code verification, the `?flow=` query parameter can be lost. The middleware:

1. On `/register` with `?flow=X`: stores X in `bookshare_register_flow` cookie
2. On `/register` without `?flow=`: reads cookie and redirects with `?flow=X`
3. On `/setup`: deletes the cookie (registration phase is over)

---

## Flow 2: Login (Returning User)

### Overview

Login uses OAuth 2.0 Authorization Code flow with PKCE and DPoP. The Web App initiates the flow, Hydra delegates to the Auth Portal, which checks for a Kratos session and handles credential entry if needed.

### Detailed Steps

```
Step 1: Access protected route
──────────────────────────────────────
User visits /my-library (or any protected prefix)
→ Web App middleware (apps/web/src/middleware.ts) runs:
  • Checks for `bookshare_session` cookie
  • If missing: redirect to /api/auth/login?returnTo=/my-library
  • If present: decrypt → parse JSON → check expiresAt → check emailVerified
  • If expired: delete cookies, redirect to login
  • If email not verified: redirect to /auth/verification?returnTo=...

Step 2: PKCE + DPoP flow initiation
──────────────────────────────────────
GET /api/auth/login (apps/web/src/app/api/auth/login/route.ts)

• Generate PKCE credentials:
  - codeVerifier = randomPKCECodeVerifier()
  - codeChallenge = calculatePKCECodeChallenge(codeVerifier) [SHA-256]
  - state = randomState()

• Build authorization URL → Hydra /oauth2/auth with parameters:
  - redirect_uri: http://localhost:3334/api/auth/callback
  - scope: openid profile email offline_access
  - code_challenge: {codeChallenge}
  - code_challenge_method: S256
  - state: {state}
  - prompt: login (forces fresh authentication)
  - max_age: 0 (no cached Hydra sessions)

• Store encrypted cookies (AES-256-GCM, 10-minute TTL):
  - oidc_code_verifier → encrypt(codeVerifier)
  - oidc_state → encrypt(state)
  - oidc_return_to → encrypt(sanitizedReturnTo)

• Delete bookshare_logged_out marker if present
• Redirect browser to Hydra authorization URL

Step 3: Hydra login challenge
──────────────────────────────────────
Hydra validates the client (bookshare-web) and creates a login_challenge.
→ Redirects to: http://localhost:3337/oauth/login?login_challenge={challenge}

Step 4: Auth Portal handles login challenge
──────────────────────────────────────
GET /oauth/login (apps/auth/src/app/oauth/login/route.ts)

• Fetch challenge details from Hydra admin:
  GET /admin/oauth2/auth/requests/login?login_challenge={challenge}

• Check for existing Kratos session:
  getKratosSession(request.cookies) → GET /sessions/whoami on Kratos

• Decision tree:
  ┌─ No Kratos session?
  │  → Redirect to /login?return_to=/oauth/login?login_challenge={challenge}
  │  (User must enter email + password first)
  │
  ├─ Email not verified?
  │  → isKratosEmailVerified(session) checks verifiable_addresses array
  │  → Redirect to /verification?return_to=/oauth/login?login_challenge={challenge}
  │
  ├─ Profile incomplete?
  │  → isKratosProfileComplete(session) checks traits.name.first + last
  │  → Redirect to /setup?return_to=/oauth/login?login_challenge={challenge}
  │
  └─ All checks pass → Accept login challenge

• If loginRequest.skip && loginRequest.subject (Hydra remembers this user):
  → Accept immediately with minimal payload

• Accept login challenge via Hydra admin:
  PUT /admin/oauth2/auth/requests/login/accept
  Body: {
    subject: identityId (Kratos UUID),
    remember: true,
    remember_for: 3600 (configurable via HYDRA_REMEMBER_FOR),
    context: { traits: session.identity.traits }
  }

• Hydra returns redirect_to → browser follows

Step 5: Kratos login (if no existing session)
──────────────────────────────────────
Only reached if step 4 found no Kratos session.

Auth Portal /login page (apps/auth/src/app/login/page.tsx):
• If no ?flow param: redirect to Kratos GET /self-service/login/browser?return_to=...
  → Kratos creates login flow (10-minute lifespan)
  → Redirects back with ?flow={flowId}
• Fetch flow: GET /self-service/login/flows?id={flowId}
• Render form with:
  - Section group: "password"
  - Fields: identifier (email) + password
  - Links: "Create account" → /register, "Forgot password?" → /recovery
• User submits email + password
• Kratos validates credentials against bcrypt hash
• Kratos creates session → sets ory_kratos_session cookie
• Kratos redirects to return_to → /oauth/login?login_challenge={challenge}
• Step 4 re-executes, now finds a valid session → accepts login challenge

Step 6: Hydra consent challenge
──────────────────────────────────────
After login acceptance, Hydra creates a consent_challenge.
→ Redirects to: http://localhost:3337/oauth/consent?consent_challenge={challenge}

Step 7: Auth Portal handles consent challenge
──────────────────────────────────────
GET /oauth/consent (apps/auth/src/app/oauth/consent/route.ts)

• Fetch challenge details from Hydra admin:
  GET /admin/oauth2/auth/requests/consent?consent_challenge={challenge}

• Fetch fresh Kratos session to get current identity traits

• Build ID token claims from traits:
  {
    email_verified: boolean,
    email: "user@example.com" (lowercase, trimmed),
    preferred_username: "user" (email prefix before @),
    given_name: traits.name.first,
    family_name: traits.name.last,
    name: "First Last" (full name)
  }

• Build access token claims:
  {
    sub: identityId (Kratos UUID),
    email_verified: boolean
  }

• Accept consent via Hydra admin:
  PUT /admin/oauth2/auth/requests/consent/accept
  Body: {
    grant_scope: requested_scope (openid, profile, email, offline_access),
    grant_access_token_audience: requested_access_token_audience,
    remember: true,
    remember_for: 3600,
    session: {
      id_token: { ...idTokenClaims },
      access_token: { sub, email_verified }
    }
  }

• Consent is auto-granted (no user prompt). All requested scopes approved.
• Hydra generates authorization code → redirect to callback

Step 8: Token exchange with DPoP
──────────────────────────────────────
GET /api/auth/callback?code={authCode}&state={state}
(apps/web/src/app/api/auth/callback/route.ts)

• Decrypt cookies: oidc_code_verifier, oidc_state, oidc_return_to
• Validate state matches the decrypted oidc_state

• Generate DPoP keypair:
  generateDPoPKeyPair() → P-256 ECDSA keypair (extractable)
  getDPoPHandle(config, keyPair) → openid-client DPoP handle

• Exchange authorization code for tokens:
  authorizationCodeGrant(config, currentUrl, {
    pkceCodeVerifier: codeVerifier,
    expectedState: expectedState,
    idTokenExpected: true
  }, { DPoP: dpopHandle })

  This POSTs to Hydra token endpoint: http://hydra:4444/oauth2/token
  With DPoP proof header → Hydra binds the access token to the DPoP key
  Access token JWT now contains cnf.jkt = SHA-256 thumbprint of DPoP public key

• Receives: access_token (JWT), id_token (JWT), refresh_token

• Validate ID token claims:
  - If email_verified is false → clear cookies, redirect to /auth/verification
  - Extract: sub, email, name, preferred_username, exp

• Export DPoP private key to JWK: exportPrivateKeyJwk(keyPair)

• Store encrypted session:
  setSession({
    accessToken, refreshToken, idToken,
    expiresAt: claims.exp or now + 3600,
    dpopJwk: serialized private key JWK,
    user: { id: sub, email, name, username, emailVerified }
  })
  → Encrypts with AES-256-GCM → stored in bookshare_session cookie
  → Also encrypts API token → stored in bookshare_token cookie

Step 9: Profile sync
──────────────────────────────────────
• POST to NestJS API: /api/profiles/sync
  Headers:
    Authorization: DPoP {accessToken}
    DPoP: {dpopProofJWT}
    x-auth-access-token: {accessToken}

• Purpose: Ensures member profile exists in the database, detects deactivated accounts
• If 401 + "deactivated": clear cookies, redirect to /?error=account_deactivated
• Errors are logged but don't block login

Step 10: Redirect to destination
──────────────────────────────────────
• Delete OIDC flow cookies (code_verifier, state, return_to)
• Redirect to the decrypted returnTo value (default: /browse)
• User is now authenticated
```

---

## Flow 3: Logout

### Overview

Logout is a multi-hop process that invalidates sessions in three systems: Web App cookies, Hydra OAuth session, and Kratos browser session.

### Detailed Steps

```
Step 1: User clicks logout
──────────────────────────────────────
→ Web App navigates to /api/auth/logout

Step 2: Web App logout route
──────────────────────────────────────
GET /api/auth/logout (apps/web/src/app/api/auth/logout/route.ts)

• Read current session to get idToken (for end-session hint)

• Build Hydra end-session URL parameters:
  {
    post_logout_redirect_uri: http://localhost:3334/api/auth/post-logout,
    state: crypto.randomUUID(),
    id_token_hint: session.idToken (if available),
    client_id: "bookshare-web" (if configured)
  }

• Construct end-session URL via openid-client:
  buildEndSessionUrl(config, endSessionParams)
  → http://localhost:4444/oauth2/sessions/logout?id_token_hint=...&post_logout_redirect_uri=...

• Delete cookies:
  - bookshare_session
  - bookshare_token
  - oidc_code_verifier
  - oidc_state
  - oidc_return_to

• Set marker cookie:
  bookshare_logged_out = "1" (maxAge: 30 minutes)
  Purpose: if user visits a protected route within 30 min of logout,
  middleware redirects to landing page (not login), preventing a confusing loop.

• Redirect browser to Hydra end-session URL

Step 3: Hydra logout challenge
──────────────────────────────────────
Hydra validates the id_token_hint and creates a logout_challenge.
→ Redirects to: http://localhost:3337/oauth/logout?logout_challenge={challenge}

Step 4: Auth Portal handles logout challenge
──────────────────────────────────────
GET /oauth/logout (apps/auth/src/app/oauth/logout/route.ts)

• Accept logout challenge immediately (no user confirmation):
  PUT /admin/oauth2/auth/requests/logout/accept?logout_challenge={challenge}
  Body: {}

• Hydra invalidates OAuth session and all associated tokens
• Hydra returns redirect_to → post_logout_redirect_uri

Step 5: Post-logout redirect
──────────────────────────────────────
GET /api/auth/post-logout (apps/web/src/app/api/auth/post-logout/route.ts)

• Redirects to Auth Portal logout handler:
  buildAuthPortalLogoutUrl()
  → http://localhost:3337/logout?return_to=http://localhost:3334

Step 6: Auth Portal Kratos logout
──────────────────────────────────────
GET /logout?return_to=http://localhost:3334
(apps/auth/src/app/logout/route.ts)

• Sanitize return_to against allowed origins:
  - http://localhost:3334 (web app)
  - http://localhost:3337 (auth portal)
  Any other origin → falls back to web app URL

• Request Kratos browser logout flow:
  GET /self-service/logout/browser?return_to={returnTo}
  (with forwarded cookies for Kratos session identification)

• Kratos returns logout_url (destroys Kratos session)

• Redirect browser to Kratos logout URL
  → Kratos clears ory_kratos_session cookie

Step 7: Final redirect
──────────────────────────────────────
Kratos redirects to return_to → http://localhost:3334
User arrives at Web App home page, fully logged out.
```

### Logout Summary

```
Web App → Hydra end-session → Auth Portal /oauth/logout → Hydra accepts
→ Web App /api/auth/post-logout → Auth Portal /logout → Kratos logout
→ Web App home page
```

Three sessions invalidated:
1. Web App (bookshare_session + bookshare_token cookies deleted)
2. Hydra OAuth session (end-session + logout challenge acceptance)
3. Kratos identity session (ory_kratos_session cookie cleared)

---

## Flow 4: Password Recovery

### Overview

Password recovery uses Kratos code-based recovery. The user requests a reset, receives a code via email, and sets a new password.

### Detailed Steps

```
Step 1: User clicks "Forgot password?"
──────────────────────────────────────
From Auth Portal /login page → link to /recovery

Step 2: Auth Portal /recovery page loads
──────────────────────────────────────
(apps/auth/src/app/recovery/page.tsx)

• If no ?flow param:
  → Redirect to Kratos: GET /self-service/recovery/browser?return_to=...
  → Kratos creates recovery flow
  → Redirects back with ?flow={flowId}

• Fetch flow: GET /self-service/recovery/flows?id={flowId}
• Render KratosFlowForm:
  - Title: "Recover account"
  - Description: "Reset your password via email code."
  - Link: "Back to sign in" → /login

Step 3: User enters email
──────────────────────────────────────
• Kratos sends 6-digit recovery code to the email
  (recovery method: code, configured in kratos.yml)
• Flow updates with code input field

Step 4: User enters code
──────────────────────────────────────
• Kratos validates code
• Kratos grants a privileged session (allows password change)
• Redirects to settings flow where user can set new password

Step 5: New password set
──────────────────────────────────────
• Kratos settings flow with password method
• User enters new password
• Kratos updates password credential
• User can now log in with the new password
```

### Kratos Configuration

```yaml
recovery:
  enabled: true
  ui_url: http://localhost:3337/recovery
  use: code
```

The recovery flow uses the same email courier as registration (Mailpit in dev on port 1025).

---

## Flow 5: Email Verification

### Overview

Email verification is required before a user can access the application. It can be triggered during registration, after login with an unverified email, or manually.

### Detailed Steps

```
Step 1: Verification trigger
──────────────────────────────────────
Verification is triggered in three places:

A) During registration (step 3-4 of Flow 1):
   → Code method verifies email as part of registration

B) During OAuth login challenge (step 4 of Flow 2):
   → Auth Portal checks isKratosEmailVerified(session)
   → If not verified: redirect to /verification?return_to=/oauth/login?login_challenge=...

C) During Web App callback (step 8 of Flow 2):
   → If claims.email_verified is false
   → Clear auth cookies, redirect to /auth/verification?returnTo=...

D) During Web App middleware check:
   → If session.user.emailVerified is false
   → Redirect to /auth/verification?returnTo=...

Step 2: Auth Portal /verification page loads
──────────────────────────────────────
(apps/auth/src/app/verification/page.tsx)

• If no ?flow param:
  → Redirect to Kratos: GET /self-service/verification/browser?return_to=...
  → Kratos creates verification flow
  → Redirects back with ?flow={flowId}

• Fetch flow: GET /self-service/verification/flows?id={flowId}
• Render KratosFlowForm:
  - Title: "Verify email"
  - Description: "Enter the code sent to your email."
  - Links: "Sign in" → /login, "Create account" → /register

Step 3: User enters verification code
──────────────────────────────────────
• Kratos validates the 6-digit code
• Kratos marks the verifiable_address as verified=true
• Redirects to: return_to (or kratos.yml default: http://localhost:3337/welcome)
```

### Email Verification Check Logic

The `isKratosEmailVerified()` function in `apps/auth/src/lib/kratos.ts` performs a specific check:

1. Gets the identity's `verifiable_addresses` array
2. Gets the `traits.email` value (normalized to lowercase)
3. Checks if any verifiable address matches the trait email AND has `verified: true`
4. If no trait email: checks if any address is verified at all

This ensures the currently-configured email (not a previously changed email) is the one that's verified.

---

## Flow 6: Account Settings (Profile Update)

### Overview

Users can update their profile traits (first name, last name, gender) through the Auth Portal settings page. Email is displayed as read-only.

### Detailed Steps

```
Step 1: Navigate to settings
──────────────────────────────────────
User accesses Auth Portal /settings page

Step 2: Auth Portal /settings page loads
──────────────────────────────────────
(apps/auth/src/app/settings/page.tsx)

• If no ?flow param:
  → Redirect to Kratos: GET /self-service/settings/browser?return_to=...
  → Kratos creates settings flow (requires active session)
  → Redirects back with ?flow={flowId}

• Fetch flow: GET /self-service/settings/flows?id={flowId}
• Extract account email from identity traits or flow nodes

• Render KratosFlowForm:
  - Title: "Account settings"
  - Description: "Manage profile details for {email}."
  - Section group: "profile"
  - Allowed fields: traits.email, traits.name.first, traits.name.last, traits.gender
  - Read-only fields: traits.email (prevents email changes without verification)
  - Link: "Back to sign in" → /login

Step 3: User updates profile
──────────────────────────────────────
• User modifies first name, last name, or gender
• Form POSTs to Kratos settings flow action URL
• Kratos updates identity traits
• Flow re-renders with success message
```

### Email Update

Email is currently **read-only** in the settings UI (`readonlyFieldNames: ["traits.email"]`). To change email, a new verification flow would need to be implemented. The current system does not support email changes through the UI.

### Privileged Session Requirement

Kratos settings flows require a privileged session for sensitive changes. Configured in `kratos.yml`:

```yaml
settings:
  privileged_session_max_age: 15m
```

If the session was authenticated more than 15 minutes ago, Kratos will require re-authentication before allowing settings changes.

---

## Cookie Encryption (AES-256-GCM)

### Implementation

File: `apps/web/src/features/auth/lib/crypto.ts`

All sensitive cookies in the Web App are encrypted with AES-256-GCM (authenticated encryption — provides both confidentiality and tamper detection).

### Key Derivation

```
SESSION_SECRET (env var, arbitrary string)
    │
    ▼
HKDF-SHA256
  Salt: "bookshare-session-v1" (static, UTF-8)
  Info: "aes-256-gcm" (static, UTF-8)
    │
    ▼
256-bit AES-GCM CryptoKey (cached in module scope)
```

Uses Web Crypto API (`crypto.subtle`) for Edge Runtime compatibility (the middleware runs in Edge Runtime).

### Encryption Format

```
encrypt(plaintext) → "{base64url(12-byte IV)}.{base64url(ciphertext + GCM auth tag)}"
```

- Random 12-byte IV generated per encryption
- GCM auth tag (128-bit) is appended to ciphertext by Web Crypto
- Tampering with any bit causes decryption to fail (throws error)

### What Gets Encrypted

| Cookie | Plaintext Content |
|---|---|
| `bookshare_session` | JSON: { accessToken, refreshToken, idToken, expiresAt, dpopJwk, user } |
| `bookshare_token` | Raw JWT string |
| `oidc_code_verifier` | PKCE code verifier string |
| `oidc_state` | Random state string |
| `oidc_return_to` | Return path string |

---

## DPoP Token Binding (RFC 9449)

### What It Solves

Without DPoP, if someone steals an access token (e.g., via compromised logs, MITM), they can use it from any machine. DPoP binds each token to a cryptographic keypair — the token is useless without the corresponding private key.

### How It Works

```
Login (callback):
  1. Generate P-256 ECDSA keypair
  2. Send DPoP proof to Hydra during token exchange
  3. Hydra embeds cnf.jkt (key thumbprint) in the JWT access token
  4. Store private key JWK inside the encrypted session cookie

Every API request:
  1. Decrypt session → extract dpopJwk
  2. Create fresh DPoP proof JWT signed with the private key
  3. Send: Authorization: DPoP {access_token} + DPoP: {proof_jwt}
  4. API guard verifies proof signature, htm, htu, iat, ath, and cnf.jkt binding
```

### DPoP Proof JWT Structure

File: `apps/web/src/features/auth/lib/dpop.ts`

```
Header:
  {
    typ: "dpop+jwt",
    alg: "ES256",
    jwk: { kty: "EC", crv: "P-256", x: "...", y: "..." }  ← public key only
  }

Payload:
  {
    jti: "uuid-v4",              ← unique proof ID (prevents replay)
    htm: "POST",                 ← HTTP method being called
    htu: "http://api:3333/api/profiles/sync",  ← target URL (no query)
    iat: 1710000000,             ← issued-at timestamp
    ath: "base64url(SHA-256(access_token))"   ← token binding
  }

Signature: ECDSA P-256 SHA-256 (ES256)
```

### Key Storage

The DPoP private key is stored as a JWK inside the `SessionData.dpopJwk` field, which is part of the encrypted `bookshare_session` cookie. This means:

- The private key never exists in plaintext outside the server's memory
- It's protected by AES-256-GCM encryption at rest (in the cookie)
- An attacker who copies the raw cookie bytes cannot extract the key without `SESSION_SECRET`
- Even if the cookie is somehow decrypted, the access token has a `cnf.jkt` claim that binds it to this specific key — you need both the token AND the key to make authenticated requests

### Where DPoP Proofs Are Sent

| Request | File | Uses DPoP |
|---|---|---|
| Token exchange (callback → Hydra) | `apps/web/src/app/api/auth/callback/route.ts` | Yes (via openid-client DPoP handle) |
| Profile sync (callback → NestJS API) | `apps/web/src/app/api/auth/callback/route.ts` | Yes |
| Server Component API calls | `apps/web/src/features/auth/lib/api-client.ts` | Yes (if dpopJwk exists) |
| NestJS proxy (all methods) | `apps/web/src/app/api/nestjs/[...path]/route.ts` | Yes (if dpopJwk exists) |
| PostgREST proxy | `apps/web/src/app/api/postgrest/[...path]/route.ts` | No (PostgREST doesn't support DPoP) |

---

## API Authentication Guard

File: `apps/api/src/common/guards/auth.guard.ts`

### Token Verification (all requests)

1. Extract `Authorization` header → parse scheme (`Bearer` or `DPoP`) and token
2. Fetch JWKS from Hydra: `http://hydra:4444/.well-known/jwks.json` (cached 10 min, 5 keys max)
3. Verify JWT: RS256 signature, issuer claim = `OIDC_ISSUER`, expiration
4. If scheme is `DPoP` → run DPoP validation (below)
5. Map claims to `AuthenticatedUser` object
6. Check account deactivation: query `memberProfiles.deactivatedAt`
7. Attach user to request

### DPoP Validation Steps

When `Authorization: DPoP {token}` is used:

1. Read `DPoP` header (the proof JWT)
2. Decode proof header → extract embedded `jwk` (public key)
3. Verify proof JWT signature using the embedded public key (via `jose.jwtVerify`)
4. Validate proof claims:
   - `typ` must be `"dpop+jwt"`
   - `htm` must match the request's HTTP method (GET, POST, etc.)
   - `htu` must match the request URL (scheme + host + path, no query string)
   - `iat` must be within 60 seconds of current time
   - `jti` must be present (unique nonce)
   - `ath` must equal `base64url(SHA-256(access_token))` — binds proof to token
5. Calculate JWK thumbprint of the proof's public key (SHA-256, per RFC 7638)
6. Verify access token's `cnf.jkt` claim matches the calculated thumbprint
   — This is the core binding: Hydra stamped the token with the key's fingerprint at issuance, and the proof proves possession of that specific key

### Backward Compatibility

The guard supports both `Bearer` (no DPoP) and `DPoP` schemes. DPoP validation only runs when `Authorization: DPoP` is used. This allows:
- Gradual migration (old clients can still use Bearer)
- PostgREST proxy to continue using Bearer (PostgREST doesn't support DPoP)

---

## Security Mechanisms Summary

| Mechanism | What It Protects Against | Where |
|---|---|---|
| **PKCE (S256)** | Authorization code interception | Web App login → Hydra |
| **State parameter** | CSRF during OAuth flow | Web App login/callback |
| **DPoP (RFC 9449)** | Token theft / replay on different machine | Web App → API, Web App → Hydra |
| **AES-256-GCM cookies** | Cookie tampering, session data exposure | All Web App cookies |
| **httpOnly cookies** | XSS token theft | All cookies |
| **SameSite=Lax** | CSRF | All cookies |
| **Secure flag (prod)** | Cookie transmission over HTTP | All cookies (production) |
| **Email verification** | Account takeover via unverified email | Registration, login, middleware |
| **Account deactivation check** | Deactivated accounts accessing resources | API guard, login callback |
| **Return URL sanitization** | Open redirect attacks | Web App + Auth Portal |
| **Privileged session (15m)** | Settings changes on stale sessions | Kratos settings flow |
| **Bcrypt (cost 8)** | Password brute force | Kratos password storage |
| **XChaCha20-Poly1305** | Identity data encryption at rest | Kratos cipher |
| **JWT RS256 + JWKS** | Token forgery, key rotation | API guard |
| **cnf.jkt binding** | Token use without proof-of-possession | Hydra JWT + API DPoP validation |
| **30-min logged-out marker** | Redirect loops after logout | Web App middleware |
| **Registration flow cookie** | Flow ID loss during Kratos redirects | Auth Portal middleware |

---

## File Reference

### Web App (`apps/web/src/`)

| File | Purpose |
|---|---|
| `features/auth/lib/crypto.ts` | AES-256-GCM encrypt/decrypt (Web Crypto API) |
| `features/auth/lib/dpop.ts` | DPoP keypair generation + proof JWT creation |
| `features/auth/lib/session.ts` | Encrypted session cookie read/write, SessionData type |
| `features/auth/lib/oidc.ts` | OIDC client configuration (openid-client v6) |
| `features/auth/lib/auth-portal.ts` | Auth Portal URL builders (register, verify, logout) |
| `features/auth/lib/api-client.ts` | Server-side API fetch with DPoP auth |
| `app/api/auth/login/route.ts` | PKCE flow initiation, encrypted OIDC cookies |
| `app/api/auth/callback/route.ts` | Token exchange with DPoP, session creation |
| `app/api/auth/logout/route.ts` | Cookie cleanup, Hydra end-session redirect |
| `app/api/auth/post-logout/route.ts` | Redirects to Auth Portal logout |
| `app/api/nestjs/[...path]/route.ts` | NestJS proxy with DPoP proof forwarding |
| `app/api/postgrest/[...path]/route.ts` | PostgREST proxy (Bearer only) |
| `middleware.ts` | Protected route enforcement, session decryption |

### Auth Portal (`apps/auth/src/`)

| File | Purpose |
|---|---|
| `lib/config.ts` | URL configuration (Kratos, Hydra, app URLs) |
| `lib/kratos.ts` | Kratos API client, session checks, flow helpers |
| `lib/hydra.ts` | Hydra admin API client |
| `middleware.ts` | Registration flow cookie persistence |
| `app/login/page.tsx` | Login UI (password method) |
| `app/register/page.tsx` | Registration UI (code method: email → code) |
| `app/register/reset/route.ts` | Clears registration flow, starts over |
| `app/setup/page.tsx` | Post-registration setup (password → profile) |
| `app/verification/page.tsx` | Email verification UI (code input) |
| `app/recovery/page.tsx` | Password recovery UI (email → code → new password) |
| `app/settings/page.tsx` | Account settings (profile update, email read-only) |
| `app/logout/route.ts` | Kratos session logout handler |
| `app/oauth/login/route.ts` | Hydra login challenge handler |
| `app/oauth/consent/route.ts` | Hydra consent challenge handler (auto-grant) |
| `app/oauth/logout/route.ts` | Hydra logout challenge handler |

### NestJS API (`apps/api/src/`)

| File | Purpose |
|---|---|
| `common/guards/auth.guard.ts` | JWT verification + DPoP proof validation |
| `common/decorators/public.decorator.ts` | @Public() decorator to skip auth |
| `common/decorators/current-user.decorator.ts` | @CurrentUser() to inject AuthenticatedUser |

### Infrastructure

| File | Purpose |
|---|---|
| `infra/ory/kratos/kratos.yml` | Kratos configuration (flows, methods, URLs) |
| `infra/ory/kratos/identity.schema.json` | User traits schema |
| `infra/ory/hydra/hydra.yml` | Hydra configuration (JWT strategy, cookies, URLs) |
| `infra/ory/hydra/init-client.sh` | OAuth client bootstrap (bookshare-web) |
| `docker-compose.dev.yml` | Service orchestration + environment variables |
