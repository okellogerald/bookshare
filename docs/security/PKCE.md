# PKCE (Proof Key for Code Exchange)

## What Is PKCE?

PKCE (pronounced "pixy", defined in RFC 7636) is an extension to the OAuth Authorization Code flow that prevents authorization code interception attacks. It works by creating a one-time cryptographic challenge that binds the authorization request to the token exchange — so that even if an attacker intercepts the authorization code, they cannot exchange it for tokens.

The core insight is simple: before starting the OAuth flow, the client generates a random secret and sends only a **hash** of that secret to the authorization server. When exchanging the code for tokens, the client sends the **original secret**. The server hashes it and compares. Only the client that initiated the flow knows the original secret.

---

## Why PKCE Exists: The Public Client Problem

OAuth clients come in two types:

**Confidential clients** have a server-side component that can securely store a `client_secret`. When exchanging an authorization code for tokens, the client proves its identity by sending this secret. An attacker who steals the code but doesn't have the secret cannot complete the exchange.

**Public clients** cannot securely store a `client_secret`. This includes:
- Mobile apps (the binary can be decompiled — any embedded secret is extractable)
- Single-page applications (all code is visible in the browser)
- Desktop applications (same decompilation problem)

BookShare's web app is registered as a public client (`token_endpoint_auth_method: "none"`). Even though the Next.js server can keep secrets, the architecture uses PKCE instead of a client secret. Why? Because PKCE provides **per-session security** rather than relying on a single static secret. A client secret is the same for every user, every session, forever — if it leaks once, all future exchanges are compromised. A PKCE verifier is unique to each login attempt and used exactly once.

PKCE was originally designed for public clients but is now recommended for **all** OAuth clients (RFC 7636, OAuth 2.1 draft) because it provides strictly better security than a client secret alone.

---

## Attack Scenarios

### 1. Authorization Code Interception (The Core Attack)

After the user authenticates, the authorization server redirects back to the client with a code in the URL:

```
https://bookshare.app/api/auth/callback?code=abc123&state=xyz
```

This code travels through several places where it could be captured:
- **Browser history**: The full URL is saved
- **Server logs**: Web servers often log the full request URL including query parameters
- **Referrer headers**: If the callback page loads resources from other domains, the full URL leaks in the `Referer` header
- **Browser extensions**: Extensions with `webRequest` or `tabs` permissions can observe navigation URLs
- **Corporate proxies**: TLS-terminating proxies can log the URL after decryption

**Without PKCE**: The attacker takes the stolen code to the token endpoint. Since BookShare is a public client (no client secret), there's nothing stopping the exchange. The attacker receives a valid access token, refresh token, and ID token — full access to the victim's account.

**With PKCE**: The attacker has the code, but the token endpoint requires the `code_verifier` — a 128-character random string that was generated in the server's memory, encrypted, and stored in an httpOnly cookie on the user's browser. The attacker has none of these. The exchange fails.

### 2. Malicious App URL Scheme Hijacking (Mobile Context)

On mobile platforms, multiple apps can register the same custom URL scheme (e.g., `bookshare://callback`). A malicious app registers the same scheme, intercepts the redirect, captures the authorization code, and races to exchange it before the legitimate app does.

PKCE defeats this because the malicious app didn't initiate the flow — it doesn't have the `code_verifier`. Even if it exchanges the code first, the token endpoint rejects it.

While BookShare is currently a web app, if a mobile client is ever added, PKCE is already in place.

### 3. Authorization Code Replay

An attacker records a valid authorization code (from logs, network capture, or browser history) and attempts to replay it later. Even if the code hasn't expired yet, without the corresponding `code_verifier`, the replay fails. And since authorization codes are single-use (Hydra invalidates them after the first exchange), even legitimate replay is impossible.

### 4. Client Impersonation

Without PKCE and without a client secret, the only thing identifying the client is the `client_id` — which is public information (it appears in the authorization URL, in browser history, etc.). Any application that knows the `client_id` could exchange a stolen code.

PKCE turns the problem from "know the client ID" to "know the code verifier," which is a per-session cryptographic secret that never appears in any URL.

---

## How PKCE Works

```
1. Client generates a random secret:        code_verifier  (128 random chars)
2. Client computes a hash of that secret:   code_challenge = base64url(SHA-256(code_verifier))
3. Client sends only the HASH to the auth server (in the authorization request URL)
4. Auth server stores the hash alongside the session/code
5. User authenticates, auth server issues authorization code
6. Client sends the ORIGINAL SECRET to the token endpoint (with the code)
7. Token endpoint computes SHA-256(code_verifier) and compares to stored hash
8. If they match → tokens issued. If not → rejected.

The security: SHA-256 is a one-way function.
An attacker who sees the code_challenge cannot reverse it to get the code_verifier.
An attacker who sees the authorization code cannot exchange it without the code_verifier.
```

### Why SHA-256 and Not the "Plain" Method?

PKCE defines two challenge methods:
- **`plain`**: `code_challenge = code_verifier` (the challenge IS the verifier, unmodified)
- **`S256`**: `code_challenge = base64url(SHA-256(code_verifier))`

The `plain` method provides **almost no security** because the `code_challenge` is sent in the authorization URL — the same places where the authorization code could be intercepted. If an attacker can see the URL, they can see both the code and the challenge (which IS the verifier in `plain` mode). They have everything they need.

With `S256`, the authorization URL contains only the hash. The verifier never appears in any URL, only in the server-to-server POST request during token exchange. Even if an attacker captures the entire authorization URL, they see the hash and cannot reverse it.

BookShare uses `S256` exclusively. The `plain` method should never be used — it exists only for clients that can't perform SHA-256, which is essentially no modern client.

### Why Is the Verifier 128 Characters?

RFC 7636 specifies a minimum of 43 characters and maximum of 128. BookShare uses the maximum. The verifier must have enough entropy that an attacker cannot brute-force it within the code's short lifetime. At 128 characters drawn from the unreserved character set `[A-Z] [a-z] [0-9] - . _ ~` (66 possible characters), the entropy is approximately 768 bits — astronomically beyond what's needed. Even the minimum 43 characters provides approximately 256 bits of entropy, which is already computationally infeasible to brute-force.

Using the maximum is a zero-cost decision (a few extra bytes in a cookie) that provides maximum safety margin.

---

## How BookShare Implements PKCE

### Step 1: Generate PKCE Credentials

When the user initiates login (either by clicking "Login" or being redirected from a protected route), the login API route:

1. Generates a `code_verifier`: 128 cryptographically random characters using `openid-client`'s PKCE helper
2. Computes the `code_challenge`: `base64url(SHA-256(code_verifier))` — producing a 43-character URL-safe string

### Step 2: Store the Verifier Securely

The `code_verifier` is the secret. It must be available when the callback arrives (potentially seconds to minutes later, after the user authenticates with Kratos), but it must not be accessible to attackers.

BookShare stores it in an **encrypted httpOnly cookie**:
- **Encrypted** with AES-256-GCM (via the crypto module described in [Cookie Encryption](./COOKIE-ENCRYPTION.md)) — even if the cookie is stolen from the browser, the verifier is ciphertext
- **httpOnly** — JavaScript cannot read it (XSS cannot extract it)
- **SameSite=Lax** — not sent on cross-site form submissions
- **10-minute maxAge** — if the OAuth flow takes longer than 10 minutes, the cookie expires and the flow fails (the user just starts over)
- **Secure in production** — HTTPS only

Why a cookie and not server-side storage? Because the Next.js web app runs as stateless server processes. There's no shared in-memory store between the process that initiates login and the process that handles the callback. A cookie travels with the user's browser, making it available to whichever server process handles the callback request.

### Step 3: Send Only the Challenge

The authorization URL sent to Hydra includes:
- `code_challenge` — the SHA-256 hash (safe to expose)
- `code_challenge_method=S256` — tells Hydra to expect SHA-256 verification

The `code_verifier` is **not** in this URL. It stays in the encrypted cookie.

### Step 4: Token Exchange with Verifier

When Hydra redirects back to the callback URL with the authorization code:

1. The callback handler reads the `oidc_code_verifier` cookie
2. Decrypts it with AES-256-GCM to recover the plaintext verifier
3. Sends the verifier in the POST body to Hydra's token endpoint (server-to-server, over HTTPS)
4. Hydra computes `SHA-256(received_verifier)` and compares to the stored `code_challenge`
5. Match → tokens issued. Mismatch → 400 error, no tokens.

The `openid-client` library handles the verifier inclusion and validation automatically as part of `authorizationCodeGrant()`.

### Step 5: Cleanup

After successful token exchange, all three temporary OIDC cookies are deleted:
- `oidc_code_verifier` — the PKCE verifier
- `oidc_state` — the OAuth CSRF state parameter
- `oidc_return_to` — the post-login redirect path

These are single-use artifacts of the login flow. Leaving them around provides no benefit and marginally increases the attack surface.

---

## Complete PKCE Flow

```
Web App (Next.js)                                  Hydra (OAuth Server)
─────────────────                                  ────────────────────

1. Generate:
   verifier = random(128 chars)
   challenge = base64url(SHA256(verifier))

2. Store verifier:
   cookie = AES-256-GCM(verifier)
   [httpOnly, SameSite=Lax, Secure, 10min TTL]

3. Redirect user with challenge: ──────────────>
   GET /oauth2/auth?                              4. Store challenge,
     code_challenge={challenge}                      associate with session
     code_challenge_method=S256
     client_id=bookshare-web
     redirect_uri=/api/auth/callback
     state={encrypted_random}
                                                   5. User authenticates (Kratos)
                                                   6. Issue authorization code

7. Receive callback:  <────────────────────────
   GET /api/auth/callback?
     code={auth_code}&state={state}

8. Decrypt verifier from cookie

9. Exchange code + verifier: ──────────────────>
   POST /oauth2/token                             10. Compute SHA256(verifier)
     grant_type=authorization_code                     Compare to stored challenge
     code={auth_code}                                  Match? → issue tokens
     code_verifier={original_verifier}                 Mismatch? → reject
     + DPoP proof header

11. Receive tokens:  <─────────────────────────
    access_token (DPoP-bound, RS256 JWT)
    id_token (RS256 JWT)
    refresh_token

12. Delete OIDC cookies, create session
```

---

## The Honest Limitations

### PKCE Protects the Code Exchange, Not the Tokens After

Once tokens are issued, PKCE's job is done. It has no role in protecting the tokens themselves. If the access token is leaked after issuance (from logs, memory, a compromised proxy), PKCE doesn't help — that's DPoP's job.

### PKCE Assumes the Verifier Storage Is Secure

If an attacker can extract the `code_verifier` from storage, PKCE is bypassed. BookShare mitigates this by encrypting the verifier with AES-256-GCM in an httpOnly cookie. An attacker would need either:
- The `SESSION_SECRET` to decrypt the cookie, or
- A browser extension with cookie API access to extract the encrypted blob, PLUS the ability to decrypt it

But if the attacker compromises the server itself (accessing `SESSION_SECRET`), they can decrypt any cookie — PKCE is the least of the problems at that point.

### PKCE Does Not Prevent Phishing

If a user is tricked into authenticating on a fake BookShare login page, the attacker captures credentials directly. PKCE only protects the OAuth flow between the real client and the real authorization server. It doesn't help when the user interacts with a fake one.

### The 10-Minute Window

The PKCE verifier cookie expires in 10 minutes. If the OAuth flow takes longer (e.g., the user gets distracted during Kratos registration), the flow fails silently. The user must start over. This is a UX tradeoff for security — keeping the window short minimizes the time a verifier is "live" in the cookie store.

---

## How PKCE Fits With Other Security Measures

PKCE is one layer in the authorization code exchange. Here's how it interacts with the others:

| Threat | PKCE's Role | Complementary Defense |
|--------|------------|----------------------|
| Code intercepted from URL | Prevents exchange without verifier | State parameter prevents injection of attacker's code |
| Code stolen from browser history | Same — verifier required | Codes are single-use (Hydra invalidates after first exchange) |
| Token stolen after exchange | Not PKCE's job | DPoP binds tokens to a cryptographic keypair |
| User tricked into fake login | Not PKCE's job | Return-to URL sanitization prevents phishing redirects |
| Verifier stolen from cookie | PKCE bypassed | Cookie encryption (AES-256-GCM) + httpOnly + SameSite |

---

## Recommendations

1. **Enforce PKCE at the Hydra level**: If Hydra supports a `require_pkce: true` flag in client configuration, enable it. This ensures PKCE cannot be accidentally bypassed by a code path that forgets to include the challenge. Currently, PKCE enforcement depends on the client code always generating and sending the challenge — a server-side requirement is stronger.

2. **The implementation is solid**: S256 challenge method, maximum verifier length, encrypted storage with short TTL. No changes needed to the PKCE mechanism itself.

3. **Consider logging PKCE failures**: If the token exchange fails due to a PKCE mismatch, log it as a security event. Repeated PKCE failures for a specific `client_id` or from specific IPs could indicate an active code interception attack.
