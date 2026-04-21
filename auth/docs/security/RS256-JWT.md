# RS256 JWT (JSON Web Token with RSA-SHA256)

## What Is a JWT?

A JSON Web Token (JWT) is a compact, URL-safe format for representing claims between two parties. Despite what many developers assume, **JWTs are not encrypted**. They are **signed** — which means anyone can read their contents, but no one can modify them without detection.

A JWT has three parts, separated by dots:

```
eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEyMyJ9.signature_bytes
│                      │                            │
│  Header (base64url)  │  Payload (base64url)       │  Signature
│  {"alg":"RS256"}     │  {"sub":"user-123",...}     │  RSA-SHA256(header.payload)
```

Anyone can base64-decode the header and payload. There are no secrets there. The security comes entirely from the **signature** — proof that the token was created by a trusted authority (Hydra) and hasn't been modified since.

### The Common Misconception

Many developers treat JWTs as opaque, secure tokens. They are not. If you paste a BookShare access token into [jwt.io](https://jwt.io), you'll see the full payload: user ID, email, name, roles, expiration, DPoP key thumbprint. This is by design — JWTs are meant to carry readable claims. The signature ensures those claims are trustworthy, not secret.

**When this matters**: Don't put genuinely secret information in JWT claims. User IDs, emails, and roles are fine — they're not secret from the user. But an API key, a password hash, or internal system identifiers should never appear in a JWT payload.

---

## What Is RS256?

RS256 means RSA signature with SHA-256. It's an **asymmetric** signing algorithm:

- **Private key** (held by Hydra): Used to create signatures. Must be kept secret.
- **Public key** (published at JWKS endpoint): Used to verify signatures. Safe to share with everyone.

This is fundamentally different from **symmetric** algorithms like HS256, where a single shared secret is used for both signing and verification.

### Why Asymmetric Matters

In a microservice architecture, every service that needs to verify tokens must be able to check signatures:

**With HS256 (symmetric)**: Every verifying service needs the signing secret. The NestJS API needs it. PostgREST needs it. Any future service needs it. Each copy of the secret is a potential leak. If any service is compromised, the attacker can forge unlimited tokens for any user.

**With RS256 (asymmetric)**: Only Hydra has the private key. Every other service has only the public key. If the NestJS API is compromised, the attacker gets a public key — which is already public. They cannot forge tokens. Only a compromise of Hydra itself would allow token forgery.

This is why BookShare uses RS256: the number of services that can verify tokens can grow without increasing the signing key's exposure.

---

## Attack Scenarios

### 1. Token Forgery

**The threat**: An attacker creates a fake JWT with arbitrary claims — admin role, different user ID, elevated permissions — and sends it to the API.

**Why RS256 prevents it**: Creating a valid RS256 signature requires Hydra's private RSA key. RSA's security is based on the difficulty of factoring large prime numbers. With a 2048-bit key (standard minimum), brute-forcing the private key would take longer than the age of the universe with current computing technology.

The API verifies every token's signature using Hydra's public key. A forged token produces an invalid signature and is rejected immediately.

### 2. The Algorithm Confusion Attack (Historical, Famous)

This is one of the most well-known JWT vulnerabilities.

**How it works**: The attacker changes the JWT header's `alg` from `RS256` to `HS256`. Then they sign the token using the **public key** (which is freely available) as if it were an HS256 shared secret.

If the server naively reads the `alg` field from the token and uses it to select the verification algorithm, it would:
1. See `alg: HS256`
2. Use the "secret" (which happens to be the public key) for HMAC verification
3. The signature is valid because the attacker signed with the same "secret"
4. The forged token is accepted

**Why BookShare is immune**: The auth guard explicitly hardcodes the accepted algorithm:
```typescript
algorithms: ["RS256"]  // Only RS256 — never trust the token's alg claim
```

Any token with a different algorithm in the header is rejected regardless of signature validity. The server never uses the token's `alg` claim to select the verification algorithm.

### 3. The `none` Algorithm Attack (Historical)

Early JWT libraries accepted `"alg": "none"` — a completely unsigned token. An attacker could create a JWT with any claims, set `alg` to `none`, omit the signature, and some libraries would accept it as valid.

This is prevented the same way as the algorithm confusion attack — by explicitly restricting to `["RS256"]`. The `none` algorithm is never accepted.

### 4. Key Confusion (Wrong Key)

**The threat**: An attacker sets up their own key server, publishes their own public key, and attempts to trick the API into using it for verification.

**How BookShare prevents it**:
- JWT headers contain a `kid` (Key ID) that identifies which key was used to sign the token
- The JWKS client fetches keys **only** from Hydra's configured JWKS endpoint (`/.well-known/jwks.json`)
- It looks up the key by `kid` — only keys published by Hydra are trusted
- An attacker's key, even if it has the same `kid`, would only be accepted if they compromised the JWKS endpoint itself

### 5. Token Issued by Wrong Authority

**The threat**: An attacker runs their own authorization server, issues valid RS256 JWTs signed with their own key, and sends them to BookShare's API.

**How BookShare prevents it**: The auth guard validates the `iss` (issuer) claim against the configured `OIDC_ISSUER`. A token from `https://evil-auth.com` is rejected because the issuer doesn't match, regardless of whether the signature is cryptographically valid.

### 6. Expired Token Replay

**The threat**: An attacker captures a valid token (from logs, network capture, or memory dump) and replays it hours or days later.

**How BookShare prevents it**: Every token has an `exp` (expiration) claim — a Unix timestamp after which the token is invalid. The JWT library automatically checks this during verification. Expired tokens are rejected without reaching application code.

### 7. Shared Secret Compromise (The HS256 Nightmare)

This isn't an attack on RS256 — it's the reason RS256 was chosen over HS256.

If a shared HS256 secret leaks (from a config file, a log entry, a compromised service, an employee's laptop), the attacker can forge unlimited tokens for any user, with any claims, with any expiration. The only fix is to rotate the secret, which immediately invalidates all existing tokens and forces every user to re-authenticate.

With RS256, this scenario is structurally impossible for any service except Hydra. A compromise of the NestJS API, PostgREST, or any future service does not expose token-forging capability.

---

## How BookShare Implements RS256 JWT

### Token Issuance (Hydra)

Hydra is configured to issue JWT access tokens (not opaque tokens). When the token exchange succeeds (after PKCE and DPoP validation), Hydra:

1. Constructs the JWT payload with user claims, scopes, expiration, issuer, audience, and DPoP binding (`cnf.jkt`)
2. Signs it with RS256 using its internally managed private key
3. Returns the signed JWT as the `access_token`

Hydra publishes its public keys at `/.well-known/jwks.json`. This endpoint returns a JSON Web Key Set (JWKS) containing the public keys, their `kid` values, and their algorithm. Any service can fetch these keys to verify tokens.

### Token Verification (NestJS API)

The auth guard, registered globally on every API endpoint, performs verification on every request:

1. **Extract token**: Reads the `Authorization` header, determines the scheme (Bearer or DPoP), extracts the JWT string
2. **Parse header**: Reads the JWT header to get the `kid` (Key ID)
3. **Fetch public key**: The JWKS client looks up the key by `kid` from Hydra's JWKS endpoint. Keys are cached for 10 minutes with up to 5 entries — this supports key rotation where old and new keys coexist temporarily
4. **Verify signature**: RS256 verification using the public key. If the signature doesn't match, the token is rejected
5. **Validate claims**: The `iss` (issuer) must match the configured Hydra URL. The `exp` (expiration) must be in the future. The algorithm must be RS256.
6. **DPoP validation** (if DPoP scheme): Additional verification that the DPoP proof matches the token's `cnf.jkt` claim — see [DPoP Token Binding](./DPOP-TOKEN-BINDING.md)
7. **Account check**: Even after JWT validation succeeds, the guard queries the database to check if the account is deactivated. This provides immediate revocation — a deactivated user's existing tokens are useless even if they haven't expired.
8. **Attach user**: The decoded JWT payload is attached to the request context for use by route handlers

### Token Verification (PostgREST)

PostgREST (the database API) also verifies JWTs, but it fetches the JWKS once at startup and stores it as a file. This means PostgREST doesn't support dynamic key rotation without a restart. A bootstrap script fetches the JWKS from Hydra and writes it to a file that PostgREST reads.

### Global Guard — Secure by Default

The auth guard is registered as a global guard. This means **every endpoint is protected by default**. Endpoints that should be publicly accessible must explicitly opt out using a `@Public()` decorator. This "secure by default" approach is significantly safer than the alternative (unprotected by default, must remember to add protection) because forgetting a decorator results in over-protection, not under-protection.

---

## Stateless Verification: The Strength and the Weakness

### The Strength

JWT verification is **stateless** — the API doesn't need to call Hydra or any external service to validate a token. It only needs the public key (cached locally). This means:
- Zero network latency for verification
- No dependency on Hydra availability for ongoing requests (only for key cache refresh)
- Each API server can verify independently — horizontal scaling is trivial
- No shared session store needed

### The Weakness: Token Revocation

Because verification is stateless, there's no way to "revoke" a JWT. Once issued, a JWT is valid until it expires. If a user's account is compromised and you want to immediately invalidate their tokens, you have a problem:

**What doesn't work**: You can't add the token to a "revocation list" that the API checks — that would make verification stateful, defeating the purpose of JWTs.

**What BookShare does instead**: The auth guard performs a database check for account deactivation on every request. This is technically stateful (it hits the database), but it's a lightweight query on an indexed column, and it only checks a boolean flag — not the token itself. This provides:
- Immediate revocation via account deactivation
- No need to maintain a token blocklist
- Minimal performance overhead (single indexed query per request)

**The tradeoff**: A deactivated account's tokens are still cryptographically valid — they would pass pure JWT verification. But BookShare's auth guard catches them at the application layer. If an attacker somehow bypasses the auth guard (e.g., talking directly to PostgREST with a valid JWT), the account deactivation check wouldn't apply. PostgREST relies purely on JWT expiration for revocation.

### JWTs vs. Opaque Tokens

An alternative to JWTs is **opaque tokens** — random strings that the API must exchange for claims by calling the authorization server (a "token introspection" endpoint).

| Aspect | JWT | Opaque Token |
|--------|-----|-------------|
| Verification | Local (public key) | Remote (introspection call) |
| Latency | Near-zero | Network round-trip per request |
| Revocation | Not possible (until expiry) | Instant (server-side) |
| Claims visibility | Readable by anyone (base64) | Only visible to auth server |
| Scalability | Excellent (no shared state) | Requires auth server availability |
| Token size | Larger (payload + signature) | Small (random string) |

BookShare chose JWTs for performance and independence. The account deactivation check provides a revocation mechanism that's "good enough" for most scenarios, and DPoP provides an additional layer that makes stolen tokens useless without the private key.

---

## JWKS Key Rotation

RS256 supports seamless key rotation without downtime:

1. Hydra generates a new key pair
2. The new public key is added to the JWKS endpoint (alongside the old one)
3. New tokens are signed with the new key (different `kid`)
4. Services fetching JWKS see both keys — old tokens verify with the old key, new tokens with the new key
5. After all old tokens expire, the old key is removed from JWKS

This happens transparently because the JWKS client looks up keys by `kid`. The NestJS API's JWKS cache refreshes every 10 minutes and holds up to 5 keys — enough for rotation transitions.

PostgREST, however, loads JWKS from a file at startup. It would need a restart (or a mechanism to reload the file) to pick up new keys. This is a gap worth addressing if key rotation is done frequently.

---

## JWT Payload Structure

BookShare's access tokens contain these claims:

| Claim | Purpose | Example |
|-------|---------|---------|
| `sub` | Subject — user ID (Kratos identity ID) | `"d4f5a2b1-..."` |
| `iss` | Issuer — Hydra's URL | `"http://localhost:4444"` |
| `aud` | Audience — intended recipient(s) | `["bookshare-web"]` |
| `exp` | Expiration — Unix timestamp | `1710460800` |
| `iat` | Issued At — Unix timestamp | `1710457200` |
| `email` | User's email | `"user@example.com"` |
| `name` | Full name | `"Jane Doe"` |
| `preferred_username` | Username | `"janedoe"` |
| `roles` | User roles | `["member"]` |
| `cnf.jkt` | DPoP key thumbprint | `"sha256-thumbprint"` |

Remember: all of these are **readable by anyone** who has the token. They are base64-encoded, not encrypted. This is fine for the claims listed — none are genuinely secret. The DPoP `cnf.jkt` is a public key thumbprint (already public by nature).

---

## How JWT Fits With Other Security Measures

| Threat | JWT's Role | Complementary Defense |
|--------|-----------|----------------------|
| Token forgery | RS256 signature prevents it | Algorithm restricted to RS256 only (no confusion attacks) |
| Token theft | JWT alone can't prevent this | DPoP binds tokens to a key the thief doesn't have |
| Token replay after expiry | `exp` claim enforced | N/A — built into JWT |
| Immediate revocation needed | JWT can't do this (stateless) | Account deactivation check in auth guard |
| Token from wrong issuer | `iss` claim validation | JWKS fetched only from configured Hydra URL |
| Claims tampering | Signature verification catches it | GCM authentication tag on encrypted cookie adds another layer |

---

## Recommendations

1. **Add `aud` (audience) validation**: The auth guard validates `iss` but does not explicitly validate `aud`. Adding audience validation ensures tokens issued for a hypothetical different client cannot be used against BookShare's API. This matters if Hydra ever serves multiple OAuth clients.

2. **Implement JWKS fallback for PostgREST**: PostgREST reads JWKS from a file at startup. If Hydra rotates keys and PostgREST isn't restarted, new tokens will fail verification. Consider a cron job or init container that periodically refreshes the JWKS file, or configure PostgREST to fetch JWKS directly if it supports it.

3. **Monitor token lifetimes**: Log the `exp - iat` delta on verified tokens. If access tokens are longer-lived than expected (e.g., hours instead of minutes), it may indicate a Hydra misconfiguration that increases the risk window for stolen tokens.

4. **Consider JWKS cache resilience**: If Hydra is temporarily unavailable when the NestJS API's JWKS cache expires (after 10 minutes), all token verification fails until Hydra recovers. A persistent JWKS cache (file-based, refreshed periodically, used as fallback) would provide resilience during Hydra outages.
