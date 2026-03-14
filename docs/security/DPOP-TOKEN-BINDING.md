# DPoP Token Binding (Demonstration of Proof-of-Possession)

## What Is DPoP?

DPoP (RFC 9449) is a mechanism that binds access tokens to a specific cryptographic keypair, transforming them from **bearer tokens** (usable by anyone who possesses them) into **sender-constrained tokens** (usable only by someone who can prove they hold a specific private key).

The analogy: a bearer token is like cash — whoever holds it can spend it. A DPoP-bound token is like a debit card with a PIN — you need both the card (the token) and the PIN (the private key) to use it.

Every API request with a DPoP-bound token must include a **DPoP proof** — a fresh, short-lived JWT signed with the private key that the token was bound to. The server verifies that:
1. The proof was signed by the key matching the token's binding
2. The proof was created for this specific request (correct HTTP method, URL, and timestamp)
3. The proof references this specific access token

If any check fails, the request is rejected — even though the access token itself is valid.

---

## The Bearer Token Problem

Before DPoP, OAuth exclusively used bearer tokens. The concept is simple: present the token in the `Authorization: Bearer {token}` header, and the server accepts it. No proof of identity, no cryptographic challenge, no binding to the presenter.

This creates a fundamental vulnerability: **if the token is stolen, the thief has full access.** The token doesn't know or care who is presenting it.

Tokens can be stolen through:
- **Server-side logging**: Access tokens appear in `Authorization` headers. If an API server, proxy, or load balancer logs request headers (intentionally or accidentally), the tokens are in plaintext in log files. A breach of the log aggregation system (Elasticsearch, Splunk, CloudWatch) exposes every logged token.
- **Error tracking systems**: When an API request fails, error tracking tools (Sentry, Bugsnag) often capture the full request, including headers. Tokens end up in third-party systems.
- **TLS-terminating proxies**: In architectures where TLS terminates at a load balancer or CDN, the traffic between the proxy and the backend is unencrypted on the internal network. A compromised internal host can sniff tokens.
- **Memory dumps**: If a server crashes and generates a core dump, in-flight request data (including Authorization headers) may be captured in the dump file.
- **Browser dev tools / XSS**: If tokens are accessible to client-side JavaScript (not the case in BookShare, but common in SPAs), XSS can exfiltrate them.

In all these scenarios, a bearer token gives the attacker unrestricted access for the token's entire remaining lifetime. DPoP changes this equation.

---

## The Sender-Constrained Token Concept

DPoP belongs to a family of mechanisms called "sender-constrained tokens" — tokens that are bound to a specific sender and cannot be used by anyone else.

The two main approaches are:

**mTLS (Mutual TLS Certificate Binding, RFC 8705)**: The token is bound to the client's TLS certificate. The server checks that the TLS connection's client certificate thumbprint matches the token's binding. Strengths: operates at the transport layer, handled by TLS infrastructure. Weaknesses: requires client certificate management, doesn't work through proxies that terminate TLS, complex certificate lifecycle.

**DPoP (Demonstration of Proof-of-Possession, RFC 9449)**: The token is bound to an application-layer keypair. The client proves possession by signing a proof JWT for each request. Strengths: works at the application layer (no TLS dependency), works through any proxy or CDN, key management is simpler (ephemeral keys, no CA). Weaknesses: requires per-request cryptographic operations, proof validation adds server-side complexity.

**Why BookShare chose DPoP**: BookShare runs behind Docker networking with Nginx as a reverse proxy. mTLS would require managing client certificates across the Docker network, configuring Nginx for mutual TLS, and ensuring certificates are available at the right layers. DPoP is application-layer — it works regardless of the infrastructure between the client and the API.

---

## Attack Scenarios

### 1. Token Theft and Replay

**The scenario**: An access token is captured from a log file, error tracking system, or network interceptor. The attacker attempts to use it.

**Without DPoP**: The attacker sends `Authorization: Bearer {stolen_token}`. The API validates the token's signature and expiration — both are fine. Access granted.

**With DPoP**: The API sees `Authorization: DPoP {stolen_token}` and requires a `DPoP` header containing a proof. The attacker doesn't have the private key that the token is bound to (the `cnf.jkt` claim references a key thumbprint). They cannot create a valid proof. Access denied.

### 2. Token Exfiltration via Log Aggregation Breach

**The scenario**: A company's log aggregation system is breached. Millions of access tokens from the past days are exposed.

**Without DPoP**: Every token is immediately usable until its expiration.

**With DPoP**: Every token has a `cnf.jkt` claim binding it to a key the attacker doesn't have. Not a single token is usable.

This is perhaps DPoP's most practical benefit — it transforms token leaks from "catastrophic, immediate access" to "useless data."

### 3. Man-in-the-Middle at the TLS Termination Point

**The scenario**: A compromised or misconfigured load balancer captures both the access token and the DPoP proof from a legitimate request.

**What the attacker has**: The token AND one valid proof.

**What the attacker can do**: Replay the exact same request (same method, same URL) within the proof's 60-second freshness window. This is a narrow attack.

**What the attacker cannot do**: Use the token against a different endpoint (the proof's `htm` and `htu` won't match), use it after 60 seconds (the proof's `iat` expires), or create a new proof for any other request (they don't have the private key).

This is an honest limitation — DPoP doesn't provide perfect protection against a full man-in-the-middle that captures both token and proof. But it shrinks the attack window from "token's entire remaining lifetime against any endpoint" to "60 seconds against one specific endpoint."

### 4. Cross-Endpoint Token Abuse

**The scenario**: An attacker somehow obtains a valid token and proof for `GET /api/books`. They want to use it for `DELETE /api/copies/123`.

**Why it fails**: Each DPoP proof contains `htm` (HTTP method) and `htu` (HTTP URI). A proof for `GET /api/books` produces an `htm`/`htu` mismatch when presented to `DELETE /api/copies/123`. The API rejects it.

The attacker would need to create a new proof for the target endpoint — which requires the private key.

### 5. Stolen Token Without Session Cookie

**The scenario**: An attacker captures just the `bookshare_token` cookie (the encrypted access token) but not the `bookshare_session` cookie (which contains the DPoP private key).

This could happen if:
- Only one cookie leaks through a bug
- A log captures the token but not the session
- A network interception catches only one cookie

**Why the token is useless**: The access token has a `cnf.jkt` claim (DPoP binding). The NestJS API requires a DPoP proof matching that binding. The private key needed to create the proof is in the session cookie — which the attacker doesn't have.

---

## How DPoP Works Conceptually

```
Traditional Bearer Token:
  Client → Server: Authorization: Bearer {token}
  Server: Token valid? YES → Allow.

DPoP-Bound Token:
  Client → Server: Authorization: DPoP {token}
                   DPoP: {proof_jwt}
  Server: Token valid? YES.
          Proof signed by the right key? YES (cnf.jkt matches).
          Proof for this method? YES (htm = GET).
          Proof for this URL? YES (htu = /api/books).
          Proof is fresh? YES (iat within 60 seconds).
          Proof references this token? YES (ath = SHA256(token)).
          → Allow.
```

The DPoP proof is itself a JWT:
```
Header: { typ: "dpop+jwt", alg: "ES256", jwk: { public key components } }
Payload: {
  jti: "unique-random-id",                      // Nonce — prevents replay
  htm: "GET",                                    // HTTP method binding
  htu: "https://api.bookshare.app/api/books",   // URL binding
  iat: 1710457200,                               // Issued-at timestamp
  ath: "base64url(SHA-256(access_token))"        // Access token hash binding
}
Signature: ES256(private_key)
```

### Why ES256 for DPoP Proofs (Not RS256)?

The access token is signed with RS256 (RSA), but DPoP proofs use ES256 (ECDSA with P-256). This is deliberate:

- **Performance**: ECDSA P-256 key generation and signing is significantly faster than RSA-2048. Since a fresh DPoP proof is created for every API request, speed matters. ECDSA signing is ~10x faster than RSA.
- **Key size**: A P-256 key pair is ~64 bytes (public) + ~32 bytes (private). An RSA-2048 key pair is ~256 bytes (public) + ~1200 bytes (private). The DPoP private key is stored in the encrypted session cookie — every byte counts for cookie size limits.
- **Adequate security**: P-256 provides 128-bit security, which is equivalent to RSA-3072. More than sufficient for short-lived proofs.

The DPoP proof doesn't need to interoperate with the access token's signing algorithm. They serve different purposes: RS256 is for long-term trust (Hydra's JWKS-published keys), ES256 is for ephemeral per-request proofs.

---

## How BookShare Implements DPoP

### Key Generation

During the OAuth callback (after receiving the authorization code), a fresh ECDSA P-256 keypair is generated using `openid-client`'s secure random key generation. The key is created with `extractable: true` so the private key can be exported as JWK for storage.

This keypair is **per-session** — each login generates a new one. If a user logs in from two devices, each device has its own keypair and its own DPoP-bound access token. There is no key reuse across sessions.

### Token Binding at Issuance

The `openid-client` library creates a DPoP proof for the token exchange request. This proof contains the public key. Hydra:

1. Extracts the public key from the DPoP proof header
2. Computes its SHA-256 JWK Thumbprint (RFC 7638) — a canonical hash of the key's parameters
3. Embeds this thumbprint as `cnf.jkt` in the issued access token

From this point forward, the access token is bound to this specific key. Any DPoP proof presented with this token must be signed by the key that produces this thumbprint.

### Private Key Storage

The DPoP private key (the full JWK including the `d` parameter — the private scalar) is stored inside the encrypted `bookshare_session` cookie. This is the most sensitive field in the session — if it leaks in plaintext, an attacker could create DPoP proofs for the corresponding access token.

The key is protected by:
- **AES-256-GCM encryption** (via the cookie encryption system)
- **httpOnly** (no JavaScript access)
- **SameSite=Lax** (not sent on cross-site requests)
- **Secure in production** (HTTPS only)

### Per-Request Proof Generation

For every API request, the web app's server-side code:

1. Decrypts the session cookie to access the DPoP private key
2. Creates a fresh DPoP proof JWT with:
   - `jti`: A fresh UUID (unique per proof)
   - `htm`: The HTTP method of the request (GET, POST, PUT, DELETE)
   - `htu`: The URL of the request (scheme + host + path, no query or fragment — per RFC 9449)
   - `iat`: Current Unix timestamp
   - `ath`: `base64url(SHA-256(access_token))` — binding to the specific token
3. Signs the proof with ES256
4. Sends the request with `Authorization: DPoP {token}` and `DPoP: {proof}` headers

### Server-Side Proof Validation

The NestJS auth guard performs 8 validation checks on every DPoP-authenticated request:

| # | Check | What It Catches |
|---|-------|----------------|
| 1 | Proof type is `dpop+jwt` | Prevents confusion with other JWT types |
| 2 | ES256 signature is valid | Proves the presenter holds the private key |
| 3 | `htm` matches the request's HTTP method | Prevents proof reuse across different methods |
| 4 | `htu` matches the request's URL | Prevents proof reuse across different endpoints |
| 5 | `iat` is within 60 seconds of server time | Prevents replay of old proofs |
| 6 | `jti` is present | Unique identifier for potential replay detection |
| 7 | `ath` matches `SHA-256(access_token)` | Binds the proof to this specific token |
| 8 | JWK thumbprint matches token's `cnf.jkt` | Ensures the proof key is the one the token was bound to |

If any check fails, the request is rejected with a 401.

---

## The Honest Trust Model

### Where DPoP Proofs Are Generated

In BookShare's architecture, DPoP proofs are generated **server-side** in the Next.js web app — not in the browser. The private key never reaches client-side JavaScript. The flow is:

```
Browser → Next.js Server (decrypt cookie, create DPoP proof) → NestJS API (validate proof)
```

This means DPoP protects the **API layer** from token theft at the API layer. If someone steals a token from API logs, a proxy, or an error tracking system, the token is useless without the DPoP key.

But DPoP does **not** provide browser-to-server binding in the traditional sense. The "proof of possession" happens at the Next.js server, not in the user's browser.

### The Full Cookie Replay Scenario

Here's the scenario that DPoP, in BookShare's architecture, does NOT fully prevent:

If an attacker steals **both** encrypted cookie blobs (`bookshare_session` + `bookshare_token`) and replays them in their own browser:

1. Attacker's browser sends both encrypted cookies to Next.js
2. Next.js decrypts them (using `SESSION_SECRET` on the server)
3. Next.js extracts the DPoP private key from the session
4. Next.js creates a valid DPoP proof using that key
5. Next.js sends the proof + token to the NestJS API
6. API validates everything — it all checks out
7. Request succeeds. Attacker has access.

**Why?** Because both cookie blobs contain everything needed: the session (with DPoP key) and the token (with DPoP binding). Replaying both cookies through the Next.js server is sufficient.

### So What Does DPoP Actually Protect in This Architecture?

DPoP's value is in the **layers between the Next.js server and the API**:

| Theft Location | Without DPoP | With DPoP |
|---------------|-------------|-----------|
| API server logs (token in Authorization header) | Full access until expiry | Useless — no DPoP key |
| Error tracking system (Sentry captures request) | Full access until expiry | Useless — proof was for one specific request |
| TLS-terminating proxy logs | Full access until expiry | 60-second window, one endpoint only |
| Compromised internal service that receives tokens | Full access until expiry | Useless — can't create proofs for other endpoints |
| PostgREST logs | Full access | Currently unprotected (PostgREST doesn't validate DPoP) |
| Next.js server cookie theft (both cookies) | Full access | Full access (DPoP bypassed at the cookie layer) |

The protection is real and significant — the most common token leakage vectors (logging, error tracking, proxies) are all neutralized. The gap is at the cookie layer, which is protected by encryption and httpOnly instead.

---

## The 60-Second Replay Window

Each DPoP proof includes an `iat` timestamp. The server accepts proofs within a 60-second window of the current time. This creates a narrow replay opportunity: if an attacker captures both the token AND a proof in transit, they can replay that exact request (same method, same URL) within 60 seconds.

### Why Not Tighter?

- **Clock skew**: The Next.js server and the NestJS API may have slightly different clocks, especially in containerized environments. A too-tight window causes legitimate requests to fail.
- **Network latency**: The proof is created before the request is sent. If the network adds latency, the proof ages during transit.
- **Practical risk**: Capturing both token and proof in transit requires a man-in-the-middle at the internal network level. If an attacker has that position, they likely have broader access anyway.

### The `jti` Nonce Gap

Each proof includes a `jti` (unique UUID). The RFC envisions servers tracking seen `jti` values to detect replays within the 60-second window. BookShare's auth guard validates that `jti` is present but does **not** maintain a server-side nonce cache to check for duplicates. This means exact replay within the 60-second window is theoretically possible.

Implementing `jti` tracking would require a shared cache (Redis) across API server instances, adding infrastructure complexity. The practical risk is low — exploiting this requires capturing both token and proof from the internal network and replaying within 60 seconds to the same endpoint.

---

## DPoP Data Flow

```
1. LOGIN: Generate keypair
   ┌──────────────────────────────┐
   │  privateKey (ECDSA P-256)    │  Generated fresh per login session
   │  publicKey  (ECDSA P-256)    │  Never reused across sessions
   └──────────────────────────────┘
                │
2. TOKEN EXCHANGE: Bind token to key
                │
   Next.js ─────┼────────────────────────> Hydra
   POST /oauth2/token                      │
   DPoP: { proof with embedded public key} │
                                           ▼
                                  thumbprint = SHA-256(canonicalize(publicKey))
                                  Embed in token: { cnf: { jkt: thumbprint } }
                │
   Next.js <────┼────────────────────────
   access_token (with cnf.jkt binding)
                │
3. SESSION: Store private key encrypted
                │
   bookshare_session = AES-256-GCM({
     dpopJwk: { kty, crv, x, y, d },  ← full private key
     user: { id, email, name, ... },
     expiresAt: ...
   })
                │
4. EACH API REQUEST: Fresh proof per request
                │
   Browser sends cookies → Next.js decrypts → creates proof:
   ┌──────────────────────────────────────────┐
   │  DPoP Proof (JWT):                       │
   │  Header: { typ: dpop+jwt, alg: ES256,   │
   │            jwk: { public key } }         │
   │  Payload: { jti: uuid, htm: GET,         │
   │            htu: .../api/books,           │
   │            iat: now, ath: SHA256(token) } │
   │  Signature: ES256(privateKey)            │
   └──────────────────────────────────────────┘
                │
   Next.js ─────┼────────────────────────> NestJS API
   Authorization: DPoP {access_token}
   DPoP: {proof_jwt}
                                           │
5. VALIDATION: 8 checks                   ▼
                                  ✓ typ = dpop+jwt
                                  ✓ ES256 signature valid
                                  ✓ htm matches request method
                                  ✓ htu matches request URL
                                  ✓ iat within 60 seconds
                                  ✓ jti present
                                  ✓ ath matches SHA256(token)
                                  ✓ key thumbprint matches cnf.jkt
                                           │
                                  ALL PASS → Request proceeds
```

---

## Recommendations

1. **Implement server-side `jti` tracking**: Add a short-lived nonce cache (Redis with 60-second TTL matching the `iat` tolerance). When a proof is validated, store its `jti`. If a proof with the same `jti` is seen again, reject it. This closes the 60-second replay window. The implementation is straightforward: `SET jti:{value} 1 EX 60 NX` — if the key already exists, it's a replay.

2. **Consider server-issued nonces**: RFC 9449 supports the server sending a `DPoP-Nonce` response header. The client must include this nonce in its next proof. This provides even stronger replay protection because the server controls nonce freshness. The tradeoff is an additional round-trip when the nonce changes (the first request fails with a `use_dpop_nonce` error, the client retries with the new nonce).

3. **Extend DPoP validation to PostgREST**: Currently, the Next.js proxy sends DPoP proofs to the NestJS API but uses plain Bearer tokens for PostgREST (since PostgREST doesn't support DPoP validation natively). If PostgREST tokens are logged or intercepted, they're usable without DPoP. Consider routing all PostgREST requests through the NestJS API (which validates DPoP) rather than directly.

4. **Monitor DPoP validation failures**: Track failure reasons in metrics:
   - `htm`/`htu` mismatches → may indicate routing issues (reverse proxy changing URLs)
   - `iat` failures → may indicate clock skew between containers
   - `cnf.jkt` mismatches → may indicate token/key desynchronization (a serious bug)
   - Overall failure rate → a sudden spike may indicate an attack
