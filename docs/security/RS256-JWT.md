# RS256 JWT (JSON Web Token with RSA-SHA256)

## What Is RS256 JWT?

RS256 is an asymmetric signing algorithm for JSON Web Tokens that uses RSA with SHA-256. The authorization server (Hydra) signs tokens with a **private key**, and resource servers (NestJS API, PostgREST) verify tokens with the corresponding **public key**.

**Key distinction from symmetric algorithms (HS256)**:
- **HS256**: Uses a single shared secret for both signing and verification. Every service that needs to verify tokens must have the secret — a single compromise exposes everything.
- **RS256**: The private key (for signing) stays with the authorization server. Public keys (for verification) are freely distributed. Compromising a public key is harmless — it can only verify, not forge tokens.

---

## Attack Scenarios That RS256 JWT Addresses

### 1. Token Forgery
**The threat**: An attacker creates a fake JWT with arbitrary claims (e.g., admin role, different user ID) and sends it to the API.

**How RS256 prevents it**: Without Hydra's private key, it is computationally infeasible to produce a valid RS256 signature. The API verifies every token's signature against Hydra's public key — forged tokens are rejected instantly.

### 2. Algorithm Confusion Attack
**The threat**: An attacker changes the JWT header's `alg` from `RS256` to `HS256` and signs with the public key (which is freely available). If the server naively accepts the `alg` from the token, it would verify the HS256 signature using the public key as the shared secret.

**How BookShare prevents it**: The auth guard explicitly restricts algorithms to `["RS256"]` only:
```typescript
jwt.verify(token, signingKey, {
  issuer,
  algorithms: ["RS256"], // Only RS256 accepted
});
```
Any token with a different algorithm is rejected regardless of signature validity.

### 3. Key Confusion (Wrong Key)
**The threat**: An attacker issues tokens signed by a different key and attempts to trick the server into using the wrong public key for verification.

**How BookShare prevents it**: JWT headers contain a `kid` (Key ID) field. The JWKS client looks up the specific key by its `kid` from Hydra's published JWKS endpoint. Only keys published by Hydra at `/.well-known/jwks.json` are trusted.

### 4. Expired Token Replay
**The threat**: An attacker captures a valid token and replays it long after it should have expired.

**How BookShare prevents it**: The `jsonwebtoken` library automatically validates the `exp` (expiration) claim. Expired tokens are rejected without reaching application code.

### 5. Token Issued by Wrong Authority
**The threat**: An attacker sets up their own authorization server, issues valid RS256 JWTs, and sends them to the API.

**How BookShare prevents it**: The auth guard validates the `iss` (issuer) claim against the configured `OIDC_ISSUER`. Tokens from any other issuer are rejected:
```typescript
jwt.verify(token, signingKey, {
  issuer, // Must match OIDC_ISSUER config
  algorithms: ["RS256"],
});
```

### 6. Shared Secret Compromise (HS256 Problem)
**The threat with HS256**: If a shared secret is compromised (leaked in logs, config files, or via a vulnerability in any verifying service), an attacker can forge unlimited tokens.

**Why RS256 eliminates this**: Only Hydra holds the private key. The NestJS API, PostgREST, and any future services only need the public key — which is safe to expose. Even if every public key is leaked, no tokens can be forged.

### 7. Service-to-Service Token Validation Without Secret Sharing
**The challenge**: In a microservice architecture, every service needs to validate tokens. With HS256, the signing secret must be distributed to every service — increasing the attack surface.

**RS256 solution**: Services fetch public keys from the JWKS endpoint. No secret distribution required. Adding a new service only requires configuring the JWKS URI.

---

## How BookShare Implements RS256 JWT

### Token Issuance (Hydra)

**File**: `infra/ory/hydra/hydra.yml` (line 5)

```yaml
strategies:
  access_token: jwt
```

Hydra is configured to issue JWT access tokens (not opaque tokens). These are signed with RS256 using Hydra's internal key pair. Hydra publishes the public keys at `/.well-known/jwks.json`.

### Token Verification (NestJS API)

**File**: `apps/api/src/common/guards/auth.guard.ts`

#### JWKS Client Setup (lines 79-86)

```typescript
this.jwksClient = jwksClient({
  jwksUri,
  requestHeaders: issuerInternal === issuer ? undefined : { host: issuerHost },
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 600000, // 10 minutes
});
```

The JWKS client:
- Fetches public keys from Hydra's `/.well-known/jwks.json` endpoint
- Caches keys for 10 minutes (avoids hitting Hydra on every request)
- Stores up to 5 key entries (supports key rotation)
- Handles Docker networking by overriding the `host` header when internal URL differs from public URL

#### Token Verification (lines 259-282)

```typescript
private async verifyToken(token: string): Promise<IdentityJwtPayload> {
  const issuer = this.getIssuer();
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      (header, callback) => {
        this.jwksClient.getSigningKey(header.kid, (err, key) => {
          if (err) return callback(err);
          const signingKey = key?.getPublicKey();
          callback(null, signingKey);
        });
      },
      {
        issuer,
        algorithms: ["RS256"],
      },
      (err, decoded) => {
        if (err) return reject(err);
        resolve(decoded as IdentityJwtPayload);
      }
    );
  });
}
```

Verification steps:
1. Parse the JWT header to extract `kid` (Key ID)
2. Fetch the corresponding public key from JWKS (cached)
3. Verify the RS256 signature using the public key
4. Validate `iss` matches configured issuer
5. Validate `exp` (expiration) is not past
6. Return decoded payload with user claims

#### JWT Payload Structure (lines 24-44)

```typescript
interface IdentityJwtPayload {
  sub: string;           // User ID (Kratos identity ID)
  iss: string;           // Issuer (Hydra URL)
  aud: string[] | string; // Audience
  exp: number;           // Expiration timestamp
  iat: number;           // Issued-at timestamp
  email?: string;
  name?: string;
  preferred_username?: string;
  given_name?: string;
  family_name?: string;
  nickname?: string;
  gender?: string;
  roles?: string[];
  realm_access?: {
    roles?: string[];
  };
  cnf?: {
    jkt?: string;        // DPoP key thumbprint binding
  };
}
```

#### Auth Scheme Detection (lines 135-146)

```typescript
private extractTokenFromHeader(request: any): {
  scheme: "Bearer" | "DPoP";
  token: string | null;
} {
  const authorization = request.headers?.authorization;
  if (!authorization) return { scheme: "Bearer", token: null };

  const [type, token] = authorization.split(" ");
  if (type === "Bearer") return { scheme: "Bearer", token };
  if (type === "DPoP") return { scheme: "DPoP", token };
  return { scheme: "Bearer", token: null };
}
```

The guard supports both `Bearer` and `DPoP` authorization schemes. Both use RS256 JWT verification — DPoP adds an additional proof validation layer (see [DPoP Token Binding](./DPOP-TOKEN-BINDING.md)).

#### Post-Verification Account Check (lines 124-133)

```typescript
private async ensureActiveAccount(userId: string) {
  const profile = await this.db.query.memberProfiles.findFirst({
    columns: { deactivatedAt: true },
    where: eq(memberProfiles.userId, userId),
  });

  if (profile?.deactivatedAt) {
    throw new UnauthorizedException("Account is deactivated");
  }
}
```

Even after JWT validation succeeds, the guard checks if the account is deactivated. This ensures that revoking access is immediate — not dependent on token expiration.

---

### Token Verification (PostgREST)

**File**: `infra/postgrest/init-jwt.sh`

```bash
#!/bin/sh
target_file="${PGRST_JWT_SECRET_FILE:-/jwt/jwks.json}"
jwks_uri="${OIDC_JWKS_URI:-http://hydra:4444/.well-known/jwks.json}"

# Fetch JWKS from Hydra and store it for PostgREST
curl -fsS "$jwks_uri" > "$target_file"
```

**File**: `docker-compose.dev.yml` (PostgREST config)

```yaml
postgrest:
  environment:
    PGRST_JWT_SECRET: "@/jwt/jwks.json"
    PGRST_JWT_SECRET_IS_BASE64: "false"
```

PostgREST uses the same JWKS from Hydra for JWT verification, ensuring consistent authentication across both the NestJS API and the database API layer.

---

### Token Flow Through the System

```
Hydra (Token Issuer)
│
│  Signs JWT with RS256 private key
│  Publishes public keys at /.well-known/jwks.json
│
├──────────────────────────────────────────────────────────┐
│                                                          │
▼                                                          ▼
NestJS API (Resource Server)                    PostgREST (Database API)
│                                               │
│  1. Extract token from Authorization header   │  1. Extract token from header
│  2. Fetch public key from JWKS (cached)       │  2. Verify with stored JWKS
│  3. Verify RS256 signature                    │  3. Verify RS256 signature
│  4. Validate issuer, expiration               │  4. Apply row-level security
│  5. Validate DPoP proof (if DPoP scheme)      │
│  6. Check account deactivation                │
│  7. Attach user to request context            │
```

---

## JWKS Key Rotation

RS256 supports seamless key rotation:

1. Hydra generates a new key pair and adds the public key to JWKS
2. New tokens are signed with the new key (different `kid`)
3. The JWKS endpoint now publishes both old and new public keys
4. Existing tokens (signed with old key) continue to verify until they expire
5. After all old tokens expire, the old key can be removed from JWKS

The NestJS API handles this automatically because:
- It looks up keys by `kid` from the JWT header
- The JWKS cache refreshes every 10 minutes
- Up to 5 keys are cached simultaneously

---

## Global Guard Registration

**File**: `apps/api/src/app.module.ts` (lines 39-42)

```typescript
providers: [
  { provide: APP_GUARD, useClass: AuthGuard },
  { provide: APP_GUARD, useClass: RolesGuard },
]
```

The auth guard is registered globally — every API endpoint is protected by default. Endpoints that should be public must explicitly opt out with the `@Public()` decorator:

```typescript
export const IS_PUBLIC_KEY = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

---

## Parts of the System Touched

| Component | File(s) | Role |
|-----------|---------|------|
| **Hydra** | `infra/ory/hydra/hydra.yml` | Issues RS256 JWTs, publishes JWKS |
| **NestJS Auth Guard** | `apps/api/src/common/guards/auth.guard.ts` | Verifies RS256 signatures, validates claims |
| **JWKS Client** | `jwks-rsa` library | Fetches and caches public keys |
| **PostgREST Init** | `infra/postgrest/init-jwt.sh` | Bootstraps PostgREST with Hydra's JWKS |
| **PostgREST** | Docker Compose config | Verifies JWTs for database API access |
| **Web App Callback** | `apps/web/src/app/api/auth/callback/route.ts` | Receives and stores RS256 JWTs |
| **API Client** | `apps/web/src/features/auth/lib/api-client.ts` | Sends JWTs to API |
| **NestJS Proxy** | `apps/web/src/app/api/nestjs/[...path]/route.ts` | Proxies JWTs to NestJS |
| **PostgREST Proxy** | `apps/web/src/app/api/postgrest/[...path]/route.ts` | Proxies JWTs to PostgREST |

---

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `jsonwebtoken` | ^9.0.3 | RS256 JWT verification in NestJS |
| `jwks-rsa` | ^3.2.2 | JWKS client for fetching public keys |
| `jose` | ^6.2.1 | DPoP proof verification (ES256) |
| `openid-client` | ^6.8.2 | OIDC client for token exchange |

---

## Recommendations

1. **Add `aud` (audience) validation**: The auth guard validates `iss` but does not explicitly validate `aud`. Adding audience validation ensures tokens issued for one service cannot be used against another.

2. **Monitor JWKS cache hit rate**: If the cache miss rate is high, increase `cacheMaxAge` or `cacheMaxEntries`. Frequent JWKS fetches add latency and create a dependency on Hydra availability.

3. **Implement JWKS fallback**: If Hydra is temporarily unavailable, the JWKS cache will eventually expire and all token verification will fail. Consider a persistent JWKS cache (file-based) as a fallback.

4. **Token lifetime monitoring**: Log token `exp - iat` values to ensure access tokens have appropriate lifetimes. Too long increases the window for token abuse; too short causes excessive refresh cycles.
