# BookShare Security — Comprehensive Reference

> This document catalogs every security measure implemented in BookShare, explains what attack or risk each one prevents, shows how it works with real code references, and recommends future improvements. It covers authentication, authorization, database access, infrastructure, input validation, and secrets management.
>
> **Companion docs:**
> - [AUTH-SYSTEM-V2.md](./AUTH-SYSTEM-V2.md) — High-level auth architecture
> - [LOGIN-FLOW.md](./LOGIN-FLOW.md) — Login flow with real Kratos/Hydra traces
> - [REGISTRATION-FLOW.md](./REGISTRATION-FLOW.md) — Registration flow with real traces
> - [FORGOT-PASSWORD-FLOW.md](./FORGOT-PASSWORD-FLOW.md) — Password recovery flow with real traces

---

## Table of Contents

- [Security Architecture Overview](#security-architecture-overview)
- [Authentication Security](#authentication-security)
- [Authorization Security](#authorization-security)
- [Database Security](#database-security)
- [Infrastructure Security](#infrastructure-security)
- [Input Validation & Sanitization](#input-validation--sanitization)
- [CORS & Browser Security](#cors--browser-security)
- [Secrets Management](#secrets-management)
- [Anti-Enumeration & Privacy](#anti-enumeration--privacy)
- [Risks Mitigated — Summary Table](#risks-mitigated--summary-table)
- [Future Improvements](#future-improvements)
- [File Reference](#file-reference)

---

## Security Architecture Overview

```
                                    SECURITY BOUNDARIES

  Browser                 Web App (Next.js)         Auth Portal          Ory Services          NestJS API           Database
  ───────                 ─────────────────         ───────────          ────────────          ──────────           ────────

  ┌──────────┐     ①     ┌───────────────┐    ②    ┌──────────┐   ③   ┌──────────┐    ④     ┌──────────┐    ⑤   ┌────────┐
  │          │ ────────→  │  Middleware    │ ──────→ │  Kratos  │ ────→ │  Kratos  │         │          │ ──────→│        │
  │  User    │           │  + BFF Proxy  │         │  Flow UI │       │  + Hydra │         │  Auth    │        │ Postgres│
  │  Browser │ ←──────── │  + Session    │ ←────── │  + OAuth │ ←──── │  Engines │         │  Guard   │ ←──────│ + RLS   │
  │          │           │  Store        │         │  Bridge  │       │          │         │  + RBAC  │        │        │
  └──────────┘           └───────────────┘         └──────────┘       └──────────┘         └──────────┘        └────────┘

  ① Encrypted cookies     ② CSRF tokens            ③ HTTPS (prod)     ④ JWT + DPoP          ⑤ Parameterized
    httpOnly, secure,       Kratos CSRF                XChaCha20          RS256 + JWKS           queries
    sameSite=lax            per-flow tokens            Poly1305           DPoP proof             userScope()
    AES-256-GCM             return_to whitelist        bcrypt             11-step validation     Drizzle ORM
    DPoP-bound tokens                                  allowed_return     Account deactivation   PostgREST RLS
    PKCE state                                         _urls whitelist    check
```

### What Each Boundary Protects

| Boundary | Between | Primary Protection | Prevents |
|---|---|---|---|
| ① | Browser ↔ Web App | Encrypted cookies, DPoP binding, PKCE | Session hijacking, token theft, auth code interception |
| ② | Web App ↔ Auth Portal | CSRF tokens, return_to validation | Cross-site request forgery, open redirects |
| ③ | Auth Portal ↔ Ory Services | AEAD encryption, bcrypt, URL whitelist | Credential theft, data tampering, redirect attacks |
| ④ | Web App ↔ NestJS API | JWT verification, DPoP proof, RBAC | Forged tokens, stolen token replay, privilege escalation |
| ⑤ | API ↔ Database | Parameterized queries, tenant scope, RLS | SQL injection, cross-user data access (IDOR) |

---

## Authentication Security

### 1. Cookie Encryption (AES-256-GCM)

**File:** `apps/web/src/features/auth/lib/crypto.ts`

**What it does:** Every cookie containing sensitive data (session, tokens, PKCE state) is encrypted before being stored in the browser. The browser only sees opaque ciphertext.

**How it works:**

```
SESSION_SECRET (env var)
       │
       ▼
   HKDF-SHA-256 (salt: "bookshare-session-v1", info: "aes-256-gcm")
       │
       ▼
   256-bit AES key (cached in memory)
       │
       ▼
   AES-GCM encrypt(plaintext, random 12-byte IV)
       │
       ▼
   base64url(IV) + "." + base64url(ciphertext + auth tag)
```

**Implementation details:**
- **Algorithm:** AES-GCM with 256-bit keys (Web Crypto API, Edge Runtime compatible)
- **Key derivation:** HKDF with SHA-256 from `SESSION_SECRET`
- **IV:** 12 bytes, cryptographically random per encryption (via `crypto.getRandomValues`)
- **Output format:** `{base64url_iv}.{base64url_ciphertext_with_tag}`
- **Key caching:** Derived key cached in module scope for performance

> **💡 Tip: Why AES-GCM and not just HMAC signing?**
> HMAC signing (e.g., `cookie.sign()`) proves the cookie hasn't been tampered with, but the contents are still readable. AES-GCM provides both **confidentiality** (contents are unreadable) and **integrity** (contents can't be tampered with). This is important because session cookies contain access tokens, refresh tokens, and DPoP private keys — none of which should be visible to browser-side JavaScript or network observers.

> **💡 Tip: Why HKDF instead of using SESSION_SECRET directly?**
> Raw secrets may have low entropy distribution. HKDF (HMAC-based Key Derivation Function) extracts and expands the secret into a cryptographically strong key of exactly the right length. Even if the input secret is a simple passphrase, HKDF produces a uniformly random key.
>
> 📖 [RFC 5869: HKDF](https://datatracker.ietf.org/doc/html/rfc5869)

**Risk mitigated:** Session hijacking via cookie theft, cookie tampering, exposure of tokens to XSS

**Cookies encrypted:**
| Cookie | Contents | TTL |
|---|---|---|
| `bookshare_session` | Full session (tokens, DPoP key, user info) | 24 hours |
| `bookshare_token` | Access token only (for quick API access) | 24 hours |
| `oidc_code_verifier` | PKCE code verifier | 10 minutes |
| `oidc_state` | OAuth state parameter | 10 minutes |
| `oidc_return_to` | Post-login redirect path | 10 minutes |

---

### 2. DPoP Token Binding (RFC 9449)

**Files:** `apps/web/src/features/auth/lib/dpop.ts` (creation), `apps/api/src/common/guards/auth.guard.ts` (validation)

**What it does:** Binds OAuth access tokens to a cryptographic keypair so that a stolen token is useless without the corresponding private key.

**How it works:**

```
Token Exchange (callback)              Every API Request (BFF proxy)
─────────────────────────              ─────────────────────────────

1. Generate ES256 keypair              1. Load private key from session
2. Send public key to Hydra            2. Build DPoP proof JWT:
3. Hydra stamps token with                - jti: random UUID
   cnf.jkt = SHA-256(public key)          - htm: HTTP method
4. Store private key (JWK) in             - htu: request URL (no query)
   encrypted session cookie               - iat: current timestamp
                                          - ath: SHA-256(access_token)
                                       3. Sign with private key
                                       4. Send as DPoP header
```

**What the API validates (11 checks):**

| # | Check | Rejects |
|---|---|---|
| 1 | DPoP header present | Missing proof |
| 2 | JWT has 3 parts | Malformed proof |
| 3 | `typ` = `dpop+jwt` | Wrong token type |
| 4 | `jwk` present in header | No public key |
| 5 | Signature valid (ES256) | Forged proof |
| 6 | `htm` matches request method | Proof for wrong method (GET vs POST) |
| 7 | `htu` matches request URL | Proof for wrong endpoint |
| 8 | `iat` within 60 seconds | Replayed proof |
| 9 | `jti` present | Missing nonce |
| 10 | `ath` = SHA-256(access_token) | Proof for different token |
| 11 | `cnf.jkt` = SHA-256(proof public key) | Key mismatch — stolen token |

> **💡 Tip: How DPoP defeats token theft**
> If an attacker steals an access token (from logs, a proxy, or a compromised server), they cannot use it. The token contains `cnf.jkt` (the thumbprint of the legitimate client's public key). The API requires a DPoP proof signed by the matching private key. Without the private key (which is encrypted inside the session cookie on the legitimate server), the attacker cannot create a valid proof.
>
> 📖 [RFC 9449: DPoP](https://datatracker.ietf.org/doc/html/rfc9449)

**Risk mitigated:** Token theft, token replay, man-in-the-middle token extraction

---

### 3. PKCE (RFC 7636)

**File:** `apps/web/src/app/api/auth/login/route.ts`

**What it does:** Prevents authorization code interception attacks during the OAuth flow.

**How it works:**

```
Login initiation:                      Token exchange:
1. Generate random code_verifier       1. Send code_verifier with auth code
2. code_challenge = SHA-256(verifier)  2. Hydra computes SHA-256(verifier)
3. Send code_challenge to Hydra        3. Must match stored code_challenge
4. Encrypt code_verifier in cookie     4. If match → issue tokens
```

**Risk mitigated:** An attacker who intercepts the authorization code (e.g., via a malicious browser extension or redirect) cannot exchange it for tokens because they don't have the `code_verifier`.

> **💡 Tip: PKCE + DPoP together**
> PKCE protects the authorization code exchange (one-time event). DPoP protects every subsequent API call. Together they form a chain: PKCE ensures only the legitimate client gets tokens, DPoP ensures only the legitimate client can use those tokens.
>
> 📖 [RFC 7636: PKCE](https://datatracker.ietf.org/doc/html/rfc7636)

---

### 4. Session Cookie Security

**File:** `apps/web/src/features/auth/lib/session.ts`

**Cookie attributes applied to all auth cookies:**

| Attribute | Value | Protects Against |
|---|---|---|
| `httpOnly` | `true` | XSS — JavaScript cannot read the cookie via `document.cookie` |
| `secure` | `true` in production | MITM — cookie only sent over HTTPS |
| `sameSite` | `"lax"` | CSRF — cookie not sent on cross-origin POST requests |
| `path` | `"/"` | Scope — available to all routes on the domain |
| `maxAge` | `86400` (24h) for session, `600` (10min) for OIDC flow | Expiration — limits window of exposure |

> **💡 Tip: Why `sameSite=lax` instead of `strict`?**
> `strict` would block cookies on ALL cross-origin navigations, including clicking a link to BookShare from an email. The user would land on BookShare without their session cookie and be forced to log in again. `lax` allows cookies on top-level navigations (clicking links) but blocks them on cross-origin POST requests (the primary CSRF vector).
>
> 📖 [MDN: SameSite cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie#samesitesamesite-value)

---

### 5. OAuth State Parameter

**File:** `apps/web/src/app/api/auth/login/route.ts`

**What it does:** A random string generated at login initiation, encrypted in a cookie, and validated at callback. Prevents CSRF attacks during the OAuth flow.

**How it works:**
1. Generate `randomState()` at `/api/auth/login`
2. Encrypt and store in `oidc_state` cookie (10-min TTL)
3. Include in Hydra authorization URL as `&state={value}`
4. At callback, decrypt cookie and compare with `?state=` query parameter
5. Reject if they don't match

**Risk mitigated:** An attacker crafting a URL like `/api/auth/callback?code=stolen_code&state=attacker_state` would fail because the state doesn't match the encrypted cookie.

---

### 6. Forced Re-Authentication

**File:** `apps/web/src/app/api/auth/login/route.ts`

```
&prompt=login&max_age=0
```

| Parameter | Effect |
|---|---|
| `prompt=login` | Tells Hydra to always present a login challenge, even if a remembered session exists |
| `max_age=0` | Tells Hydra the user must have authenticated within the last 0 seconds |

**Risk mitigated:** Session fixation — without these, Hydra could auto-accept based on a stale or compromised session. By forcing fresh authentication every time, we ensure the person at the keyboard is actually entering credentials.

---

### 7. Kratos Cryptographic Protections

**File:** `infra/ory/kratos/kratos.yml`

| Feature | Configuration | Purpose |
|---|---|---|
| Data encryption | `ciphers.algorithm: xchacha20-poly1305` | Encrypts sensitive identity data at rest (recovery addresses, verification tokens) |
| Password hashing | `hashers.algorithm: bcrypt`, `cost: 8` | One-way hashing of passwords — cannot be reversed even with database access |
| Cookie secrets | `secrets.cookie` | Signs Kratos session cookies to prevent tampering |
| Cipher secrets | `secrets.cipher` (32 chars) | Encryption key for XChaCha20-Poly1305 |

> **💡 Tip: XChaCha20-Poly1305 vs AES-GCM**
> Kratos uses XChaCha20-Poly1305 for data at rest (identity fields). The Web App uses AES-GCM for cookies. Both are AEAD (Authenticated Encryption with Associated Data) ciphers. XChaCha20-Poly1305 has a 24-byte nonce (vs 12-byte IV for AES-GCM), making random nonce generation safer against collisions. The choice is Kratos's default — we use AES-GCM for cookies because it's natively supported by the Web Crypto API.
>
> 📖 [Ory docs: Kratos secrets](https://www.ory.sh/docs/kratos/reference/configuration)

---

## Authorization Security

### 1. JWT Verification (RS256 + JWKS)

**File:** `apps/api/src/common/guards/auth.guard.ts`

**What it does:** Every API request (except `@Public()` routes) must include a valid JWT signed by Hydra.

**How verification works:**

```
Request arrives with Authorization header
       │
       ▼
   Extract token (Bearer or DPoP scheme)
       │
       ▼
   Fetch signing key from Hydra JWKS endpoint
   (cached: 5 keys, 10-minute TTL)
       │
       ▼
   Verify JWT signature (RS256 only)
       │
       ▼
   Validate issuer matches OIDC_ISSUER
       │
       ▼
   Check expiration (exp claim)
       │
       ▼
   If DPoP scheme → run 11-step DPoP validation
       │
       ▼
   Check account not deactivated (DB query)
       │
       ▼
   Map JWT claims to AuthenticatedUser
       │
       ▼
   Attach user to request context
```

**Key implementation choices:**

| Choice | Why |
|---|---|
| RS256 (asymmetric) | API verifies tokens without knowing Hydra's private key — no shared secret needed |
| JWKS caching (10 min) | Reduces latency — doesn't fetch keys on every request |
| Issuer validation | Rejects tokens from other OAuth servers |
| Algorithm restriction (`["RS256"]` only) | Prevents algorithm confusion attacks (e.g., `none` algorithm) |

> **💡 Tip: Algorithm confusion attacks**
> If the JWT library accepts multiple algorithms, an attacker could craft a token using the `none` algorithm (no signature) or the `HS256` algorithm (symmetric, using the public key as the secret). By restricting to `RS256`, the API only accepts asymmetric signatures from Hydra's private key.
>
> 📖 [JWT algorithm confusion](https://auth0.com/blog/critical-vulnerabilities-in-json-web-token-libraries/)

**Risk mitigated:** Forged tokens, expired token reuse, tokens from unauthorized issuers

---

### 2. Account Deactivation Check

**File:** `apps/api/src/common/guards/auth.guard.ts`

```ts
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

**Why this matters:** JWT tokens are valid until they expire. If an admin deactivates a user, their existing tokens are still cryptographically valid. This database check on every request ensures deactivated accounts are blocked immediately, not after token expiry.

**Risk mitigated:** Revoked/deactivated users continuing to access the system with unexpired tokens

---

### 3. Role-Based Access Control (RBAC)

**Files:** `apps/api/src/common/guards/roles.guard.ts`, `apps/api/src/common/decorators/roles.decorator.ts`

**How it works:**

```ts
// Controller
@Roles("admin")
@Get("admin/users")
getUsers() { ... }

// Guard checks
const requiredRoles = this.reflector.getAllAndOverride("roles", [handler, class]);
if (!requiredRoles) return true;  // No roles required = all authenticated users
return requiredRoles.some(role => user.roles.includes(role));
```

**Role extraction from JWT:**
- Primary: `payload.roles` (direct array)
- Fallback: `payload.realm_access.roles` (Keycloak-compatible)

**Risk mitigated:** Privilege escalation — a regular user cannot access admin endpoints

---

### 4. Public Route Opt-In

**File:** `apps/api/src/common/decorators/public.decorator.ts`

Routes are authenticated by default (global `AuthGuard`). To make a route public, it must be explicitly marked:

```ts
@Public()
@Get("health")
healthCheck() { ... }
```

**Risk mitigated:** Accidental exposure of sensitive endpoints — new routes are protected by default

---

### 5. BFF Proxy Pattern

**File:** `apps/web/src/app/api/nestjs/[...path]/route.ts`

The browser never talks directly to the NestJS API. All requests go through the Next.js BFF (Backend-for-Frontend) proxy:

```
Browser → Next.js BFF → NestJS API
```

**Security checks in the proxy:**
1. Session must exist (encrypted cookie decrypted)
2. Email must be verified
3. Session must not be expired
4. If DPoP-bound token: generates fresh DPoP proof for each proxied request
5. Falls back to Bearer if no DPoP key

**Why this matters:**
- The browser never sees the raw access token (it's inside the encrypted session cookie)
- DPoP proofs are generated server-side — the browser can't create them even with XSS
- The API's internal URL (`http://api:3333`) is never exposed to the browser

**Risk mitigated:** Direct API access from browser, token exposure via XSS, DPoP bypass

---

## Database Security

### 1. Tenant Isolation (User-Scoped Queries)

**File:** `apps/api/src/common/tenant/tenant-scope.ts`

**The pattern:** Every database query that accesses user-owned data includes a `userId` filter:

```ts
// tenant-scope.ts
export function userScope(column: PgColumn, userId: string): SQL {
  return eq(column, userId);
}

export function userAnd(column: PgColumn, userId: string, conditions: SQL[]): SQL {
  return and(eq(column, userId), ...conditions)!;
}
```

**How it's used across services:**

```ts
// copies.service.ts
const copy = await db.query.copies.findFirst({
  where: userAnd(copies.userId, userId, [eq(copies.id, copyId)]),
});

// collections.service.ts
const collection = await db.query.collections.findFirst({
  where: userAnd(collections.userId, userId, [eq(collections.id, id)]),
});
```

**Critical flow:** `userId` comes from the JWT (via `@CurrentUser("id")`), never from the request body or URL parameters. This means:
1. Token is verified by the auth guard
2. `sub` claim is extracted
3. Every query filters by that verified `sub`
4. A user can NEVER query another user's data

**Tables with user scoping:**
| Table | Scope Column | Enforced In |
|---|---|---|
| `copies` | `userId` | CopiesService |
| `copy_events` | `userId` | CopiesService |
| `collections` | `userId` | CollectionsService |
| `wishes` | `userId` | WishesService |
| `member_profiles` | `userId` (PK) | ProfilesService |
| `notifications` | `userId` | NotificationsController |

> **💡 Tip: This is application-level Row-Level Security (RLS)**
> Unlike PostgreSQL's built-in RLS (which enforces rules at the database engine level), this is enforced in the application layer via Drizzle ORM. The advantage is portability and testability. The downside is that a developer could forget to add `userScope()` to a new query. Code review is the defense against this.

**Risk mitigated:** Insecure Direct Object References (IDOR) — the #1 web application vulnerability. Without this, a user could access another user's books, copies, and collections by guessing or enumerating IDs.

---

### 2. SQL Injection Prevention (Drizzle ORM)

**All database operations use Drizzle's typed query builder:**

```ts
// Safe — parameterized automatically
await db.update(copies)
  .set({ status: toStatus })
  .where(and(eq(copies.id, id), eq(copies.userId, userId)));

// Never happens — no string interpolation
// db.execute(`UPDATE copies SET status = '${status}' WHERE id = '${id}'`)  ❌
```

Drizzle generates parameterized SQL with `$1`, `$2` placeholders. User input never appears in the SQL string.

**Risk mitigated:** SQL injection — the ability to execute arbitrary SQL by manipulating input values

---

### 3. PostgREST Row-Level Security

**File:** `infra/postgres/init.sql`

PostgREST provides a read-only REST API directly from PostgreSQL. It uses database roles and RLS for access control:

```sql
-- Role hierarchy
postgrest_authenticator (connects)
  ├── postgrest_anon (no default table access)
  └── postgrest_auth (SELECT on all tables)

-- RLS helper
CREATE FUNCTION current_user_id() RETURNS TEXT AS $$
  SELECT current_setting('request.jwt.claims', true)::json->>'sub';
$$ LANGUAGE sql STABLE;
```

**How it works:**
1. PostgREST validates the JWT from the `Authorization` header
2. The JWT's `role` claim determines which database role is used
3. `current_user_id()` extracts the `sub` claim for RLS policies
4. Anonymous users (`postgrest_anon`) have no default table access
5. Authenticated users (`postgrest_auth`) get SELECT only

**Risk mitigated:** Unauthorized data access through the read API, write operations through PostgREST

---

### 4. Immutable Audit Log

**Schema:** `packages/db/src/schema/copy-events.ts`

The `copy_events` table records every state change for every copy (acquired, lent, returned, etc.):

| Column | Purpose |
|---|---|
| `id` | UUID primary key |
| `userId` | Owner (tenant scope) |
| `copyId` | Which copy changed |
| `eventType` | What happened (acquired, lent, returned, lost, etc.) |
| `fromStatus` / `toStatus` | State transition |
| `performedBy` | Who performed the action (may differ from owner) |
| `notes` | Free-text context |
| `metadata` | JSONB for financial data (amount, currency) |
| `createdAt` | Immutable timestamp |

**Key security property:** There is no `updatedAt` column and no UPDATE operations. Events are append-only. Once recorded, an event cannot be modified or deleted.

**Risk mitigated:** Tampering with activity history, financial record manipulation

---

### 5. Schema Constraints

| Constraint | Example | Prevents |
|---|---|---|
| `NOT NULL` | `copies.userId`, `copies.status` | Missing required data |
| `ENUM types` | `copyCondition`, `copyStatus`, `copyShareType` | Invalid status values |
| `UNIQUE` | `memberProfiles.email`, `wishes (userId, bookId, active)` | Duplicate records |
| `FOREIGN KEY` | `copies.editionId → editions.id` | Orphaned references |
| `CASCADE DELETE` | `copies → copy_events` | Orphaned audit records |
| `DEFAULT` | `createdAt: defaultNow()` | Missing timestamps |

**Risk mitigated:** Data integrity violations, invalid application state

---

### 6. Soft Deletes

Member profiles use a `deactivatedAt` timestamp instead of hard deletes:

```ts
deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
```

**Why soft delete:** Hard deletion is irreversible and can cascade to destroy audit trails. Soft deletion preserves data for:
- Account recovery within a grace period
- Audit and compliance requirements
- Preventing accidental data loss

**Risk mitigated:** Premature irreversible data loss, compliance violations

---

## Infrastructure Security

### 1. Ory Kratos Security Configuration

**File:** `infra/ory/kratos/kratos.yml`

| Setting | Value | Security Effect |
|---|---|---|
| `ciphers.algorithm` | `xchacha20-poly1305` | AEAD encryption for identity data at rest |
| `hashers.algorithm` | `bcrypt` (cost: 8) | Password hashing (one-way, salted) |
| `allowed_return_urls` | 4 specific URLs | Prevents open redirect after auth flows |
| `privileged_session_max_age` | `15m` | Limits window for sensitive operations (password change) |
| `login.lifespan` | `10m` | Short-lived login flows (limits CSRF window) |
| `registration.lifespan` | `1h` | Longer for code verification via email |
| `recovery.use` | `code` | 6-digit code (not clickable link) for recovery |

**`allowed_return_urls` whitelist:**
```yaml
allowed_return_urls:
  - http://localhost:3337          # Auth Portal
  - http://localhost:3334          # Web App
  - http://localhost:3334/api/auth/login
  - http://localhost:3337/oauth/login
```

If an attacker crafts a flow with `return_to=https://evil.com`, Kratos rejects it because the URL is not in the whitelist.

**Risk mitigated:** Open redirect attacks, credential theft via redirect manipulation

---

### 2. Ory Hydra Security Configuration

**File:** `infra/ory/hydra/hydra.yml`

| Setting | Value | Security Effect |
|---|---|---|
| `strategies.access_token` | `jwt` | Tokens are self-contained JWTs (verifiable without calling Hydra) |
| `serve.cookies.same_site_mode` | `Lax` | CSRF protection for Hydra's own cookies |
| `oidc.subject_identifiers.supported_types` | `pairwise`, `public` | Privacy: different `sub` per client |
| `oidc.subject_identifiers.pairwise.salt` | dev secret | Must be unique per deployment |

**OAuth client configuration** (`infra/ory/hydra/init-client.sh`):

| Setting | Value | Security Effect |
|---|---|---|
| `token_endpoint_auth_method` | `none` | Public client (browser app, no client secret) |
| `grant_types` | `authorization_code`, `refresh_token` | No implicit grant (less secure) |
| `response_types` | `code`, `id_token` | Authorization code flow only |
| `redirect_uris` | Single allowed callback URL | Prevents redirect manipulation |

> **💡 Tip: Why `token_endpoint_auth_method: none`?**
> BookShare's Web App is a public client (the Next.js server acts as BFF, but the OAuth flow originates from browser redirects). Public clients cannot securely store a client secret. Instead, PKCE replaces the client secret — the `code_verifier` proves the token exchange was initiated by the same party that started the authorization request.

**Risk mitigated:** Token forgery, implicit grant vulnerabilities, redirect attacks

---

### 3. Docker Network Isolation

**Files:** `docker-compose.dev.yml`, `docker-compose.prod.yml`

**Development:**
- All services communicate via Docker internal DNS (e.g., `postgres:5432`, `kratos:4433`)
- Ports exposed to host for development convenience
- No resource limits

**Production:**
- Nginx reverse proxy on port 80 is the only public entry point
- Internal services not exposed to host
- Memory limits enforced:

| Service | Memory Limit |
|---|---|
| PostgreSQL | 512 MB |
| NestJS API | 512 MB |
| Next.js Web | 256 MB |
| Workflows | 256 MB |
| MinIO | 256 MB |
| PostgREST | 128 MB |
| Nginx | 128 MB |

- All services set to `restart: always`

**Risk mitigated:** Unauthorized direct access to internal services, denial of service via memory exhaustion

---

### 4. Nginx Reverse Proxy

**File:** `infra/nginx/nginx.conf`

**Routing:**

| Path | Upstream | Purpose |
|---|---|---|
| `/api/*` | NestJS API (port 3333) | Write API |
| `/rest/*` | PostgREST (port 3000) | Read API (rewrites `/rest/` prefix) |
| `/*` | Next.js Web (port 3334) | Frontend |

**Headers forwarded:**
- `X-Real-IP` — original client IP
- `X-Forwarded-For` — proxy chain
- `X-Forwarded-Proto` — original protocol (HTTP/HTTPS)
- `Authorization` — passed through for PostgREST JWT-based RLS

**WebSocket support:** `Upgrade` and `Connection` headers passed for real-time features.

**Risk mitigated:** Direct access to internal service ports, missing client IP information

---

## Input Validation & Sanitization

### 1. Global Validation Pipeline

**File:** `apps/api/src/main.ts`

```ts
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,              // Strip unknown properties
    forbidNonWhitelisted: true,   // Reject requests with unknown properties
    transform: true,              // Auto-transform types
  })
);
```

| Setting | Effect | Prevents |
|---|---|---|
| `whitelist` | Removes properties not in the DTO | Mass assignment (adding `isAdmin: true` to a profile update) |
| `forbidNonWhitelisted` | Returns 400 if unknown properties are sent | Alerting developers to incorrect payloads |
| `transform` | Converts string "123" to number 123 based on DTO types | Type confusion attacks |

**DTO validation decorators used:**

```ts
// Example: UpdateCopyStatusDto
@IsEnum(CopyStatus)       // Must be a valid enum value
toStatus: CopyStatus;

@IsOptional()
@IsString()
@MaxLength(500)            // Bounded length
notes?: string;

@IsOptional()
@IsUUID()                  // Must be valid UUID format
counterpartyUserId?: string;
```

**Risk mitigated:** Mass assignment, type confusion, oversized inputs, invalid data injection

---

### 2. Return-To URL Sanitization (3 Layers)

**Layer 1 — Web App login** (`apps/web/src/features/auth/lib/auth-portal.ts`):

```ts
function sanitizeReturnTo(value: string | null | undefined): string {
  if (!value) return "/browse";
  if (!value.startsWith("/")) return "/browse";   // No absolute URLs
  if (value.startsWith("//")) return "/browse";    // No protocol-relative
  if (value.startsWith("/api/auth")) return "/browse"; // No auth loops
  return value;
}
```

**Layer 2 — Callback handler** (same function, applied after decrypting cookie)

**Layer 3 — Auth Portal logout** (`apps/auth/src/app/logout/route.ts`):

```ts
const allowedOrigins = new Set([
  new URL(fallback).origin,
  new URL(getAuthPortalPublicUrl()).origin,
]);
if (!allowedOrigins.has(parsed.origin)) return fallback;
```

| Layer | Technique | Blocks |
|---|---|---|
| 1 | Path-only check | `https://evil.com/steal`, `//evil.com` |
| 2 | Encrypted cookie | Tampering with return_to between login and callback |
| 3 | Origin whitelist | Post-logout redirect to malicious domains |

**Risk mitigated:** Open redirect attacks — tricking users into visiting malicious sites after authentication

---

### 3. File Upload Security

**File:** `apps/api/src/modules/upload/upload.service.ts`

**Five-layer defense:**

| Layer | Check | Rejects |
|---|---|---|
| 1. MIME type whitelist | `image/jpeg`, `image/png`, `image/webp` only | Executables, scripts, archives |
| 2. File size limit | 5 MB maximum | Large file DoS |
| 3. Filename sanitization | Lowercase, strip special chars, 120-char limit | Path traversal (`../../etc/passwd`), special char exploits |
| 4. User-scoped paths | `{directory}/{userId}/{timestamp}-{uuid}-{safeName}` | Cross-user file access |
| 5. Presigned URL constraints | `ContentType` + `ContentLength` in S3 presign | Bypassing type/size limits during upload |

```ts
// Filename sanitization
private sanitizeFileName(fileName: string) {
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "_")  // Only safe characters
    .slice(-120);                     // Max 120 chars
}
```

> **💡 Tip: Why presigned URLs instead of direct uploads?**
> The API never receives the file bytes. Instead, it generates a time-limited S3 presigned URL (10-minute expiry) with constraints baked in. The browser uploads directly to MinIO using that URL. This means:
> 1. The API server doesn't consume memory/bandwidth for file uploads
> 2. The constraints (type, size) are enforced by S3, not just the application
> 3. The URL expires quickly, limiting the window for abuse

**Risk mitigated:** Malicious file upload, path traversal, denial of service via large files, type spoofing

---

### 4. Account Management Validation

**Password change:**
- Old and new password required and trimmed
- New password must differ from old
- Min 8 / max 200 characters (DTO validation)
- Actual change delegated to Kratos (not handled by API)

**Email normalization:**
```ts
const normalized = value.trim().toLowerCase();
```
Prevents duplicate accounts via case variation (`User@Email.com` vs `user@email.com`).

**Account deactivation/deletion:**
- Requires confirmation token: literal string `"DEACTIVATE"` or `"DELETE"`
- Prevents accidental clicks from triggering destructive actions

---

## CORS & Browser Security

### 1. CORS Configuration

**File:** `apps/api/src/main.ts`

```ts
app.enableCors({
  origin: process.env.CORS_ORIGIN || "http://localhost:3334",
  credentials: true,
});
```

| Setting | Value | Effect |
|---|---|---|
| `origin` | Single URL | Only the Web App can make cross-origin requests to the API |
| `credentials` | `true` | Cookies are included in requests (needed for auth) |

**What this blocks:** JavaScript on any other domain attempting to call the API receives a CORS error. This includes:
- Malicious sites trying to steal data via the user's session
- Third-party scripts injected via XSS on other sites

**Risk mitigated:** Cross-origin data theft

---

### 2. Kratos CSRF Protection

**How it works in every Kratos flow:**
1. Kratos sets a `csrf_token` cookie when a flow is created
2. The flow JSON includes a hidden `csrf_token` field
3. The Auth Portal renders this as a hidden form input
4. On submission, Kratos validates: cookie token matches form token
5. Different flow = different token (flows are independent)

> **💡 Tip: Why per-flow CSRF tokens?**
> Each Kratos flow (login, registration, recovery, settings) gets its own CSRF token tied to its flow ID. This means a CSRF token from a login flow cannot be used to attack a registration flow. The tokens are also tied to the browser session via the cookie — an attacker on a different machine can't reuse them.

**Risk mitigated:** Cross-site request forgery on identity operations (login, register, password change)

---

## Secrets Management

### 1. Fail-Fast Secret Validation

**File:** `apps/web/src/features/auth/lib/crypto.ts`

```ts
function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "SESSION_SECRET is not configured. Set it in .env and restart the web container."
    );
  }
  return secret;
}
```

**Similarly enforced for:**
- `OIDC_CLIENT_ID` — OIDC configuration
- `OIDC_ISSUER` — Auth guard
- `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` — Upload service (via `getOrThrow`)

**Why this matters:** Without fail-fast, the app would start successfully but fail on the first request, producing cryptic errors. Throwing at startup ensures misconfiguration is caught immediately during deployment.

---

### 2. Development vs. Production Secrets

**Clearly marked dev secrets (MUST be changed in production):**

| Location | Secret | Dev Value |
|---|---|---|
| `kratos.yml` | Cookie secret | `change-this-dev-cookie-secret` |
| `kratos.yml` | Cipher secret | `32-char-dev-secret-change-me-123` |
| `hydra.yml` | System secret | `change-this-dev-secret` |
| `hydra.yml` | Pairwise salt | `change-this-dev-salt` |
| `init.sql` | PostgREST password | `postgrest_dev` |
| `.env` | Database password | `bookshare_dev` |
| `.env` | MinIO password | `bookshare_dev` |

> **💡 Tip: The "change-this-dev-*" naming convention**
> By including "change-this-dev" in the secret value, it's immediately obvious in code review, deployment scripts, and config audits whether production is running with development secrets. Searching the deployed config for "change-this-dev" should return zero matches.

---

### 3. Environment Variable Isolation

Secrets are stored in `.env` files (not in `docker-compose.yml` or code). Docker Compose references them via variable substitution:

```yaml
environment:
  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
```

**Risk mitigated:** Accidental secret exposure in version control, config sharing

---

## Anti-Enumeration & Privacy

### 1. Account Enumeration Prevention

**Login errors:**
Kratos returns the same error for wrong email AND wrong password:
```json
{ "text": "The provided credentials are invalid, check for spelling mistakes..." }
```
An attacker cannot determine whether an email has an account.

**Recovery flow:**
Submitting a non-existent email still transitions to `sent_email` state with the same success message. No email is actually sent, but the user sees identical behavior.

**Registration:**
Submitting an already-registered email shows a generic error, not "this email is already registered."

**Risk mitigated:** User enumeration — discovering which emails have accounts (often a precursor to targeted attacks)

---

### 2. Pairwise Subject Identifiers

**File:** `infra/ory/hydra/hydra.yml`

```yaml
oidc:
  subject_identifiers:
    supported_types:
      - pairwise
      - public
    pairwise:
      salt: change-this-dev-salt
```

With pairwise subjects, Hydra generates a different `sub` claim for each OAuth client. If BookShare ever integrates with third-party services, they cannot correlate users across services using the subject identifier.

**Risk mitigated:** Cross-service user tracking

---

## Risks Mitigated — Summary Table

| Attack | Protection | Layer | Key File |
|---|---|---|---|
| **Session hijacking** | AES-256-GCM cookie encryption | Authentication | `crypto.ts` |
| **Token theft** | DPoP binding (RFC 9449) | Authentication | `dpop.ts`, `auth.guard.ts` |
| **Auth code interception** | PKCE (RFC 7636) | Authentication | `login/route.ts` |
| **XSS cookie theft** | httpOnly cookies | Authentication | `session.ts` |
| **CSRF on OAuth flow** | Encrypted state parameter | Authentication | `login/route.ts` |
| **CSRF on identity flows** | Per-flow CSRF tokens | Authentication | Kratos |
| **Cookie MITM** | `secure` flag (prod) | Authentication | `session.ts` |
| **Session fixation** | `prompt=login`, `max_age=0` | Authentication | `login/route.ts` |
| **Password database breach** | bcrypt hashing | Authentication | `kratos.yml` |
| **Identity data breach** | XChaCha20-Poly1305 | Authentication | `kratos.yml` |
| **Forged JWT tokens** | RS256 + JWKS verification | Authorization | `auth.guard.ts` |
| **Stolen token reuse** | DPoP proof validation (11 checks) | Authorization | `auth.guard.ts` |
| **Revoked user access** | Per-request deactivation check | Authorization | `auth.guard.ts` |
| **Privilege escalation** | RBAC guard | Authorization | `roles.guard.ts` |
| **Accidental route exposure** | Global auth + `@Public()` opt-in | Authorization | `auth.guard.ts` |
| **Direct API access** | BFF proxy pattern | Authorization | `[...path]/route.ts` |
| **IDOR (cross-user access)** | `userScope()` on all queries | Database | `tenant-scope.ts` |
| **SQL injection** | Drizzle ORM parameterized queries | Database | All services |
| **Unauthorized reads** | PostgREST RLS + role grants | Database | `init.sql` |
| **Audit tampering** | Immutable copy_events | Database | Schema |
| **Open redirect** | 3-layer return_to validation | Input | `auth-portal.ts`, `logout/route.ts` |
| **Malicious file upload** | MIME whitelist + size limit + sanitization | Input | `upload.service.ts` |
| **Mass assignment** | ValidationPipe whitelist | Input | `main.ts` |
| **Cross-origin attacks** | Single-origin CORS | Browser | `main.ts` |
| **User enumeration** | Identical error messages | Privacy | Kratos |
| **Cross-service tracking** | Pairwise subject identifiers | Privacy | `hydra.yml` |

---

## Future Improvements

### Critical Priority

**1. Rate Limiting on Auth Endpoints**

**Current state:** No rate limiting exists on login, registration, recovery, or code submission endpoints.

**Risk:** Brute-force attacks on passwords, code guessing (6-digit codes have only 1M combinations), credential stuffing.

**Recommendation:** Add rate limiting at the nginx layer (simplest) or NestJS middleware:
- Login: 5 attempts per email per 15 minutes
- Recovery code: 5 attempts per flow
- Registration: 10 accounts per IP per hour
- Global: 100 requests per IP per minute

---

**2. Security Headers**

**Current state:** No CSP, HSTS, X-Frame-Options, or X-Content-Type-Options headers are set.

**Risk:** Clickjacking (iframe embedding), MIME sniffing attacks, missing HTTPS enforcement.

**Recommendation:** Add to nginx config or Next.js middleware:
```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'
Strict-Transport-Security: max-age=63072000; includeSubDomains
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

---

**3. Production Secret Rotation**

**Current state:** Dev secrets are clearly marked but no rotation mechanism exists.

**Risk:** Running production with dev secrets, or using the same secret indefinitely.

**Recommendation:**
- Generate unique secrets per environment during deployment
- Document minimum secret lengths (SESSION_SECRET: 32+ chars, Kratos cipher: exactly 32 chars)
- Increase bcrypt cost to 12+ for production (cost 8 is ~40ms; cost 12 is ~250ms — still acceptable for login)
- Implement secret rotation procedure (Kratos supports multiple cookie secrets for rolling rotation)

---

### High Priority

**4. DPoP Nonce Replay Prevention**

**Current state:** DPoP `jti` (JWT ID) is checked for presence but not for uniqueness. The same proof could theoretically be replayed within the 60-second `iat` tolerance window.

**Risk:** Proof replay within the tolerance window.

**Recommendation:** Add an in-memory cache (or Redis) of seen `jti` values with a 60-second TTL. Reject any `jti` that appears twice.

---

**5. TLS/HTTPS in Production**

**Current state:** All URLs use `http://localhost` (development). Nginx listens on port 80 only.

**Risk:** All traffic (including tokens, cookies, credentials) transmitted in plaintext.

**Recommendation:** Add TLS termination at nginx with Let's Encrypt certificates. Update all service URLs to HTTPS. The `secure` cookie flag is already conditional on `NODE_ENV === "production"`.

---

**6. Disable Swagger in Production**

**Current state:** Swagger docs are always available at `/api/docs`.

**Risk:** API documentation exposes endpoint structure, parameter names, and response schemas to attackers.

**Recommendation:** Gate Swagger setup behind an environment check:
```ts
if (process.env.NODE_ENV !== "production") {
  SwaggerModule.setup("api/docs", app, document);
}
```

---

### Medium Priority

**7. Sliding Session Expiration**

**Current state:** Fixed 24-hour session TTL. No refresh mechanism.

**Risk:** Users are logged out after exactly 24 hours regardless of activity. Or, a stolen session is valid for the full 24 hours.

**Recommendation:** Implement refresh token rotation — shorter access token TTL (1 hour), automatic refresh via the BFF proxy, and sliding session cookie expiration on activity.

---

**8. Security Audit Logging**

**Current state:** No structured logging of auth events.

**Risk:** Cannot investigate security incidents (who logged in, when, from where; who failed login attempts).

**Recommendation:** Log the following events with structured format:
- Successful login (userId, IP, timestamp)
- Failed login attempt (email, IP, timestamp)
- DPoP validation failures
- Account deactivation/reactivation
- Password changes
- Token refresh events

---

**9. Random HKDF Salt**

**Current state:** HKDF salt is hardcoded: `"bookshare-session-v1"`.

**Risk:** All deployments using the same `SESSION_SECRET` will derive the same encryption key.

**Recommendation:** Generate a random salt per deployment and store it alongside the `SESSION_SECRET`. Or include the deployment identifier in the salt.

---

**10. Stricter CORS Configuration**

**Current state:** Single origin, all methods and headers allowed.

**Recommendation:** Restrict to specific methods and headers:
```ts
app.enableCors({
  origin: allowedOrigins,
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization", "DPoP"],
  credentials: true,
});
```

---

### Low Priority

**11. Request ID Tracing**

Add a unique request ID (`X-Request-Id`) to every request/response for correlating logs during incident investigation.

---

**12. Cookie Path Scoping**

Restrict session cookies to specific paths (e.g., `/api/auth` for OIDC cookies) to reduce cookie exposure surface.

---

**13. Subresource Integrity (SRI)**

Add integrity attributes to external script/style tags to prevent CDN compromise.

---

## File Reference

| File | Security Domain | What It Does |
|---|---|---|
| `apps/web/src/features/auth/lib/crypto.ts` | Authentication | AES-256-GCM cookie encryption |
| `apps/web/src/features/auth/lib/dpop.ts` | Authentication | DPoP keypair generation + proof creation |
| `apps/web/src/features/auth/lib/session.ts` | Authentication | Encrypted session cookie management |
| `apps/web/src/features/auth/lib/oidc.ts` | Authentication | OIDC client configuration |
| `apps/web/src/features/auth/lib/auth-portal.ts` | Input Validation | URL sanitization + return_to validation |
| `apps/web/src/middleware.ts` | Authentication | Protected route enforcement |
| `apps/web/src/app/api/auth/login/route.ts` | Authentication | PKCE + state + encrypted cookies |
| `apps/web/src/app/api/auth/callback/route.ts` | Authentication | Token exchange + DPoP + session creation |
| `apps/web/src/app/api/auth/logout/route.ts` | Authentication | Three-session logout |
| `apps/web/src/app/api/nestjs/[...path]/route.ts` | Authorization | BFF proxy with DPoP proof generation |
| `apps/api/src/main.ts` | Authorization | CORS, ValidationPipe, Swagger |
| `apps/api/src/common/guards/auth.guard.ts` | Authorization | JWT verification + DPoP validation |
| `apps/api/src/common/guards/roles.guard.ts` | Authorization | Role-based access control |
| `apps/api/src/common/decorators/public.decorator.ts` | Authorization | Public route opt-in |
| `apps/api/src/common/decorators/current-user.decorator.ts` | Authorization | Authenticated user injection |
| `apps/api/src/common/tenant/tenant-scope.ts` | Database | User-scoped query helpers |
| `apps/api/src/modules/upload/upload.service.ts` | Input Validation | File upload security |
| `packages/db/src/schema/` | Database | Schema constraints, enums, relations |
| `infra/ory/kratos/kratos.yml` | Infrastructure | Kratos crypto, flows, allowed URLs |
| `infra/ory/hydra/hydra.yml` | Infrastructure | Hydra token strategy, cookies, subjects |
| `infra/ory/hydra/init-client.sh` | Infrastructure | OAuth client configuration |
| `infra/nginx/nginx.conf` | Infrastructure | Reverse proxy, header forwarding |
| `infra/postgres/init.sql` | Database | PostgREST RLS, role grants |
| `docker-compose.dev.yml` | Infrastructure | Dev service configuration |
| `docker-compose.prod.yml` | Infrastructure | Prod resource limits, isolation |
