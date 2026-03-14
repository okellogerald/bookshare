# DPoP Token Binding (Demonstration of Proof-of-Possession)

## What Is DPoP?

DPoP (defined in RFC 9449) is a mechanism that binds access tokens to a specific cryptographic keypair. Unlike bearer tokens (where anyone who possesses the token can use it), a DPoP-bound token requires proof that the presenter holds the private key that the token was bound to at issuance.

Think of it as the difference between cash (bearer — whoever holds it can spend it) and a credit card with a PIN (proof-of-possession — you need both the card and the PIN).

---

## Attack Scenarios That DPoP Addresses

### 1. Token Theft and Replay
**The core threat**: Bearer tokens are like cash — if stolen, anyone can use them. Tokens can be stolen through:
- XSS attacks extracting tokens from JavaScript-accessible storage
- Server-side logging that accidentally records Authorization headers
- Network interception on misconfigured HTTPS
- Compromised proxy servers that log request headers
- Memory dumps from compromised servers

**Without DPoP**: Stolen bearer token = full API access until expiration.
**With DPoP**: Stolen token is useless without the private key. The attacker must also create a valid DPoP proof signed by the bound key — which requires the private key that never left the web app's encrypted session.

### 2. Token Exfiltration via Log Files
**The threat**: Access tokens often appear in server logs, monitoring systems, or error tracking tools. A log aggregation service breach could expose thousands of active tokens.

**Without DPoP**: Every logged token is immediately usable.
**With DPoP**: Logged tokens are DPoP-bound (`cnf.jkt` claim). Without the corresponding private key, they cannot be used against any endpoint that validates DPoP.

### 3. Man-in-the-Middle Token Capture
**The threat**: A compromised proxy, CDN, or TLS-terminating load balancer captures the access token from the Authorization header.

**Without DPoP**: The interceptor has a fully usable bearer token.
**With DPoP**: The interceptor has the token but not the DPoP proof's private key. They can see the proof but cannot generate a new one for a different request (different method, URL, or timestamp).

### 4. Token Injection / Substitution
**The threat**: An attacker obtains a valid token (through any means) and injects it into their own requests.

**Without DPoP**: If the token hasn't expired, the API accepts it.
**With DPoP**: The API requires a DPoP proof that:
- Is signed by the key matching the token's `cnf.jkt` claim
- Matches the current HTTP method (`htm`) and URL (`htu`)
- Has a recent timestamp (`iat` within 60 seconds)
- Has a fresh nonce (`jti`)
- Has an access token hash (`ath`) matching the presented token

The attacker cannot produce this proof without the private key.

### 5. Cross-Service Token Abuse
**The threat**: A token obtained for one service/endpoint is used against a different endpoint.

**Without DPoP**: If the token's scope and audience allow it, it works everywhere.
**With DPoP**: Each DPoP proof is bound to a specific HTTP method and URL (`htm` + `htu`). A proof created for `GET /api/books` is invalid for `DELETE /api/copies/123`.

### 6. Token Replay Within Time Window
**The threat**: An attacker captures both the token and a valid DPoP proof, then replays the exact same request.

**DPoP mitigation**: The `iat` (issued-at) claim has a 60-second tolerance window. After 60 seconds, the proof is rejected. Combined with the `jti` (unique nonce), duplicate proofs within the window could be detected by a server-side nonce cache (not currently implemented but possible as a future enhancement).

---

## How DPoP Works (Conceptually)

```
Traditional Bearer Token:
  Client → Server: Authorization: Bearer {token}
  Server: Is the token valid? YES → allow

DPoP-Bound Token:
  Client → Server: Authorization: DPoP {token}
                   DPoP: {proof_jwt}
  Server: Is the token valid? YES
          Does the proof match the token? YES
          Is the proof fresh? YES
          Does the proof match this request? YES → allow

The proof_jwt is:
  Header: { typ: "dpop+jwt", alg: "ES256", jwk: {public_key} }
  Payload: {
    jti: "unique-id",           // Prevents replay
    htm: "GET",                 // Bound to HTTP method
    htu: "https://api.example/books",  // Bound to URL
    iat: 1234567890,            // Timestamp (freshness)
    ath: "hash(access_token)"   // Bound to specific token
  }
  Signature: ES256(header.payload, private_key)
```

---

## How BookShare Implements DPoP

### Phase 1: Key Generation (Token Exchange)

**File**: `apps/web/src/features/auth/lib/dpop.ts` (lines 10-12)

```typescript
export async function generateDPoPKeyPair(): Promise<CryptoKeyPair> {
  return client.randomDPoPKeyPair("ES256", { extractable: true });
}
```

- Algorithm: **ECDSA with P-256 curve** (ES256)
- The `extractable: true` flag allows the private key to be exported as JWK for session storage
- Generated using `openid-client`'s secure random key generation

**File**: `apps/web/src/app/api/auth/callback/route.ts` (lines 62-63)

```typescript
const dpopKeyPair = await generateDPoPKeyPair();
const dpopHandle = client.getDPoPHandle(config, dpopKeyPair);
```

The keypair is generated during the OAuth callback, just before the token exchange.

### Phase 2: Token Exchange with DPoP

**File**: `apps/web/src/app/api/auth/callback/route.ts` (lines 66-76)

```typescript
const tokens = await client.authorizationCodeGrant(
  config,
  currentUrl,
  {
    pkceCodeVerifier: codeVerifier,
    expectedState,
    idTokenExpected: true,
  },
  undefined,
  { DPoP: dpopHandle }  // DPoP binding during token exchange
);
```

The `openid-client` library:
1. Creates a DPoP proof for the token endpoint request
2. Sends it in the `DPoP` header alongside the token exchange
3. Hydra receives the proof, extracts the public key, computes its SHA-256 thumbprint
4. Hydra embeds this thumbprint as `cnf.jkt` in the issued access token

The resulting access token contains:
```json
{
  "sub": "user-id",
  "iss": "http://localhost:4444",
  "cnf": {
    "jkt": "sha256-thumbprint-of-dpop-public-key"
  }
}
```

### Phase 3: Private Key Persistence

**File**: `apps/web/src/app/api/auth/callback/route.ts` (lines 108-122)

```typescript
const accessTokenIsDpopBound =
  !!tokens.access_token && tokenHasDpopBinding(tokens.access_token);

const dpopJwk = accessTokenIsDpopBound
  ? await exportPrivateKeyJwk(dpopKeyPair)
  : undefined;

await setSession({
  idToken: tokens.id_token,
  expiresAt: claims.exp ?? Math.floor(Date.now() / 1000) + 3600,
  dpopJwk,  // Private key stored in encrypted session cookie
  user: { ... },
}, tokens.access_token);
```

The private key (as JWK, including the `d` component) is stored inside the encrypted `bookshare_session` cookie. This means:
- The private key is protected by AES-256-GCM encryption at rest
- It's only accessible server-side (httpOnly cookie)
- It's bound to the `SESSION_SECRET`

### Phase 4: DPoP Proof Creation (Per-Request)

**File**: `apps/web/src/features/auth/lib/dpop.ts` (lines 98-154)

```typescript
export async function createDPoPProof(
  privateJwk: JsonWebKey,
  httpMethod: string,
  httpUri: string,
  accessToken: string
): Promise<string> {
  const { privateKey } = await importKeyPairFromJwk(privateJwk);
  const publicJwk = getPublicJwk(privateJwk);

  // Compute access token hash: base64url(SHA-256(access_token))
  const tokenBytes = new TextEncoder().encode(accessToken);
  const hashBuffer = await crypto.subtle.digest("SHA-256", tokenBytes);
  const ath = toBase64Url(hashBuffer);

  // Strip query/fragment from URI per RFC 9449 Section 4.2
  const url = new URL(httpUri);
  const htu = `${url.protocol}//${url.host}${url.pathname}`;

  const header = {
    typ: "dpop+jwt",
    alg: "ES256",
    jwk: publicJwk,  // Public key embedded in header
  };

  const payload = {
    jti: crypto.randomUUID(),           // Unique nonce
    htm: httpMethod.toUpperCase(),       // HTTP method
    htu,                                 // HTTP URI (no query/fragment)
    iat: Math.floor(Date.now() / 1000),  // Current timestamp
    ath,                                 // Access token hash
  };

  // Sign with ES256 (ECDSA P-256)
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signatureBuffer = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    new TextEncoder().encode(signingInput)
  );

  return `${encodedHeader}.${encodedPayload}.${toBase64Url(signatureBuffer)}`;
}
```

A fresh DPoP proof is created for **every API request**. Each proof is unique due to:
- Fresh `jti` (UUID) — prevents replay
- Current `iat` — ensures freshness
- Request-specific `htm` + `htu` — binds to the specific endpoint
- Token-specific `ath` — binds to the specific access token

### Phase 5: Sending DPoP-Authenticated Requests

**File**: `apps/web/src/features/auth/lib/api-client.ts`

```typescript
export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  const session = await getSession();

  if (token) {
    const method = (options.method ?? "GET").toUpperCase();
    const fullUrl = `${API_URL}${path}`;

    if (session?.dpopJwk && tokenHasDpopBinding(token)) {
      const dpopProof = await createDPoPProof(session.dpopJwk, method, fullUrl, token);
      headers["Authorization"] = `DPoP ${token}`;  // DPoP scheme (not Bearer)
      headers["DPoP"] = dpopProof;                  // Proof in separate header
    } else {
      headers["Authorization"] = `Bearer ${token}`; // Fallback to Bearer
    }
  }

  return fetch(`${API_URL}${path}`, { ...options, headers });
}
```

**File**: `apps/web/src/app/api/nestjs/[...path]/route.ts` (lines 32-44)

Same pattern for the NestJS proxy route:
```typescript
if (session.dpopJwk && tokenHasDpopBinding(token)) {
  const dpopProof = await createDPoPProof(session.dpopJwk, request.method, url, token);
  headers["Authorization"] = `DPoP ${token}`;
  headers["DPoP"] = dpopProof;
} else {
  headers["Authorization"] = `Bearer ${token}`;
}
```

### Phase 6: Server-Side DPoP Validation

**File**: `apps/api/src/common/guards/auth.guard.ts` (lines 155-242)

```typescript
private async validateDPoP(
  request: any,
  accessToken: string,
  tokenPayload: IdentityJwtPayload
): Promise<void> {
  const dpopHeader = request.headers?.dpop;
  if (!dpopHeader) {
    throw new UnauthorizedException("Missing DPoP proof header");
  }

  // 1. Parse proof header and extract embedded JWK
  const proofHeader = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));

  if (proofHeader.typ !== "dpop+jwt") {
    throw new UnauthorizedException("DPoP proof typ must be dpop+jwt");
  }

  // 2. Import public key from proof and verify signature
  const publicKey = await importJWK(proofHeader.jwk, proofHeader.alg);
  const { payload: proofPayload } = await jwtVerify(dpopHeader, publicKey, {
    typ: "dpop+jwt",
  });

  // 3. Validate HTTP method
  if (proofPayload.htm !== httpMethod) {
    throw new UnauthorizedException("DPoP proof htm mismatch");
  }

  // 4. Validate HTTP URI (scheme + host + path, no query)
  const requestUrl = this.buildRequestUrl(request);
  if (proofPayload.htu !== requestUrl) {
    throw new UnauthorizedException("DPoP proof htu mismatch");
  }

  // 5. Validate freshness (within 60 seconds)
  const now = Math.floor(Date.now() / 1000);
  if (!iat || Math.abs(now - iat) > DPOP_IAT_TOLERANCE) {
    throw new UnauthorizedException("DPoP proof iat out of range");
  }

  // 6. Validate nonce presence
  if (!proofPayload.jti) {
    throw new UnauthorizedException("DPoP proof missing jti");
  }

  // 7. Validate access token hash
  const expectedAth = createHash("sha256").update(accessToken).digest("base64url");
  if (proofPayload.ath !== expectedAth) {
    throw new UnauthorizedException("DPoP proof ath mismatch");
  }

  // 8. Verify key binding (RFC 7638 JWK thumbprint)
  const proofKeyThumbprint = await calculateJwkThumbprint(proofHeader.jwk, "sha256");
  if (!tokenPayload.cnf?.jkt) {
    throw new UnauthorizedException("Access token missing cnf.jkt claim");
  }
  if (tokenPayload.cnf.jkt !== proofKeyThumbprint) {
    throw new UnauthorizedException("DPoP proof key thumbprint does not match cnf.jkt");
  }
}
```

The validation performs 8 checks:

| Check | Claim | Purpose |
|-------|-------|---------|
| 1. Proof format | `typ: "dpop+jwt"` | Ensures it's a DPoP proof, not another JWT |
| 2. Signature | ES256 verification | Proves possession of the private key |
| 3. HTTP method | `htm` vs request method | Prevents proof reuse across methods |
| 4. HTTP URI | `htu` vs request URL | Prevents proof reuse across endpoints |
| 5. Freshness | `iat` within 60s | Prevents replay of old proofs |
| 6. Nonce | `jti` present | Unique identifier for replay detection |
| 7. Token hash | `ath` vs SHA-256(token) | Binds proof to specific access token |
| 8. Key binding | `cnf.jkt` vs thumbprint | Ensures proof key matches token's bound key |

---

## Token Binding Check

**File**: `apps/web/src/features/auth/lib/dpop.ts` (lines 83-93)

```typescript
export function tokenHasDpopBinding(token: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return false;

  try {
    const payload = JSON.parse(fromBase64Url(parts[1]));
    return typeof payload.cnf?.jkt === "string" && payload.cnf.jkt.length > 0;
  } catch {
    return false;
  }
}
```

This function checks if an access token has a `cnf.jkt` claim, determining whether DPoP proofs should be used. If the token isn't DPoP-bound (e.g., due to Hydra configuration), the system falls back to Bearer authentication.

---

## Complete DPoP Data Flow

```
1. CALLBACK: Generate keypair
   ┌─────────────────────────────────────┐
   │  privateKey (P-256 ECDSA)           │
   │  publicKey (P-256 ECDSA)            │
   └─────────────────────────────────────┘
                    │
2. TOKEN EXCHANGE: Bind token to key
                    │
   Client ──────────┼──────────────────────> Hydra
   POST /oauth2/token                       │
   DPoP: {proof with embedded public key}   │
                                            ▼
                                   Compute thumbprint:
                                   SHA-256(canonicalize(publicKey))
                                            │
                                   Embed in token:
                                   { cnf: { jkt: thumbprint } }
                    │
   Client <─────────┼──────────────────────
   access_token (with cnf.jkt)
                    │
3. SESSION: Store private key encrypted
                    │
   bookshare_session = AES-GCM({
     dpopJwk: { kty, crv, x, y, d },  ← private key
     ...session data
   })
                    │
4. API REQUEST: Create fresh proof per request
                    │
   ┌────────────────┼────────────────────────────────┐
   │  DPoP Proof JWT:                                │
   │  Header: { typ: "dpop+jwt", alg: "ES256",      │
   │           jwk: { kty, crv, x, y } }  ← public  │
   │  Payload: {                                     │
   │    jti: "uuid",                                 │
   │    htm: "GET",                                  │
   │    htu: "http://api:3333/api/books",           │
   │    iat: 1234567890,                             │
   │    ath: base64url(SHA256(access_token))          │
   │  }                                              │
   │  Signature: ES256(privateKey)                   │
   └─────────────────────────────────────────────────┘
                    │
   Client ──────────┼──────────────────────> NestJS API
   Authorization: DPoP {access_token}
   DPoP: {proof_jwt}
                                            │
5. VALIDATION: 8-step verification          ▼
                                   1. Parse proof, check typ
                                   2. Verify ES256 signature
                                   3. Check htm matches method
                                   4. Check htu matches URL
                                   5. Check iat within 60s
                                   6. Check jti present
                                   7. Check ath matches token
                                   8. Check cnf.jkt matches key
                                            │
                                   ALL PASS → Allow request
```

---

## Parts of the System Touched

| Component | File(s) | Role |
|-----------|---------|------|
| **DPoP Module** | `apps/web/src/features/auth/lib/dpop.ts` | Key generation, export, proof creation, binding check |
| **Callback Route** | `apps/web/src/app/api/auth/callback/route.ts` | Generates keypair, binds during token exchange, stores key |
| **Session Manager** | `apps/web/src/features/auth/lib/session.ts` | Stores/retrieves encrypted DPoP private key |
| **API Client** | `apps/web/src/features/auth/lib/api-client.ts` | Creates DPoP proofs for server-side API calls |
| **NestJS Proxy** | `apps/web/src/app/api/nestjs/[...path]/route.ts` | Creates DPoP proofs for proxied requests |
| **Auth Guard** | `apps/api/src/common/guards/auth.guard.ts` | Validates DPoP proofs (8-step verification) |
| **Hydra** | OAuth token endpoint | Embeds `cnf.jkt` in access tokens during DPoP-bound issuance |

---

## Security Parameters

| Parameter | Value | Purpose |
|-----------|-------|---------|
| **Key Algorithm** | P-256 ECDSA (ES256) | DPoP proof signing |
| **Proof Type** | `dpop+jwt` | RFC 9449 type identifier |
| **Token Hash** | `ath = base64url(SHA-256(access_token))` | Binds proof to token |
| **Key Thumbprint** | `cnf.jkt = SHA-256(canonicalized JWK)` per RFC 7638 | Binds token to key |
| **Clock Tolerance** | 60 seconds | Maximum `iat` deviation |
| **Nonce** | UUID v4 (`jti`) | Replay prevention |
| **URI Normalization** | `scheme://host/path` (no query/fragment) | Per RFC 9449 Section 4.2 |
| **Private Key Storage** | AES-256-GCM encrypted cookie | At-rest protection |
| **Fallback** | Bearer scheme (no DPoP) | Graceful degradation |

---

## Dependencies

| Package | Version | Used In | Purpose |
|---------|---------|---------|---------|
| `openid-client` | ^6.8.2 | Web App | `randomDPoPKeyPair()`, `getDPoPHandle()` |
| `jose` | ^6.2.1 | NestJS API | `jwtVerify()`, `importJWK()`, `calculateJwkThumbprint()` |

---

## Recommendations

1. **Implement server-side nonce tracking**: Currently, the `jti` claim is validated for presence but not uniqueness. Adding a short-lived nonce cache (e.g., Redis with 60-second TTL matching the `iat` tolerance) would prevent exact proof replay within the tolerance window.

2. **Consider server-issued nonces**: RFC 9449 supports server-issued nonces via the `DPoP-Nonce` response header. This provides stronger replay protection than client-generated nonces, at the cost of an additional round-trip on nonce mismatch.

3. **Monitor DPoP validation failure rates**: A high rate of `htm`/`htu` mismatches could indicate request routing issues. A high rate of `iat` failures could indicate clock skew between services.

4. **Consider shorter clock tolerance**: The current 60-second tolerance is reasonable but could be tightened to 30 seconds if clock synchronization between the web app and API is reliable (both running in Docker with synchronized clocks).
