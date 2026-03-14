# Login Flow — Complete Technical Reference

> This document traces the full BookShare login flow from visiting a protected route to an authenticated session. It includes real Kratos API responses, explains every redirect, and covers the full OAuth2 + PKCE + DPoP token exchange.
>
> **Prerequisites:** Read [AUTH-SYSTEM-V2.md](./AUTH-SYSTEM-V2.md) first for key concepts (flows, methods, PKCE, DPoP, etc.)
>
> **Raw traces:** [kratos-login-traces.md](./kratos-login-traces.md) — Contains both the password and code login paths with SQLite row dumps.

---

## Table of Contents

- [The Login Journey at a Glance](#the-login-journey-at-a-glance)
- [What Kratos Exposes vs. What the UI Shows](#what-kratos-exposes-vs-what-the-ui-shows)
- [Phase 1: Protected Route Detection](#phase-1-protected-route-detection)
- [Phase 2: OAuth2 Authorization Request (PKCE)](#phase-2-oauth2-authorization-request-pkce)
- [Phase 3: Hydra Login Challenge](#phase-3-hydra-login-challenge)
- [Phase 4: Kratos Password Authentication](#phase-4-kratos-password-authentication)
- [Phase 5: Hydra Login Acceptance](#phase-5-hydra-login-acceptance)
- [Phase 6: Hydra Consent (Auto-Granted)](#phase-6-hydra-consent-auto-granted)
- [Phase 7: Token Exchange (PKCE + DPoP)](#phase-7-token-exchange-pkce--dpop)
- [Phase 8: Session Storage & Redirect](#phase-8-session-storage--redirect)
- [Alternate Path: Code Login (Raw Kratos)](#alternate-path-code-login-raw-kratos)
- [Returning User (Existing Kratos Session)](#returning-user-existing-kratos-session)
- [Configuration That Drives This Flow](#configuration-that-drives-this-flow)
- [Error Scenarios](#error-scenarios)
- [Database State at Each Phase](#database-state-at-each-phase)
- [File Reference](#file-reference)

---

## The Login Journey at a Glance

```
User visits           Web App              Hydra            Auth Portal          Kratos
/my-library           middleware
     │
     ├──────────────→ no session?
     │                redirect to
     │                /api/auth/login
     │                    │
     │                    ├─── generate PKCE (verifier + challenge)
     │                    ├─── generate state
     │                    ├─── encrypt into cookies
     │                    │
     │                    ├──────────────────→ /oauth2/auth
     │                    │                        │
     │                    │                        ├─── validate client
     │                    │                        ├─── create login_challenge
     │                    │                        │
     │                    │            ◄────────── redirect to /oauth/login
     │                    │                                   │
     │                    │                                   ├───────────→ GET /sessions/whoami
     │                    │                                   │             → 401 (no session)
     │                    │                                   │
     │                    │                                   ├─── redirect to /login
     │                    │                                   │
     │◄──────────────────────────────────────────── /login form
     │
     │ enters email + password
     │
     ├──────────────────────────────────────────────────────────────────→ POST /self-service/login
     │                                                                       │
     │                                                                       ├── validate password
     │                                                                       ├── create session
     │                                                                       ├── set cookie
     │                                                                       │
     │◄────────────────────────────────────────────────── redirect to /oauth/login
     │                                                                   │
     │                                                    ├───────────→ GET /sessions/whoami ✅
     │                                                    ├─── check email verified ✅
     │                                                    ├─── check profile complete ✅
     │                                                    │
     │                                    ◄──────────── PUT /login/accept
     │                                        │
     │                                        ├─── create consent_challenge
     │                                        │
     │                                    ◄──────────── redirect to /oauth/consent
     │                                                                   │
     │                                    ◄──────────── PUT /consent/accept
     │                                        │
     │                                        ├─── generate auth code
     │                                        │
     │                    ◄──────────────── redirect to /api/auth/callback?code=...&state=...
     │                    │
     │                    ├─── decrypt cookies (verifier, state)
     │                    ├─── validate state
     │                    ├─── generate DPoP keypair
     │                    ├──────────────────→ POST /oauth2/token (code + verifier + DPoP)
     │                    │            ◄────── { access_token, id_token, refresh_token }
     │                    │
     │                    ├─── encrypt session → bookshare_session cookie
     │                    ├─── POST /api/profiles/sync (with DPoP proof)
     │                    │
     │◄───────────── redirect to /my-library
```

---

## What Kratos Exposes vs. What the UI Shows

### Raw Kratos Login Flow (all methods)

From a live trace (flow ID: `1283293f-e5d0-4519-acdf-5c21bda4ccd1`):

```json
{
  "id": "1283293f-e5d0-4519-acdf-5c21bda4ccd1",
  "state": "choose_method",
  "expires_at": "2026-03-13T07:56:55.661254503Z",
  "return_to": "http://localhost:3337",
  "ui": {
    "action": "http://localhost:4433/self-service/login?flow=1283293f-...",
    "method": "POST",
    "nodes": [
      { "group": "default",  "name": "csrf_token", "type": "hidden" },
      { "group": "default",  "name": "identifier", "type": "text",     "required": true },
      { "group": "code",     "name": "method",     "type": "submit",   "value": "code" },
      { "group": "password", "name": "password",   "type": "password", "required": true },
      { "group": "password", "name": "method",     "type": "submit",   "value": "password" }
    ]
  }
}
```

Kratos exposes two login methods:
1. **Password** — `identifier` (email) + `password` (group: `password`)
2. **Code** — `identifier` (email) + emailed code (group: `code`)

> **💡 Tip: `identifier` vs `traits.email`**
> Registration uses `traits.email` (because it's creating a new identity). Login uses `identifier` (because Kratos doesn't know which identity yet — it needs to look it up). The `identifier` field maps to the trait that has `"credentials.password.identifier": true` in the schema — which is the email.

### What the Auth Portal Renders

```tsx
<KratosFlowForm
  flow={flow}
  title="Sign in"
  description="Use your account to continue."
  sectionGroups={["password"]}     // Only show password section
  links={[
    { href: "/recovery", label: "Forgot password?" },
  ]}
/>
```

> **💡 Tip: How the `identifier` field ends up in the password section**
> The `identifier` field belongs to the `default` group. The `buildSections()` function in `partition.ts` merges default group inputs into non-default sections. So when rendering the `password` section, it includes:
> - Default hidden nodes: `csrf_token`
> - Default input nodes: `identifier` (merged into password section)
> - Password group nodes: `password` input + `method=password` submit
>
> This is why the email field appears alongside the password field even though they're in different Kratos groups.

---

## Phase 1: Protected Route Detection

### Step 1.1: Web App Middleware

File: `apps/web/src/middleware.ts`

The middleware runs on every request. Protected route prefixes:
- `/community`
- `/my-library`
- `/my-wishlist`
- `/profile`
- `/settings`

Auth routes are always accessible (no redirect loops):
- `/api/auth/login`
- `/api/auth/callback`
- `/api/auth/logout`

**Decision tree for protected routes:**

```
Has bookshare_session cookie?
├─ No
│   ├─ Has bookshare_logged_out cookie?
│   │   ├─ Yes → redirect to / with ?logged_out=1 (landing page, not login)
│   │   └─ No  → redirect to /api/auth/login?returnTo=/my-library
│   │
├─ Yes → decrypt and parse
    ├─ Decryption fails → delete cookies, redirect to login
    ├─ Session expired (Date.now() > expiresAt * 1000) → delete cookies, redirect to login
    ├─ Email not verified → redirect to /auth/verification?returnTo=/my-library
    └─ All checks pass → allow request through
```

> **💡 Tip: Why check `bookshare_logged_out` before redirecting to login?**
> After logout, all session cookies are deleted. If the user immediately visits a protected route, the middleware sees no session and would redirect to `/api/auth/login`. But Hydra might still have a remembered session and auto-log the user back in — which is confusing (you just logged out!).
>
> The `bookshare_logged_out` cookie (30-minute TTL, set during logout) tells the middleware "the user intentionally logged out — send them to the landing page, not the login flow."

---

## Phase 2: OAuth2 Authorization Request (PKCE)

### Step 2.1: Generate Security Credentials

File: `apps/web/src/app/api/auth/login/route.ts`

```ts
const codeVerifier = randomPKCECodeVerifier();        // 128 random chars
const codeChallenge = calculatePKCECodeChallenge(codeVerifier);  // SHA-256
const state = randomState();                           // Random string
```

> **💡 Tip: Why three separate random values?**
>
> | Value | Protects Against | How |
> |---|---|---|
> | `codeVerifier` + `codeChallenge` | Authorization code interception | Attacker gets the code but can't exchange it without the verifier |
> | `state` | CSRF during OAuth flow | Attacker can't forge a callback URL because they don't know the state |

### Step 2.2: Store Encrypted Cookies

```ts
// All encrypted with AES-256-GCM, 10-minute maxAge
cookies.set("oidc_code_verifier", await encrypt(codeVerifier));
cookies.set("oidc_state", await encrypt(state));
cookies.set("oidc_return_to", await encrypt(sanitizedReturnTo));
```

> **💡 Tip: Why encrypt these cookies?**
> The PKCE `codeVerifier` is the secret that protects the token exchange. If it were stored in plaintext, anyone who reads the cookie (XSS, malware, physical access) could complete the token exchange with a stolen authorization code. Encrypting it means only the Web App server can read it.

### Step 2.3: Build Authorization URL

```
http://localhost:4444/oauth2/auth
  ?response_type=code
  &client_id=bookshare-web
  &scope=openid+profile+email+offline_access
  &code_challenge={SHA256_of_verifier}
  &code_challenge_method=S256
  &state={random_state}
  &redirect_uri=http://localhost:3334/api/auth/callback
  &prompt=login
  &max_age=0
```

> **💡 Tip: `prompt=login` and `max_age=0` — why force re-authentication?**
> Without these, Hydra might skip the login challenge entirely if it remembers a recent session. `prompt=login` tells Hydra "always ask for credentials." `max_age=0` says "the user must have authenticated within the last 0 seconds" — effectively forcing a fresh login every time.
>
> This is a design choice. BookShare forces re-authentication on every OAuth flow to ensure the right person is logging in. The Kratos session might auto-accept if it's still valid, but the Hydra challenge is always created.

### Step 2.4: Delete Logout Marker

```ts
cookies.delete("bookshare_logged_out");
```

If the user is starting a login flow, they're no longer in a "just logged out" state.

### Step 2.5: Redirect to Hydra

The browser is sent to the Hydra authorization URL. Hydra takes over.

---

## Phase 3: Hydra Login Challenge

### Step 3.1: Hydra Validates the Request

Hydra checks:
1. `client_id=bookshare-web` exists and is valid
2. `redirect_uri` is in the client's allowed list
3. `scope` values are permitted for this client
4. `code_challenge_method=S256` is supported

### Step 3.2: Hydra Creates Login Challenge

Hydra creates a `login_challenge` (a UUID) and redirects:

```http
HTTP/1.1 303 See Other
Location: http://localhost:3337/oauth/login?login_challenge={challenge_uuid}
```

> **💡 Tip: What IS a login challenge?**
> It's Hydra's way of delegating authentication. Hydra says: "I need to know who this user is. Here's a challenge token. Send the user to your login UI, authenticate them however you want, then call my admin API to tell me who they are."
>
> The challenge is a one-time token. Once accepted or rejected, it can't be reused. This prevents replay attacks.

---

## Phase 4: Kratos Password Authentication

### Step 4.1: Auth Portal Checks for Existing Session

File: `apps/auth/src/app/oauth/login/route.ts`

The Auth Portal receives the login challenge and checks if the user already has a Kratos session:

```ts
const session = await getKratosSession(request.headers.get("cookie") ?? "");
const identityId = session?.identity?.id;
```

This calls `GET http://kratos:4433/sessions/whoami` with the browser's cookies forwarded. If the user doesn't have an `ory_kratos_session` cookie, Kratos returns 401.

**First-time login: no session exists.** The handler redirects to the login page:

```ts
if (!identityId) {
  const returnTo = `${authPortalUrl}/oauth/login?login_challenge=${challenge}`;
  const loginUrl = `${authPortalUrl}/login?return_to=${encodeURIComponent(returnTo)}`;
  return NextResponse.redirect(loginUrl);
}
```

> **💡 Tip: The `return_to` chain**
> The login page gets `return_to=/oauth/login?login_challenge={challenge}`. After successful Kratos login, the browser returns to `/oauth/login` with the challenge — and this time, a Kratos session exists. The OAuth handler re-executes and accepts the challenge.
>
> This is the key redirect loop: `/oauth/login` → (no session) → `/login` → (enter credentials) → (Kratos creates session) → `/oauth/login` → (session found) → accept challenge.

### Step 4.2: Kratos Login Flow Creation

Auth Portal `/login` page (file: `apps/auth/src/app/login/page.tsx`):

No `?flow=` parameter → redirect to Kratos:

```http
GET http://localhost:4433/self-service/login/browser
  ?return_to=http://localhost:3337/oauth/login?login_challenge={challenge}
```

**Kratos response:**

```http
HTTP/1.1 303 See Other
Location: http://localhost:3337/login?flow=1283293f-e5d0-4519-acdf-5c21bda4ccd1
Set-Cookie: csrf_token_...=wT+FyfFxr0+JrBlgugmfZklej8VHDQNNV/g0w+4Ici8=; HttpOnly; SameSite=Lax
```

> **💡 Tip: Login flow has a 10-minute lifespan**
> This is shorter than the 1-hour registration flow. Login is a quick action — you type your email and password and submit. If the flow expires, the user must start over. This limits the window for CSRF and flow-reuse attacks.

### Step 4.3: Fetch Login Flow

The Auth Portal fetches the flow (see [full response in the section above](#raw-kratos-login-flow-all-methods)) and renders the password form.

**Rendered fields:**
- Email input (`identifier`): `autocomplete="email"`
- Password input: `autocomplete="current-password"`
- Submit button: "Sign in"
- Links: "Forgot password?"

> **💡 Tip: `autocomplete="current-password"` vs `"new-password"`**
> The `getFieldAutoComplete()` function checks the flow action URL. If it contains `/registration` or `/settings`, it returns `"new-password"` (telling the browser's password manager this is a new password). For login, it returns `"current-password"` (telling the browser to offer saved passwords).

### Step 4.4: Submit Credentials

```http
POST http://localhost:4433/self-service/login?flow=1283293f-...
Content-Type: application/x-www-form-urlencoded

csrf_token=rGayXpCfrNnz3sAQwI8MpH8yVAuANCNYcGaCVwAsGBVtWTeXYe4Dlnpy2XB6hpPCNmzbzsc5IBUnnraU7iRqOg==
identifier=codex.1773385571@example.com
password=TempPassw0rd!234
method=password
```

**Kratos response (success):**

```http
HTTP/1.1 303 See Other
Location: http://localhost:3337/oauth/login?login_challenge={challenge}
Set-Cookie: ory_kratos_session=...; HttpOnly; SameSite=Lax
```

**What happened server-side:**
1. Kratos looked up the identity by `identifier` (email)
2. Kratos checked the password against the bcrypt hash (`cost: 8`)
3. Kratos created a session: `authentication_methods = [{ method: "password", aal: "aal1" }]`
4. Kratos set the `ory_kratos_session` cookie
5. Kratos redirected to `return_to` (the OAuth login handler)

> **💡 Tip: Login does NOT change any identity data**
> Unlike registration (which creates the identity) or settings (which modifies traits), login is purely about session creation. The identity's traits, verifiable addresses, and credentials are not modified. The database only gets a new session row.

### Kratos Session After Login

**`GET /sessions/whoami`:**

```json
{
  "id": "4300503d-6e88-4856-94d1-6879daef244d",
  "active": true,
  "authentication_methods": [
    { "method": "password", "aal": "aal1", "completed_at": "2026-03-13T07:47:13Z" }
  ],
  "identity": {
    "id": "f9c95ce2-8654-4ea2-8f89-eb85f877352f",
    "traits": {
      "email": "codex.1773385571@example.com",
      "name": {}
    },
    "verifiable_addresses": [
      { "value": "codex.1773385571@example.com", "verified": true, "status": "completed" }
    ]
  }
}
```

---

## Phase 5: Hydra Login Acceptance

### Step 5.1: Auth Portal Re-Checks Session

The browser is redirected back to:
```
http://localhost:3337/oauth/login?login_challenge={challenge}
```

The Auth Portal's OAuth login handler runs again. This time:

1. `getKratosSession()` → **Session found** ✅
2. `isKratosEmailVerified(session)` → **true** ✅ (email verified during registration)
3. `isKratosProfileComplete(session)` → **true** ✅ (name set during registration setup)

> **💡 Tip: These three checks are the Auth Portal's gatekeeping**
> Even if Kratos says the user is authenticated, the Auth Portal enforces additional requirements before granting OAuth tokens:
> 1. Session must exist (user is logged in)
> 2. Email must be verified (prevents unverified accounts from accessing the app)
> 3. Profile must be complete (first + last name required)
>
> If any check fails, the user is redirected to the appropriate flow (login, verification, or setup) with `return_to` pointing back to this handler. After completing the required step, they return here and the checks pass.

### Step 5.2: Accept Login Challenge

```http
PUT http://hydra:4445/admin/oauth2/auth/requests/login/accept
  ?login_challenge={challenge}

Body: {
  "subject": "f9c95ce2-8654-4ea2-8f89-eb85f877352f",
  "remember": true,
  "remember_for": 3600,
  "context": {
    "traits": {
      "email": "codex.1773385571@example.com",
      "name": { "first": "Jane", "last": "Doe" },
      "gender": "female"
    }
  }
}
```

| Field | Purpose |
|---|---|
| `subject` | The Kratos identity UUID — tells Hydra who this user is |
| `remember: true` | Hydra remembers this login (skips challenge next time within `remember_for`) |
| `remember_for: 3600` | Remember for 1 hour (configurable via `HYDRA_REMEMBER_FOR` env var) |
| `context.traits` | Passed to the consent handler (so it can build ID token claims without re-fetching) |

> **💡 Tip: `loginRequest.skip`**
> If Hydra already remembers this user (within the `remember_for` window), the login challenge has `skip: true` and `subject: "identity-uuid"`. In this case, the Auth Portal accepts immediately with minimal payload (no context). This is the "returning user with remembered session" fast path.
>
> However, BookShare sets `prompt=login` and `max_age=0` during the OAuth request (Phase 2), which forces a fresh challenge every time. So `skip` is rarely true in practice.

**Hydra response:**
```json
{ "redirect_to": "http://localhost:4444/oauth2/auth?...&consent_challenge={consent_challenge}" }
```

---

## Phase 6: Hydra Consent (Auto-Granted)

### Step 6.1: Hydra Creates Consent Challenge

After login acceptance, Hydra redirects to:
```
http://localhost:3337/oauth/consent?consent_challenge={challenge}
```

### Step 6.2: Auth Portal Fetches Consent Request

```http
GET http://hydra:4445/admin/oauth2/auth/requests/consent
  ?consent_challenge={challenge}
```

Returns:
```json
{
  "subject": "f9c95ce2-...",
  "requested_scope": ["openid", "profile", "email", "offline_access"],
  "requested_access_token_audience": [],
  "context": {
    "traits": { "email": "...", "name": { "first": "Jane", "last": "Doe" } }
  }
}
```

### Step 6.3: Build Token Claims

The consent handler builds claims from traits:

```ts
function buildIdTokenClaims(traits, emailVerified) {
  return {
    email_verified: true,
    email: "codex.1773385571@example.com",
    preferred_username: "codex.1773385571",  // email prefix before @
    given_name: "Jane",
    family_name: "Doe",
    name: "Jane Doe",
  };
}
```

> **💡 Tip: Why are claims built in the consent handler, not by Hydra?**
> Hydra doesn't have a user database. It doesn't know what the user's email or name is. The consent handler is where you tell Hydra "here's what to put in the tokens." This data comes from Kratos traits (either from the fresh `whoami` session or from the `context` passed during login acceptance).

### Step 6.4: Accept Consent

```http
PUT http://hydra:4445/admin/oauth2/auth/requests/consent/accept
  ?consent_challenge={challenge}

Body: {
  "grant_scope": ["openid", "profile", "email", "offline_access"],
  "grant_access_token_audience": [],
  "remember": true,
  "remember_for": 3600,
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

> **💡 Tip: `session.id_token` vs `session.access_token`**
> These are separate claim sets that go into different tokens:
> - `session.id_token` → Claims embedded in the ID token (consumed by the Web App to populate SessionData.user)
> - `session.access_token` → Extra claims embedded in the access token (consumed by the NestJS API guard)
>
> The ID token gets rich user info (name, email). The access token gets minimal info (just sub and email_verified) — the API mostly cares about identity, not profile data.

**Hydra response:**
```json
{ "redirect_to": "http://localhost:3334/api/auth/callback?code={auth_code}&scope=...&state={state}" }
```

Hydra has generated an authorization code and is sending the browser back to the Web App callback.

---

## Phase 7: Token Exchange (PKCE + DPoP)

### Step 7.1: Validate State

File: `apps/web/src/app/api/auth/callback/route.ts`

```ts
const storedState = await decrypt(cookies.get("oidc_state").value);
const receivedState = url.searchParams.get("state");
// openid-client validates these match
```

> **💡 Tip: Why validate state?**
> Without state validation, an attacker could craft a URL like `/api/auth/callback?code=stolen_code` and trick the user's browser into completing the OAuth flow with the attacker's authorization code. The state parameter ensures the callback was initiated by the same browser session that started the login.

### Step 7.2: Generate DPoP Keypair

```ts
const dpopKeyPair = await generateDPoPKeyPair();
// P-256 ECDSA keypair, extractable (so we can serialize the private key)
```

> **💡 Tip: Why generate the keypair HERE and not at login initiation?**
> The keypair is generated at the callback step, not at the `/api/auth/login` step. This is because:
> 1. The keypair needs to be sent during the token exchange (this step)
> 2. Storing a keypair in a cookie for the duration of the OAuth redirect flow would increase cookie size
> 3. The keypair only needs to exist from token exchange onward
>
> The private key is immediately serialized to JWK and stored in the encrypted session cookie.

### Step 7.3: Exchange Code for Tokens

```ts
const tokenResponse = await authorizationCodeGrant(
  config,
  currentUrl,
  {
    pkceCodeVerifier: decryptedCodeVerifier,
    expectedState: decryptedState,
    idTokenExpected: true,
  },
  { DPoP: dpopHandle }
);
```

Under the hood, openid-client sends:

```http
POST http://hydra:4444/oauth2/token
Content-Type: application/x-www-form-urlencoded
DPoP: eyJhbGciOiJFUzI1NiIsInR5cCI6ImRwb3Arand0IiwiandrIjp7Imt0eSI6IkVDIi...

grant_type=authorization_code
&code={authorization_code}
&redirect_uri=http://localhost:3334/api/auth/callback
&client_id=bookshare-web
&code_verifier={pkce_code_verifier}
```

**Hydra validates:**
1. Authorization code is valid and unused
2. `redirect_uri` matches the one from the authorization request
3. `SHA-256(code_verifier)` matches the stored `code_challenge` (PKCE)
4. DPoP proof is valid → extracts public key → computes thumbprint
5. Stamps the access token with `cnf.jkt = SHA-256(DPoP_public_key)`

**Hydra response:**
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "token_type": "DPoP",
  "expires_in": 3600,
  "id_token": "eyJhbGciOiJSUzI1NiIs...",
  "refresh_token": "ory_rt_...",
  "scope": "openid profile email offline_access"
}
```

> **💡 Tip: `token_type: "DPoP"` not `"Bearer"`**
> Because we sent a DPoP proof, Hydra issues a DPoP-bound token. The `token_type` field tells the client to use `Authorization: DPoP {token}` (not `Authorization: Bearer {token}`). The token itself contains a `cnf.jkt` claim binding it to the DPoP key.

### Step 7.4: Validate ID Token

```ts
const claims = tokenResponse.claims();
// { sub, email, email_verified, name, preferred_username, exp, ... }

if (!claims.email_verified) {
  // Clear cookies, redirect to verification
  return redirect("/auth/verification");
}
```

---

## Phase 8: Session Storage & Redirect

### Step 8.1: Export DPoP Private Key

```ts
const dpopJwk = await exportPrivateKeyJwk(dpopKeyPair);
// { kty: "EC", crv: "P-256", x: "...", y: "...", d: "..." }
```

The `d` field is the private key component. This JWK is stored in the session for later DPoP proof generation.

### Step 8.2: Store Encrypted Session

```ts
await setSession({
  accessToken: tokenResponse.access_token,
  refreshToken: tokenResponse.refresh_token,
  idToken: tokenResponse.id_token,
  expiresAt: claims.exp || Math.floor(Date.now() / 1000) + 3600,
  dpopJwk: dpopJwk,
  user: {
    id: claims.sub,
    email: claims.email,
    name: claims.name,
    username: claims.preferred_username,
    emailVerified: claims.email_verified,
  },
});
```

This encrypts the entire `SessionData` object with AES-256-GCM and stores it in the `bookshare_session` cookie (24-hour maxAge). A separate `bookshare_token` cookie stores just the access token for quick API access.

### Step 8.3: Profile Sync

```ts
const apiUrl = `${API_BASE}/api/profiles/sync`;
const proof = await createDPoPProof(dpopJwk, "POST", apiUrl, accessToken);

await fetch(apiUrl, {
  method: "POST",
  headers: {
    "Authorization": `DPoP ${accessToken}`,
    "DPoP": proof,
    "x-auth-access-token": accessToken,
  },
});
```

> **💡 Tip: What does profile sync do?**
> It ensures the user has a `memberProfile` row in the application database. On first login after registration, this creates the profile. On subsequent logins, it's a no-op (or updates if needed). If the API returns 401 with "deactivated", the callback clears cookies and redirects to the landing page with an error.

### Step 8.4: Clean Up and Redirect

```ts
cookies.delete("oidc_code_verifier");
cookies.delete("oidc_state");
cookies.delete("oidc_return_to");

const returnTo = await decrypt(cookies.get("oidc_return_to").value);
redirect(sanitizeReturnTo(returnTo));  // default: /browse
```

**User is now fully authenticated** with encrypted session cookie containing tokens + DPoP key.

---

## Alternate Path: Code Login (Raw Kratos)

This path is NOT used by the Auth Portal but is available via direct Kratos API. Understanding it helps clarify the architecture.

### How It Differs

| Aspect | Password Login | Code Login |
|---|---|---|
| User provides | Email + password | Email only (then code from email) |
| Steps | 1 (submit credentials) | 2 (submit email → submit code) |
| Requires | Password set on identity | Email deliverability |
| Session auth method | `password` | `code` |
| Flow state transitions | `choose_method` → (direct session) | `choose_method` → `sent_email` → (session) |
| DB artifacts | Session row only | Session row + `identity_login_codes` row |

### Code Login Trace

**Step 1: Submit email with `method=code`**

```http
POST /self-service/login?flow=12cfb84f-...
identifier=codex.1773385571@example.com&method=code
```

Flow transitions to `sent_email`, Kratos sends login code via email.

**Step 2: Flow after email submission**

```json
{
  "state": "sent_email",
  "active": "code",
  "ui": {
    "messages": [
      { "text": "A code was sent to the address you provided...", "type": "info" }
    ],
    "nodes": [
      { "group": "default", "name": "identifier", "type": "hidden", "value": "codex.1773385571@example.com" },
      { "group": "code",    "name": "method",     "type": "hidden", "value": "code" },
      { "group": "code",    "name": "code",        "type": "text", "required": true },
      { "group": "code",    "name": "method",      "type": "submit", "value": "code" },
      { "group": "code",    "name": "resend",      "type": "submit", "value": "code" }
    ]
  }
}
```

**Step 3: Submit code**

```http
POST /self-service/login?flow=12cfb84f-...
identifier=codex.1773385571@example.com&method=code&code=359606
```

Session created with `authentication_methods = [{ method: "code" }]`.

> **💡 Tip: Code login is enabled because of `passwordless_enabled: true`**
> If you want to truly disable code login, set `passwordless_enabled: false` in `kratos.yml`. The Auth Portal hides the code login button, but the raw API still accepts it. This is a security consideration — a determined attacker could bypass the UI and call the API directly.

---

## Returning User (Existing Kratos Session)

If the user recently logged in and their Kratos session is still active, Phase 4 is skipped entirely.

### The Fast Path

```
Phase 1 (middleware) → Phase 2 (PKCE) → Phase 3 (Hydra challenge)
→ Phase 5 (Auth Portal finds existing session → accepts immediately)
→ Phase 6 (consent auto-granted) → Phase 7 (token exchange) → Phase 8 (done)
```

The user never sees a login form. The entire flow happens as a series of fast redirects. From the user's perspective, they click a protected link and land on the page after a brief loading state.

> **💡 Tip: This only happens if the `ory_kratos_session` cookie is still valid**
> The Kratos session has its own lifetime (configured in Kratos). If it's expired, Phase 4 runs and the user must enter credentials. The `remember_for: 3600` in Hydra's login acceptance is separate — that's how long Hydra remembers the user. But since BookShare uses `prompt=login`, Hydra always creates a challenge regardless.

---

## Configuration That Drives This Flow

### kratos.yml — Login Section

```yaml
login:
  ui_url: http://localhost:3337/login
  lifespan: 10m
```

### Methods

```yaml
methods:
  password:
    enabled: true
  code:
    enabled: true
    passwordless_enabled: true   # Also enables code LOGIN (not just registration)
```

### Hydra Client Configuration

From `infra/ory/hydra/init-client.sh`:

```json
{
  "client_id": "bookshare-web",
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code", "id_token"],
  "scope": "openid profile email offline_access",
  "token_endpoint_auth_method": "none",
  "redirect_uris": ["http://localhost:3334/api/auth/callback"],
  "post_logout_redirect_uris": ["http://localhost:3334", "http://localhost:3334/api/auth/post-logout"]
}
```

---

## Error Scenarios

### Wrong Password

Kratos returns the flow with a top-level error message:

```json
{
  "ui": {
    "messages": [
      {
        "id": 4000006,
        "text": "The provided credentials are invalid, check for spelling mistakes in your password or username, email address, or phone number.",
        "type": "error"
      }
    ]
  }
}
```

> **💡 Tip: Kratos uses the same error message for wrong email AND wrong password**
> This is intentional — it prevents user enumeration. An attacker can't distinguish "this email doesn't exist" from "the password is wrong." Both return the same generic message.

The `FlowMessages` component renders this as a red alert above the form.

### Expired Login Flow

If the 10-minute lifespan elapses:

```json
{
  "error": {
    "id": "self_service_flow_expired",
    "code": 410,
    "reason": "The login flow expired 5 minutes ago, please try again."
  }
}
```

The `getBrowserFlow()` call returns `null`. The page redirects to create a new flow.

### OAuth State Mismatch

If the `state` in the callback URL doesn't match the encrypted `oidc_state` cookie, the token exchange throws an error. The callback handler redirects to the login page.

### Email Not Verified (Caught at Multiple Points)

1. **Auth Portal /oauth/login:** Redirects to `/verification?return_to=/oauth/login?login_challenge=...`
2. **Web App callback:** If ID token has `email_verified: false`, clears cookies and redirects to verification
3. **Web App middleware:** If session has `emailVerified: false`, redirects to verification

### Account Deactivated

During profile sync (Phase 8), the NestJS API returns 401 with "deactivated". The callback handler clears all cookies and redirects to `/?error=account_deactivated`.

---

## Database State at Each Phase

From the live SQLite trace (identity: `f9c95ce2-8654-4ea2-8f89-eb85f877352f`):

### Before Login (Pre-existing Identity)

```
identities:                     1 row (traits: {email, name}, state: active)
identity_verifiable_addresses:  1 row (verified: true)
identity_credentials:           2 rows (code + password)
sessions:                       0 active sessions (previous ones expired)
```

### After Phase 4 (Kratos Login Succeeded)

```
selfservice_login_flows:  1 row (active: password, state: choose_method)
sessions:                 1 new row (method: password, aal: aal1, active: true)
identity_login_codes:     0 rows (password login doesn't create code rows)
```

### After Phase 7 (Tokens Issued)

No new database rows in Kratos — token issuance is Hydra's domain. Hydra stores:
- OAuth session
- Consent grant
- Authorization code (now consumed)
- Access token metadata
- Refresh token

---

## File Reference

| File | Phase | Purpose |
|---|---|---|
| `apps/web/src/middleware.ts` | 1 | Protected route detection |
| `apps/web/src/app/api/auth/login/route.ts` | 2 | PKCE generation + Hydra redirect |
| `apps/auth/src/app/oauth/login/route.ts` | 3, 5 | Hydra login challenge handler |
| `apps/auth/src/app/login/page.tsx` | 4 | Login form rendering |
| `apps/auth/src/lib/kratos.ts` | 4, 5 | Session check, flow fetch |
| `apps/auth/src/app/oauth/consent/route.ts` | 6 | Hydra consent handler |
| `apps/web/src/app/api/auth/callback/route.ts` | 7-8 | Token exchange + session storage |
| `apps/web/src/features/auth/lib/crypto.ts` | 2, 7, 8 | AES-256-GCM encrypt/decrypt |
| `apps/web/src/features/auth/lib/dpop.ts` | 7 | DPoP keypair + proof generation |
| `apps/web/src/features/auth/lib/session.ts` | 8 | Session cookie write |
| `apps/web/src/features/auth/lib/oidc.ts` | 2, 7 | OIDC client configuration |
| `apps/web/src/features/auth/lib/auth-portal.ts` | 1 | URL builders |
| `infra/ory/kratos/kratos.yml` | Config | Login lifespan, methods |
| `infra/ory/hydra/init-client.sh` | Config | OAuth client setup |
