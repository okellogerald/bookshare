# Authorization Code Flow

## What Is the Authorization Code Flow?

The Authorization Code Flow is an OAuth 2.0 grant type designed for server-side applications. Instead of giving the client application direct access to user credentials, the user authenticates with a trusted authorization server, which then issues a short-lived authorization code. The client exchanges this code for tokens via a secure back-channel (server-to-server) call.

This is the most secure OAuth flow because:
- User credentials are never exposed to the client application
- The authorization code is short-lived and single-use
- Token exchange happens server-to-server (not through the browser)
- It supports PKCE and DPoP for additional security

---

## Attack Scenarios That the Authorization Code Flow Addresses

### 1. Credential Exposure to Third-Party Applications
**Without this flow**: The client application would need to collect the user's password directly, creating a massive trust and security problem. Every app would have access to plaintext credentials.

**With this flow**: The user only enters credentials on the trusted Kratos login form. BookShare's web app never sees or handles passwords.

### 2. Token Exposure in the Browser
**Implicit Flow vulnerability**: In the older OAuth Implicit Flow, tokens were returned directly in the URL fragment (`#access_token=...`). This exposed tokens in browser history, server logs, referrer headers, and to any JavaScript on the page.

**Authorization Code Flow**: Only a short-lived code appears in the URL. Tokens are returned in an HTTP response body on the back-channel, never in the browser's address bar.

### 3. Token Theft via Man-in-the-Middle
Even if an attacker intercepts the authorization code from the redirect URL, they cannot exchange it for tokens because:
- **PKCE**: They don't have the `code_verifier`
- **DPoP**: The tokens would be bound to a keypair they don't possess
- **Single-use**: The code is invalidated after first use

### 4. Session Fixation
An attacker could try to pre-create an OAuth session and trick the user into completing it. The `state` parameter (encrypted in a cookie) prevents this — the callback validates that the state matches what was set at login initiation.

### 5. Privilege Escalation via Scope Manipulation
The consent handler explicitly controls which scopes are granted. Even if an attacker modifies the authorization URL to request additional scopes, the consent handler only grants what is configured.

---

## How BookShare Implements the Authorization Code Flow

BookShare uses a multi-service architecture with four key components:

| Service | Role |
|---------|------|
| **Web App** (Next.js, port 3334) | Initiates OAuth flow, handles callback, stores session |
| **Hydra** (OAuth Server, port 4444) | Issues authorization codes and tokens, manages consent |
| **Auth Portal** (Next.js, port 3337) | Handles Hydra login/consent/logout challenges |
| **Kratos** (Identity Server, port 4433) | Manages user identity, credentials, and sessions |

---

### Complete Flow Walkthrough

#### Phase 1: Login Initiation

**Trigger**: User clicks "Login" or accesses a protected route.

**File**: `apps/web/src/middleware.ts`

The middleware detects unauthenticated access to protected routes (`/community`, `/my-library`, `/my-wishlist`, `/profile`, `/settings`) and redirects to `/api/auth/login?returnTo={original_path}`.

**File**: `apps/web/src/app/api/auth/login/route.ts`

```typescript
export async function GET(request: NextRequest) {
  const config = await getOIDCConfig();
  const redirectUri = getRedirectUri();
  const returnTo = sanitizeReturnTo(request.nextUrl.searchParams.get("returnTo"));

  // Generate PKCE + state
  const codeVerifier = client.randomPKCECodeVerifier();
  const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
  const state = client.randomState();

  // Build authorization URL
  const parameters = {
    redirect_uri: redirectUri,
    scope: "openid profile email offline_access",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
    prompt: "login",   // Forces fresh authentication
    max_age: "0",      // Re-authentication required
  };

  const redirectTo = client.buildAuthorizationUrl(config, parameters);

  // Store encrypted state in cookies (10-min TTL)
  response.cookies.set("oidc_code_verifier", await encrypt(codeVerifier), { ... });
  response.cookies.set("oidc_state", await encrypt(state), { ... });
  response.cookies.set("oidc_return_to", await encrypt(returnTo), { ... });

  return NextResponse.redirect(redirectTo.href);
}
```

**Result**: Browser redirects to `http://localhost:4444/oauth2/auth?client_id=bookshare-web&code_challenge=...&state=...`

---

#### Phase 2: Hydra Login Challenge

Hydra validates the authorization request and creates a login challenge. It redirects the browser to the Auth Portal:

```
http://localhost:3337/oauth/login?login_challenge={challenge_id}
```

**File**: `apps/auth/src/app/oauth/login/route.ts`

The Auth Portal:
1. Fetches the challenge details from Hydra Admin API: `GET /admin/oauth2/auth/requests/login`
2. Checks for an existing Kratos session: `GET /sessions/whoami`
3. If no session → redirects to Kratos login form
4. If session exists → validates email verification and profile completion
5. Accepts the challenge: `PUT /admin/oauth2/auth/requests/login/accept`

```typescript
// Accept the login challenge with Hydra
const acceptRes = await fetch(`${hydraAdmin}/admin/oauth2/auth/requests/login/accept?login_challenge=${challenge}`, {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    subject: kratosSession.identity.id,
    remember: true,
    remember_for: rememberFor,
    context: kratosSession.identity.traits,
  }),
});
```

---

#### Phase 3: User Authentication (Kratos)

If the user doesn't have a Kratos session, they are directed to the login form.

**Files**:
- `apps/auth/src/app/login/page.tsx` — Login page
- `apps/auth/src/components/kratos-flow-form.tsx` — Form renderer

The user enters credentials on the Kratos form. Kratos validates them, creates a session, and redirects back to the Auth Portal login handler (Phase 2 re-executes with a valid session).

---

#### Phase 4: Hydra Consent Challenge

After login acceptance, Hydra creates a consent challenge and redirects to:

```
http://localhost:3337/oauth/consent?consent_challenge={challenge_id}
```

**File**: `apps/auth/src/app/oauth/consent/route.ts`

The Auth Portal auto-accepts consent (no user confirmation screen):

```typescript
const acceptRes = await fetch(`${hydraAdmin}/admin/oauth2/auth/requests/consent/accept?consent_challenge=${challenge}`, {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    grant_scope: consentRequest.requested_scope,
    grant_access_token_audience: consentRequest.requested_access_token_audience,
    remember: true,
    remember_for: 3600,
    session: {
      id_token: {
        email: traits.email,
        email_verified: isVerified,
        name: `${traits.name?.first ?? ""} ${traits.name?.last ?? ""}`.trim(),
        given_name: traits.name?.first,
        family_name: traits.name?.last,
        preferred_username: traits.username,
      },
      access_token: { /* same claims */ },
    },
  }),
});
```

**Result**: Hydra generates an authorization code and redirects to `http://localhost:3334/api/auth/callback?code={code}&state={state}`

---

#### Phase 5: Token Exchange (Back-Channel)

**File**: `apps/web/src/app/api/auth/callback/route.ts`

This is where the authorization code is exchanged for tokens — server-to-server, never through the browser:

```typescript
// 1. Decrypt state and verifier from cookies
const codeVerifier = await decrypt(encryptedVerifier);
const expectedState = await decrypt(encryptedState);

// 2. Generate DPoP keypair for token binding
const dpopKeyPair = await generateDPoPKeyPair();
const dpopHandle = client.getDPoPHandle(config, dpopKeyPair);

// 3. Exchange code for tokens (server-to-server via internal URL)
const tokens = await client.authorizationCodeGrant(
  config,
  currentUrl,
  {
    pkceCodeVerifier: codeVerifier,    // PKCE validation
    expectedState,                      // State validation
    idTokenExpected: true,
  },
  undefined,
  { DPoP: dpopHandle }                 // DPoP binding
);
```

The `openid-client` library sends a POST to Hydra's internal token endpoint (`http://hydra:4444/oauth2/token`) with:
- `grant_type=authorization_code`
- `code={authorization_code}`
- `code_verifier={pkce_verifier}`
- `redirect_uri=http://localhost:3334/api/auth/callback`
- `DPoP` proof header

Hydra validates everything and returns:
- `access_token` (RS256 JWT, DPoP-bound with `cnf.jkt` claim)
- `id_token` (RS256 JWT with user claims)
- `refresh_token` (for obtaining new tokens)

---

#### Phase 6: Session Creation

**File**: `apps/web/src/app/api/auth/callback/route.ts` (continued)

```typescript
// Extract claims from ID token
const claims = tokens.claims()!;
const emailVerified = toBoolean(claims.email_verified);

// Check DPoP binding
const accessTokenIsDpopBound = !!tokens.access_token && tokenHasDpopBinding(tokens.access_token);
const dpopJwk = accessTokenIsDpopBound ? await exportPrivateKeyJwk(dpopKeyPair) : undefined;

// Sync user profile with API
const dpopProof = await createDPoPProof(dpopJwk, "POST", syncUrl, apiToken);
await fetch(syncUrl, {
  method: "POST",
  headers: {
    "Authorization": `DPoP ${apiToken}`,
    "DPoP": dpopProof,
    "Content-Type": "application/json",
  },
});

// Store encrypted session
await setSession({
  idToken: tokens.id_token,
  expiresAt: claims.exp ?? Math.floor(Date.now() / 1000) + 3600,
  dpopJwk,
  user: {
    id: claims.sub,
    email: claims.email,
    name: claims.name,
    username: claims.preferred_username,
    emailVerified,
  },
}, tokens.access_token);

// Cleanup and redirect
response.cookies.delete("oidc_code_verifier");
response.cookies.delete("oidc_state");
response.cookies.delete("oidc_return_to");
return NextResponse.redirect(new URL(returnTo, request.url));
```

---

#### Phase 7: Authenticated Requests

After session creation, the user is redirected to their original destination. Subsequent requests use the stored session:

**File**: `apps/web/src/features/auth/lib/api-client.ts`

```typescript
export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  const session = await getSession();

  if (token) {
    if (session?.dpopJwk && tokenHasDpopBinding(token)) {
      const dpopProof = await createDPoPProof(session.dpopJwk, method, fullUrl, token);
      headers["Authorization"] = `DPoP ${token}`;
      headers["DPoP"] = dpopProof;
    } else {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  return fetch(`${API_URL}${path}`, { ...options, headers });
}
```

---

### Logout Flow

**File**: `apps/web/src/app/api/auth/logout/route.ts`

1. Builds end-session URL with `id_token_hint` for Hydra
2. Deletes all session and OIDC cookies
3. Sets `bookshare_logged_out` marker cookie (30-min TTL)
4. Redirects to Hydra's end-session endpoint
5. Hydra routes to Auth Portal logout handler
6. Auth Portal accepts logout, Hydra redirects to post-logout URI

---

## Complete Request Sequence

```
User                Web App              Hydra           Auth Portal         Kratos
 |                    |                    |                  |                 |
 |──GET /my-library──>|                    |                  |                 |
 |                    |──(no session)──>   |                  |                 |
 |<──302 /api/auth/login?returnTo=/my-library                |                 |
 |                    |                    |                  |                 |
 |──GET /api/auth/login───────────────────>|                  |                 |
 |                    |  (generate PKCE,   |                  |                 |
 |                    |   state, cookies)  |                  |                 |
 |<──302 /oauth2/auth?code_challenge=...──>|                  |                 |
 |                    |                    |                  |                 |
 |──GET /oauth2/auth─────────────────────>|                  |                 |
 |                    |                    |──login_challenge─>|                 |
 |<──302 /oauth/login?login_challenge=...──────────────────>|                 |
 |                    |                    |                  |──whoami────────>|
 |                    |                    |                  |<─(no session)──|
 |<──302 /login───────────────────────────────────────────────|                 |
 |                    |                    |                  |                 |
 |──POST /login (email+password)──────────────────────────────────────────────>|
 |                    |                    |                  |                 |
 |<──302 /oauth/login (with kratos session)────────────────>|                 |
 |                    |                    |                  |──whoami────────>|
 |                    |                    |                  |<─(valid)───────|
 |                    |                    |<──accept_login───|                 |
 |                    |                    |──consent_challenge>|                |
 |                    |                    |<──accept_consent──|                 |
 |                    |                    |                  |                 |
 |<──302 /api/auth/callback?code=...&state=...               |                 |
 |                    |                    |                  |                 |
 |──GET /api/auth/callback───────────────>|                  |                 |
 |                    |──POST /oauth2/token                  |                 |
 |                    |  (code + verifier + DPoP)             |                 |
 |                    |<─(access_token, id_token, refresh_token)               |
 |                    |                    |                  |                 |
 |                    |──POST /api/profiles/sync (DPoP)      |                 |
 |                    |  (to NestJS API)   |                  |                 |
 |                    |                    |                  |                 |
 |<──302 /my-library (with encrypted session cookies)        |                 |
```

---

## OAuth Client Configuration

**File**: `infra/ory/hydra/init-client.sh`

```json
{
  "client_id": "bookshare-web",
  "grant_types": ["authorization_code", "refresh_token"],
  "response_types": ["code", "id_token"],
  "scope": "openid profile email offline_access",
  "token_endpoint_auth_method": "none",
  "redirect_uris": ["http://localhost:3334/api/auth/callback"],
  "post_logout_redirect_uris": [
    "http://localhost:3334",
    "http://localhost:3334/api/auth/post-logout"
  ]
}
```

Key security choices:
- **Public client** (`token_endpoint_auth_method: "none"`) — secured by PKCE + DPoP instead of a client secret
- **Strict redirect URI** — only one registered callback URL
- **Explicit grant types** — only authorization_code and refresh_token
- **Scoped access** — only OIDC standard scopes

---

## Parts of the System Touched

| Component | File(s) | Role |
|-----------|---------|------|
| **Web App Middleware** | `apps/web/src/middleware.ts` | Detects unauthenticated access, redirects to login |
| **Login Route** | `apps/web/src/app/api/auth/login/route.ts` | Generates PKCE/state, builds auth URL, sets cookies |
| **Callback Route** | `apps/web/src/app/api/auth/callback/route.ts` | Exchanges code for tokens, creates session |
| **Logout Route** | `apps/web/src/app/api/auth/logout/route.ts` | Terminates SSO session, clears cookies |
| **Post-Logout Route** | `apps/web/src/app/api/auth/post-logout/route.ts` | Final redirect after logout |
| **OIDC Config** | `apps/web/src/features/auth/lib/oidc.ts` | Server metadata, client configuration |
| **Session Manager** | `apps/web/src/features/auth/lib/session.ts` | Encrypted session storage/retrieval |
| **Crypto Module** | `apps/web/src/features/auth/lib/crypto.ts` | AES-256-GCM encryption for cookies |
| **DPoP Module** | `apps/web/src/features/auth/lib/dpop.ts` | Key generation, proof creation |
| **API Client** | `apps/web/src/features/auth/lib/api-client.ts` | Authenticated API requests with DPoP |
| **Auth Portal Login** | `apps/auth/src/app/oauth/login/route.ts` | Handles Hydra login challenges |
| **Auth Portal Consent** | `apps/auth/src/app/oauth/consent/route.ts` | Handles Hydra consent challenges |
| **Auth Portal Logout** | `apps/auth/src/app/oauth/logout/route.ts` | Handles Hydra logout challenges |
| **Kratos Config** | `infra/ory/kratos/kratos.yml` | Identity management configuration |
| **Hydra Config** | `infra/ory/hydra/hydra.yml` | OAuth server configuration |
| **Hydra Client Init** | `infra/ory/hydra/init-client.sh` | OAuth client registration |
| **NestJS Auth Guard** | `apps/api/src/common/guards/auth.guard.ts` | JWT + DPoP validation |

---

## Security Properties of This Implementation

| Property | Implementation |
|----------|---------------|
| **Credential isolation** | User passwords only handled by Kratos — never by the web app |
| **Back-channel token exchange** | Tokens never appear in URLs or browser history |
| **PKCE** | S256 code challenge prevents authorization code interception |
| **State parameter** | Encrypted nonce prevents CSRF during OAuth flow |
| **DPoP binding** | Tokens bound to cryptographic keypair at issuance |
| **Single-use codes** | Authorization codes invalidated after first exchange |
| **Short-lived cookies** | OIDC cookies expire in 10 minutes |
| **Forced re-authentication** | `prompt=login` + `max_age=0` prevents session reuse |
| **Email verification gate** | Unverified emails cannot complete the flow |
| **Account deactivation check** | Deactivated accounts blocked during profile sync |

---

## Recommendations

1. **Refresh token rotation**: Ensure Hydra is configured to rotate refresh tokens on use. This limits the window if a refresh token is compromised.

2. **Token lifetime tuning**: Consider shorter access token lifetimes (5-15 minutes) combined with refresh token rotation for tighter security.

3. **Consent scope review**: Currently consent is auto-accepted. If BookShare adds third-party OAuth clients in the future, implement a user-facing consent screen.

4. **Audit logging**: Log all token exchange events (success and failure) for security monitoring and incident response.
