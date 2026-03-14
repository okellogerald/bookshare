# Authorization Code Flow

## What Is the Authorization Code Flow?

The Authorization Code Flow is an OAuth 2.0 grant type designed for applications with a server-side component. Instead of giving the client application direct access to user credentials, the user authenticates with a trusted authorization server, which issues a short-lived authorization code. The client exchanges this code for tokens through a secure server-to-server call — a "back-channel" that the browser never sees.

This is the **most secure** OAuth flow, and the only one recommended for new applications. Every other grant type was designed for constraints that no longer apply.

---

## Why Not Other OAuth Flows?

Understanding why the Authorization Code Flow was chosen requires understanding what it replaced and why those alternatives are worse.

### The Implicit Flow (Deprecated)

The Implicit Flow was designed for single-page applications that had no server-side component. Because there was no server to do a back-channel token exchange, the authorization server returned the access token directly in the URL fragment:

```
https://bookshare.app/callback#access_token=eyJhbG...&token_type=bearer
```

**Why this is dangerous**:
- The token is in the URL fragment. While fragments aren't sent to servers in HTTP requests, they are visible in browser history, and JavaScript on the page can read them.
- If the page loads any third-party resource (analytics script, ad pixel, font), the `Referer` header may leak the URL. Some browsers include fragments in the `Referer`, some don't — inconsistent behavior is not a security strategy.
- There's no back-channel. Everything happens in the browser ("front-channel"), where it's visible to browser extensions, malicious scripts, and any observer of the URL.
- There's no way to issue refresh tokens in the Implicit Flow — the specification forbids it because there's nowhere secure to store them.
- There's no PKCE — the flow has no concept of a code exchange, so there's no place to attach a verifier.

The OAuth Working Group deprecated the Implicit Flow in the OAuth 2.1 draft. It should never be used for new applications.

### Resource Owner Password Credentials (ROPC) (Deprecated)

ROPC allows the client application to directly collect the user's username and password, then send them to the token endpoint:

```
POST /oauth2/token
  grant_type=password
  username=user@example.com
  password=secret123
```

**Why this is fundamentally broken**:
- The client application handles plaintext credentials. If the application is compromised, has logging bugs, or is poorly coded, credentials are exposed.
- It trains users to enter credentials into third-party applications. The entire point of OAuth was to **stop** this pattern.
- There's no room for multi-factor authentication, captchas, or any interactive challenge — the flow is a single POST request.
- The user cannot limit what the application can do — no consent screen, no scope selection. The app gets whatever the credentials grant.
- It cannot work with federated identity (social login, SSO) because those require browser-based interactive flows.

ROPC was intended as a migration path from pre-OAuth systems. It is deprecated in OAuth 2.1 and should never be used.

### Client Credentials Flow (Not Applicable)

The Client Credentials flow is for machine-to-machine communication where no user is involved. A service authenticates as itself (with its own credentials) to access another service's API. It's not relevant for user-facing authentication but worth mentioning to understand the landscape.

### Why Authorization Code Flow Wins

The Authorization Code Flow is the only grant type that:
1. **Keeps credentials off the client** — the user types passwords into the authorization server's login page, never into the client application
2. **Uses a back-channel for tokens** — tokens are returned in an HTTP response body on a server-to-server call, never in URLs
3. **Supports PKCE** — binding the code to the client that requested it
4. **Supports DPoP** — binding tokens to a cryptographic key at issuance
5. **Supports refresh tokens** — for long-lived sessions without re-authentication
6. **Supports interactive challenges** — MFA, captchas, email verification, profile completion

---

## Front-Channel vs. Back-Channel: Why This Distinction Matters

This is perhaps the most important concept in OAuth security.

### Front-Channel (Browser)

The "front-channel" is any communication that passes through the user's browser. This includes:
- URL redirects (`302 Location: https://...?code=abc`)
- URL fragments (`#access_token=...`)
- Form submissions
- Anything visible in the browser's address bar, history, or network tab

**Front-channel is fundamentally insecure.** The browser is a shared, observable environment. Browser extensions, malicious scripts, proxy servers, network observers, and even the user's own history can see front-channel data. You should assume that any data in the front-channel can be captured.

In the Authorization Code Flow, the **authorization code** travels through the front-channel (in the callback URL). This is acceptable because:
- The code alone is useless without the PKCE verifier
- The code is single-use (invalidated after first exchange)
- The code is short-lived (typically 10 minutes or less)

### Back-Channel (Server-to-Server)

The "back-channel" is direct communication between the client's server and the authorization server, without passing through the browser. This is a standard HTTPS POST request from the web app's server to Hydra's token endpoint.

**Back-channel is secure.** It's encrypted (TLS), it's not observable by the browser, extensions, or client-side scripts, and it's not logged in browser history.

In the Authorization Code Flow, the **tokens** travel through the back-channel. This is critical because tokens are long-lived, powerful credentials. They should never be exposed in URLs.

### BookShare's Channel Usage

| Data | Channel | Why |
|------|---------|-----|
| Authorization code | Front-channel (URL redirect) | Acceptable — single-use, short-lived, protected by PKCE |
| OAuth state parameter | Front-channel (URL parameter) | Acceptable — random nonce, also stored encrypted in cookie for validation |
| PKCE code challenge | Front-channel (URL parameter) | Acceptable — it's a hash, not the secret |
| PKCE code verifier | Back-channel (POST body) | Critical — the secret that proves the client's identity |
| Access token | Back-channel (POST response) | Critical — long-lived credential |
| Refresh token | Back-channel (POST response) | Critical — can generate new access tokens |
| DPoP proof | Back-channel (POST header) | Critical — proves key possession |
| User credentials | Kratos only (never touches client) | The most critical — passwords never leave the identity server |

---

## Why Four Services?

BookShare's authentication involves four components, which might seem over-engineered. Here's why each exists:

### Hydra (OAuth Server)
Issues authorization codes and tokens. Manages the OAuth protocol (authorization endpoint, token endpoint, JWKS, consent). Does **not** manage user identities or credentials — it delegates to Kratos.

### Kratos (Identity Server)
Manages user identities, credentials (passwords, email verification), sessions, and self-service flows (registration, login, recovery, settings). Handles the actual "who is this person?" question.

### Auth Portal (Next.js)
The UI layer that bridges Hydra and Kratos. When Hydra needs the user to log in, it redirects to the Auth Portal with a "login challenge." The Auth Portal checks for a Kratos session, shows the login form if needed, and reports back to Hydra when the user is authenticated. It also handles consent (auto-accepted for BookShare's first-party client) and logout.

### Web App (Next.js)
The application itself. Initiates OAuth flows, handles callbacks, stores sessions, proxies API requests. Never sees user credentials.

**Why not combine them?** Separation of concerns:
- Hydra handles the OAuth protocol correctly and is audited for it. Writing a custom OAuth server is a common source of security vulnerabilities.
- Kratos handles identity management (password hashing, email verification, account recovery) — another area where custom code often has flaws.
- The Auth Portal is the only component with a login UI, which limits the attack surface for credential-handling code.
- The Web App never touches credentials, which means a compromise of the web app does not expose passwords.

---

## The Complete Flow

### Phase 1: Login Initiation

The user accesses a protected route (e.g., `/my-library`) or clicks "Login." The middleware detects no valid session and redirects to the login API route, preserving the original URL as a `returnTo` parameter.

The login route:
1. Sanitizes the `returnTo` URL (path-only, no external domains — see [CSRF Token](./CSRF-TOKEN.md))
2. Generates PKCE credentials (verifier + challenge — see [PKCE](./PKCE.md))
3. Generates a random `state` parameter for OAuth CSRF protection
4. Stores verifier, state, and returnTo in encrypted httpOnly cookies (10-minute TTL)
5. Builds the authorization URL and redirects the browser to Hydra

The authorization URL includes:
- `scope: openid profile email offline_access` — standard OIDC scopes plus refresh token capability
- `prompt: login` — forces fresh authentication even if the user has an existing Hydra session
- `max_age: 0` — combined with prompt=login, ensures re-authentication. This prevents session fixation attacks where an attacker's Hydra session is reused for the victim.

### Phase 2: Hydra Login Challenge

Hydra validates the authorization request (checking client_id, redirect_uri, scopes, response_type) and creates a login challenge. It redirects the browser to the Auth Portal.

The Auth Portal:
1. Receives the login challenge ID from the URL
2. Fetches challenge details from Hydra's Admin API
3. Checks for an existing Kratos session (calling Kratos's `whoami` endpoint with the browser's Kratos cookies)
4. If no Kratos session → redirects to the Kratos login flow
5. If a Kratos session exists → validates that the user's email is verified and profile is complete
6. Accepts the login challenge with Hydra, passing the user's identity ID as the subject

### Phase 3: User Authentication (Kratos)

If the user doesn't have a Kratos session, they see the login form. This is a standard Kratos self-service flow with CSRF protection (see [CSRF Token](./CSRF-TOKEN.md)). The user enters their email and password. Kratos validates the credentials, creates a session, and redirects back to the Auth Portal.

**Key point**: The web app never sees the password. The password is typed into a Kratos-rendered form, submitted directly to Kratos, validated by Kratos, and never leaves Kratos. The web app receives an authorization code — a proof that someone authenticated, not the credentials they used.

### Phase 4: Hydra Consent Challenge

After accepting the login, Hydra creates a consent challenge. Consent is where the user would normally see a screen like "BookShare wants to access your email and profile. Allow?"

BookShare auto-accepts consent because it's a **first-party application** — BookShare's web app is talking to BookShare's own authorization server. There's no third-party trust decision to make. The user's consent to use BookShare was implicit when they registered.

The consent handler grants all requested scopes and includes user claims (email, name, username, email_verified) in both the ID token and access token sessions.

**When would you NOT auto-accept?** If BookShare ever supports third-party OAuth clients (e.g., a mobile app by a different developer, or a BookShare API integration for other services), those clients should get a user-facing consent screen where the user explicitly approves what data is shared.

### Phase 5: Token Exchange (Back-Channel)

Hydra generates an authorization code and redirects the browser to the callback URL with the code and state parameters.

The callback handler:
1. Validates the `state` parameter (decrypts the cookie, compares to the URL parameter)
2. Decrypts the PKCE `code_verifier` from the cookie
3. Generates a DPoP keypair (ECDSA P-256) for token binding
4. Sends a server-to-server POST to Hydra's token endpoint with:
   - The authorization code
   - The PKCE verifier
   - A DPoP proof (to bind the token to the keypair)
5. Hydra validates everything: code validity, PKCE match, redirect URI match
6. Hydra returns: access token (RS256 JWT with DPoP binding), ID token (RS256 JWT with user claims), refresh token

### Phase 6: Session Creation

After receiving tokens:
1. ID token claims are extracted (user ID, email, name, email verification status)
2. Email verification is checked — unverified users are redirected to a verification page
3. The DPoP private key is exported as JWK (for future DPoP proof generation)
4. A profile sync request is sent to the NestJS API (ensuring the user's profile exists in the database)
5. The session is encrypted and stored in the `bookshare_session` cookie (24-hour TTL)
6. The access token is encrypted and stored in the `bookshare_token` cookie (24-hour TTL)
7. All temporary OIDC cookies are deleted
8. The user is redirected to their original destination

### Phase 7: Authenticated Requests

After session creation, the user's browser has two encrypted cookies. On each API request:
1. The Next.js server-side code decrypts both cookies
2. If the access token has DPoP binding (`cnf.jkt` claim), a fresh DPoP proof is generated using the stored private key
3. The request is forwarded to the NestJS API (or PostgREST) with the appropriate `Authorization` header

### Logout Flow

Logout reverses the process:
1. The web app builds an end-session URL with `id_token_hint` (so Hydra knows which session to terminate)
2. All session and OIDC cookies are deleted
3. A `bookshare_logged_out` marker cookie is set (30-minute TTL) — this tells the middleware to redirect to the landing page instead of the login page
4. The browser is redirected to Hydra's end-session endpoint
5. Hydra redirects to the Auth Portal logout handler
6. The Auth Portal accepts the logout challenge and Kratos session is terminated
7. The browser is redirected to the post-logout URI

---

## Security Properties

| Property | How It's Achieved |
|----------|------------------|
| **Credentials never reach the web app** | Passwords are submitted to Kratos directly. The web app receives an authorization code — proof of authentication, not the credentials used. |
| **Tokens never appear in URLs** | Tokens are returned in the HTTP response body of the back-channel token exchange. Never in URL parameters, fragments, or redirects. |
| **Each login is unique** | PKCE verifier is per-session. OAuth state is per-session. DPoP keypair is per-session. Nothing is reused across logins. |
| **Replay is prevented** | Authorization codes are single-use. State parameter prevents injection. PKCE prevents code interception. |
| **Forced re-authentication** | `prompt=login` + `max_age=0` prevents session reuse. Each login starts fresh with Kratos. |
| **Email verification gate** | Unverified emails are caught at the callback and redirected to a verification page before session creation. |
| **Account deactivation check** | The profile sync to the NestJS API checks deactivation status. Deactivated accounts cannot complete the flow. |

---

## The Honest Limitations

### Auto-Accepted Consent

Consent is automatically granted. This is correct for a first-party application, but it means there's no user-facing checkpoint between "authenticated with Kratos" and "tokens issued by Hydra." If BookShare adds third-party OAuth clients in the future, the consent handler must be updated to present a real consent screen.

### Refresh Token Security

The flow requests `offline_access` scope, which results in a refresh token being issued. Refresh tokens are powerful — they can generate new access tokens without user interaction. BookShare stores the access token in an encrypted cookie but the refresh token handling isn't explicitly visible in the current flow. If Hydra doesn't rotate refresh tokens on use, a stolen refresh token could be used indefinitely until it expires.

### The 10-Minute Flow Window

All temporary OIDC cookies expire in 10 minutes. If a user starts the login flow, gets distracted during Kratos registration (which might involve email verification), and returns after 10 minutes, the cookies are gone. The callback will fail because the PKCE verifier and state are lost. The user must start over. This is a reasonable tradeoff — 10 minutes is generous for a login flow and keeps the attack window small.

### Single Redirect URI

The OAuth client is registered with exactly one `redirect_uri`. This is a strength (no redirect URI manipulation attacks), but it means the same callback handler must serve all login contexts. The `returnTo` cookie handles post-login routing, but if a different domain or subdomain needs to initiate login in the future, additional redirect URIs would need to be registered with careful validation.

---

## Recommendations

1. **Verify refresh token rotation**: Ensure Hydra is configured to rotate refresh tokens on use (`rotation strategy`). This means each time a refresh token is used, the old one is invalidated and a new one is issued. If an attacker steals a refresh token and uses it, the legitimate user's next refresh fails — which serves as a detection mechanism.

2. **Consider shorter access token lifetimes**: Shorter access tokens (5-15 minutes) combined with refresh token rotation provide tighter security. If an access token is leaked, the damage window is brief. The refresh token handles session continuity.

3. **Audit logging**: Log all token exchange events — successful and failed. Failed exchanges (PKCE mismatch, invalid code, expired code) are potential indicators of attack. A pattern of failures from specific IPs or for specific users warrants investigation.

4. **Monitor the consent handler**: If third-party OAuth clients are ever added, the auto-accept consent handler MUST be updated. An automated check (e.g., a test that verifies consent is prompted for non-first-party clients) would prevent this from being overlooked.
