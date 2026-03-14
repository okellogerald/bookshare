# Cookie Encryption (AES-256-GCM)

## What Is Cookie Encryption?

Cookie encryption transforms sensitive cookie values into ciphertext using authenticated encryption before storing them in the browser. Even if cookies are intercepted, extracted from the browser, or leaked through a vulnerability, the actual values remain unreadable without the server-side encryption key.

BookShare uses **AES-256-GCM** (Advanced Encryption Standard with Galois/Counter Mode), an authenticated encryption algorithm that provides:
- **Confidentiality**: The data is unreadable without the key
- **Integrity**: Any tampering with the ciphertext is detected and rejected (the GCM authentication tag fails verification)

---

## Attack Scenarios That Cookie Encryption Addresses

### 1. Cookie Theft via XSS (Server-Side Rendering Bug)
If an XSS vulnerability exists and somehow bypasses the `httpOnly` flag (e.g., a server-side rendering bug that echoes cookie values into HTML, or a debug endpoint that dumps headers), the attacker obtains encrypted ciphertext instead of usable tokens.

Without encryption, a stolen `bookshare_token` cookie is a valid access token — immediate full API access. With encryption, the stolen value is an opaque AES-256-GCM blob that requires the `SESSION_SECRET` to decrypt.

### 2. Cookie Theft via Network Interception
In development environments or misconfigured production setups where HTTPS is not enforced, cookies travel in plaintext over the network. A man-in-the-middle captures them. Without encryption, intercepted cookies contain plaintext JWTs, session data, PKCE verifiers. With encryption, the attacker has ciphertext — useless without the server-side secret.

### 3. Cookie Theft via Malicious Browser Extension
Browser extensions with cookie permissions can read cookie values from the browser's cookie store. Some extensions can access httpOnly cookies through the browser's extension APIs (the `cookies` permission in Chrome/Firefox grants this). Without encryption, the extension exfiltrates plaintext tokens. With encryption, it exfiltrates ciphertext.

### 4. Session Hijacking via Cookie Manipulation
An attacker who can write to cookies (via XSS, subdomain cookie injection, or a browser extension) attempts to modify session data — changing user IDs, escalating privileges, injecting malicious values. Without encryption, a JWT can be base64-decoded, claims modified, and re-encoded (the signature check catches this, but only if the server validates signatures). With AES-GCM, any modification to the ciphertext — even a single bit flip — causes the authentication tag to fail. The server detects tampering and rejects the cookie entirely.

### 5. Information Leakage via Cookie Analysis
Even without stealing cookies directly, observing cookie patterns reveals information. A plaintext JWT cookie exposes its structure: you can see the header, decode the payload, observe user IDs, email addresses, role claims, token lifetimes. Encrypted cookies are opaque — different random IVs mean the same session data produces different ciphertext every time, revealing no patterns.

### 6. Cross-Subdomain Cookie Leakage
If cookies are accidentally scoped to the parent domain (`.bookshare.app` instead of `bookshare.app`), any subdomain can read them. Encrypted values leak nothing to a subdomain that doesn't have the `SESSION_SECRET`.

### 7. PKCE Code Verifier Protection
The PKCE `code_verifier` is stored in a cookie during the 10-minute OAuth flow window. This is the secret that binds the authorization code to the client that initiated the flow. If an attacker can read this cookie, they could combine it with an intercepted authorization code to complete a token exchange. Encrypting the verifier ensures that even if the cookie is extracted, the verifier remains protected.

---

## The Honest Answer: Does Encryption Bind Cookies to a Device?

**No. BookShare's cookie encryption does not factor in any device-specific or browser-specific information.** This is an important limitation to understand clearly.

### What Determines the Encryption Output

The encryption function takes exactly three inputs:
1. **The plaintext** (the data being encrypted — session JSON, access token, etc.)
2. **The derived encryption key** (derived from `SESSION_SECRET` via HKDF — identical across all servers, all users, all devices)
3. **A random IV** (12 bytes of cryptographic randomness — unique per encryption call, but not tied to any device)

That's it. There is no device fingerprint, no browser User-Agent, no IP address, no hardware identifier, no TLS channel binding baked into the encryption.

### What This Means Practically

If an attacker manages to extract the raw encrypted cookie blob from the browser's cookie store (through a malicious browser extension, physical device access, or a cookie-exfiltrating vulnerability), they can replay that exact blob from a completely different computer, a different browser, a different country — and the server will decrypt it successfully. The server sees a valid encrypted cookie, decrypts it, gets a valid session, and proceeds.

```
Scenario: Cookie Replay Attack

1. Victim's browser has cookie:
   bookshare_session = AES-GCM(session_data)   // encrypted blob

2. Attacker extracts this exact blob
   (via malicious extension, physical access, etc.)

3. Attacker sets the same cookie in their own browser:
   document.cookie = "bookshare_session=<stolen_blob>; path=/"

4. Attacker visits bookshare.app
   → Server decrypts the blob → valid session → attacker is logged in as victim
```

### Why This Isn't as Bad as It Sounds

Cookie encryption was never designed to prevent cookie replay. It has a different job — preventing cookie **reading** and **tampering**. The defense against cookie replay comes from other layers:

#### Defense 1: httpOnly Prevents JavaScript Cookie Theft
The cookies are httpOnly, so JavaScript (including XSS payloads) cannot read them via `document.cookie`. This eliminates the most common cookie theft vector. The attacker would need a browser extension with `cookies` permission or physical device access.

#### Defense 2: DPoP Token Binding (The Real Device Binding)
This is where BookShare's architecture provides what you're looking for — just not at the cookie encryption layer.

The session cookie contains an encrypted DPoP private key (`dpopJwk`). The access token (also in an encrypted cookie) has a `cnf.jkt` claim — a SHA-256 thumbprint of the corresponding public key. When the web app makes API requests, it:

1. Decrypts the session cookie to get the DPoP private key
2. Creates a fresh DPoP proof signed with that key
3. Sends the proof alongside the access token

The API verifies that the proof's public key thumbprint matches the token's `cnf.jkt`. This means: **stealing the access token alone is useless without the DPoP private key**, and the DPoP private key is buried inside the encrypted session cookie.

If an attacker steals ONLY the `bookshare_token` cookie (the access token), they still can't use it because they don't have the DPoP key to create proofs. They would need to steal BOTH cookies. And even then, they'd need the `SESSION_SECRET` to decrypt the session cookie and extract the DPoP key to generate proofs from a different environment.

However — if they steal both encrypted cookie blobs and replay them through a browser (where the Next.js server-side decrypts them and creates DPoP proofs automatically), the replay works. The DPoP binding protects the API layer but not the Next.js cookie layer itself.

#### Defense 3: Session Expiration
Sessions have a 24-hour lifetime. A stolen cookie blob becomes useless after expiration. The server checks `expiresAt` on every request.

#### Defense 4: Secure Flag in Production
In production, cookies are marked `Secure`, meaning they only travel over HTTPS. This prevents network interception but doesn't prevent browser-level extraction.

### Why Not Add Device Binding to Cookie Encryption?

Adding device-specific data (like IP address or User-Agent) to the encryption process is technically possible but creates significant problems:

**Approach 1: Include device info in the encrypted payload, validate on decryption**

You could encrypt `{ session_data, ip: "1.2.3.4", ua: "Chrome/120" }` and reject decryption if the current request's IP/UA doesn't match. Problems:
- **IP changes constantly**: Mobile users switch between WiFi and cellular. Corporate users go through rotating proxies. VPN users change exit nodes. You'd force frequent re-authentication for legitimate use.
- **User-Agent changes on browser updates**: A Chrome auto-update changes the UA string. Every user's session breaks simultaneously.
- **User-Agent is trivially spoofable**: If the attacker knows the victim's browser, they set the same UA. It's not a secret.

**Approach 2: Include device info in the encryption key derivation**

Derive the AES key from `HKDF(SESSION_SECRET + client_ip + user_agent)`. Each device gets a unique encryption key. A cookie encrypted for one device fails decryption on another. Problems:
- Same IP/UA instability issues as above
- The server must somehow know the device info at both encryption and decryption time, but HTTP requests can arrive through different network paths
- Breaks server-side rendering where the initial request might come from a different IP than subsequent API calls

**Approach 3: TLS Token Binding (the "right" way)**

The proper cryptographic solution to cookie replay is TLS Token Binding (RFC 8471), which binds cookies to the TLS channel's cryptographic parameters. A cookie bound to one TLS session is rejected in a different TLS session. Unfortunately, TLS Token Binding has been abandoned by browser vendors — Chrome removed support in 2020, and no major browser implements it.

**The practical reality**: The industry has moved toward **token-level binding** (DPoP, mTLS) rather than **cookie-level binding**. BookShare follows this approach — cookies are encrypted for confidentiality, and DPoP provides the possession-proof layer at the token level.

---

## How the Encryption Works

### Key Derivation

The process starts with the `SESSION_SECRET` environment variable. This secret could be any string — a high-entropy random value (ideal) or a human-chosen passphrase (less ideal). To convert it into a proper AES-256 key, BookShare uses HKDF (HMAC-based Key Derivation Function):

1. **Import**: The raw secret string is imported as HKDF key material
2. **Derive**: HKDF-SHA-256 stretches it into a uniform 256-bit key, using:
   - **Salt**: `"bookshare-session-v1"` — binds the key to this specific application version
   - **Info**: `"aes-256-gcm"` — binds the key to this specific algorithm
3. **Cache**: The derived key is cached in memory for the process lifetime (safe because the derivation is deterministic)

Why HKDF and not just using the secret directly? Raw secrets may have biased entropy (ASCII characters, predictable patterns). HKDF extracts and expands entropy into a uniformly distributed key. The salt and info parameters ensure that even if the same `SESSION_SECRET` is accidentally used for another purpose, the derived keys will differ.

### Encryption Process

For every piece of data that needs to be encrypted:

1. **Generate IV**: 12 bytes of cryptographic randomness via `crypto.getRandomValues()`. This IV is unique to this single encryption — it ensures that encrypting the same plaintext twice produces completely different ciphertext.

2. **Encrypt**: AES-256-GCM takes the key, IV, and plaintext, producing:
   - **Ciphertext**: The encrypted data (same length as plaintext)
   - **Authentication tag**: A 128-bit tag that acts as a cryptographic checksum. If anyone modifies even one bit of the ciphertext, IV, or associated data, this tag won't validate on decryption.

3. **Encode**: The IV and ciphertext+tag are Base64URL-encoded and joined with a dot: `{base64url(iv)}.{base64url(ciphertext+tag)}`

### Decryption Process

1. **Split**: The cookie value is split on the `.` separator into IV and ciphertext+tag
2. **Decode**: Both parts are Base64URL-decoded back to binary
3. **Decrypt**: AES-256-GCM decrypts using the same derived key and the provided IV
   - If the authentication tag doesn't match (tampered data, wrong key, corrupted cookie), the Web Crypto API throws — decryption fails
4. **Return**: The plaintext string is returned (typically JSON that gets parsed into a session object)

### Why the Random IV Matters

AES-GCM has a critical security requirement: **the same (key, IV) pair must never be used twice.** If it is, an attacker who observes two ciphertexts encrypted with the same (key, IV) can XOR them together to cancel out the keystream, revealing information about both plaintexts. The GCM authentication is also compromised, potentially allowing forgery.

BookShare generates a fresh random 12-byte IV for every encryption call. The probability of randomly generating the same IV twice is approximately 2^-96, which is negligibly small. Even after millions of encryptions, a collision is statistically impossible within the application's lifetime.

---

## What Gets Encrypted

### Encrypted Cookies

| Cookie | What It Contains | Lifetime |
|--------|-----------------|----------|
| `bookshare_session` | Full session: user ID, email, name, token expiration, DPoP private key | 24 hours |
| `bookshare_token` | The raw access token (RS256 JWT) | 24 hours |
| `oidc_code_verifier` | PKCE code verifier (128 random characters) | 10 minutes |
| `oidc_state` | OAuth state parameter (random string for CSRF prevention) | 10 minutes |
| `oidc_return_to` | Sanitized post-login redirect path (e.g., "/my-library") | 10 minutes |

### Non-Encrypted Cookies

| Cookie | What It Contains | Why Not Encrypted |
|--------|-----------------|-------------------|
| `bookshare_logged_out` | Just the string `"1"` | Non-sensitive flag. Knowing someone logged out reveals nothing exploitable. |
| `bookshare_register_flow` | Kratos flow UUID | Flow IDs are opaque identifiers with built-in server-side expiration. Knowing a flow ID doesn't grant any access — Kratos requires the user to complete the flow's steps. |
| `csrf_token_*` | Kratos CSRF tokens | Managed by Kratos directly, not by our encryption system. Kratos handles its own cookie security. |

### The Most Sensitive Encrypted Field

Inside the `bookshare_session` cookie, the `dpopJwk` field contains the **full ECDSA P-256 private key** (including the `d` parameter — the private scalar). If this leaked in plaintext, an attacker could:
1. Extract the private key
2. Create valid DPoP proofs for any HTTP method and URL
3. Use a stolen access token (which has the matching `cnf.jkt` thumbprint) to make authenticated API calls

This is why encryption is critical for the session cookie — it's not just session metadata, it's a cryptographic secret.

---

## Multi-Layer Cookie Security

Every encrypted cookie has multiple protection layers. No single layer is sufficient alone, but together they provide strong defense:

| Layer | What It Does | What It Stops | What It Doesn't Stop |
|-------|-------------|---------------|---------------------|
| **AES-256-GCM** | Encrypts + authenticates cookie values | Reading stolen cookies, tampering with cookies | Cookie blob replay (same ciphertext works from any device) |
| **httpOnly** | Blocks JavaScript `document.cookie` access | XSS-based cookie theft via JS | Browser extension cookie access, server-side leaks |
| **SameSite=Lax** | Blocks cookies on cross-origin POST/subrequests | CSRF attacks from other sites | Same-site attacks, top-level GET navigations |
| **Secure (prod)** | Restricts cookies to HTTPS only | Network interception (MITM) | Browser-level extraction (extensions, physical access) |
| **maxAge** | Auto-expires cookies | Stale cookie abuse long after session should have ended | Abuse within the validity window |
| **Path=/** | Scopes cookie to the application | Cross-path leakage on shared hosting | Nothing in BookShare's single-app setup |

---

## GCM Nonce (IV) Safety Analysis

AES-GCM's security collapses if the same (key, IV) pair is reused. This isn't a gradual degradation — it's a catastrophic failure. Two ciphertexts encrypted with the same (key, IV) allow an attacker to XOR them together, revealing the XOR of the two plaintexts. With enough ciphertexts, full plaintext recovery becomes feasible. The authentication guarantee also breaks, allowing ciphertext forgery.

BookShare mitigates this by:
1. **Fresh random 12-byte IV per encryption**: `crypto.getRandomValues(new Uint8Array(12))`
2. **Cryptographically secure PRNG**: Web Crypto's `getRandomValues()` is backed by the OS entropy pool
3. **Negligible collision probability**: With a 96-bit random IV, the birthday bound gives a ~50% collision probability at ~2^48 encryptions (approximately 281 trillion). BookShare's actual encryption volume is orders of magnitude below this.

For practical reference: if BookShare encrypted 1,000 cookies per second (far beyond realistic usage), it would take approximately 8.9 million years to reach a 50% chance of a single IV collision.

---

## Error Handling Philosophy

Decryption failures are handled silently. When a cookie fails to decrypt (wrong key, tampered data, corrupted value, format error), the system:
- Returns `null` from session retrieval functions
- Redirects the user to the login page
- Does **not** expose any error details to the client

This is deliberate. Detailed decryption error messages could reveal information about the encryption scheme to an attacker probing the system. A silent redirect to login is indistinguishable from a normal session expiration.

---

## Cryptographic Properties Summary

| Property | Value | Why This Choice |
|----------|-------|----------------|
| **Algorithm** | AES-256-GCM | NIST-approved AEAD cipher. Provides both confidentiality and integrity in a single operation. Widely audited, hardware-accelerated on modern CPUs. |
| **Key Length** | 256 bits | Provides 128-bit security level. Resistant to known quantum computing attacks on symmetric ciphers (Grover's algorithm halves the effective key length, so 256-bit → 128-bit post-quantum). |
| **IV Length** | 96 bits (12 bytes) | The recommended length for GCM. Longer IVs require an additional hashing step that slightly reduces security margins. |
| **Authentication Tag** | 128 bits | Built into GCM output. Provides 2^-128 forgery probability — computationally infeasible. |
| **Key Derivation** | HKDF-SHA-256 | Appropriate for deriving keys from secrets with sufficient entropy. Uses extract-then-expand paradigm. |
| **HKDF Salt** | `"bookshare-session-v1"` | Domain separation — ensures keys derived for this application differ from keys derived from the same secret for other purposes. |
| **HKDF Info** | `"aes-256-gcm"` | Algorithm separation — ensures keys derived for encryption differ from keys that might be derived for HMAC or other algorithms. |
| **Encoding** | Base64URL (RFC 4648) | URL-safe and cookie-safe. No `+`, `/`, or `=` characters that could cause parsing issues in cookie values. |

---

## Recommendations

### 1. Implement Device-Aware Session Validation (Not Encryption)
Rather than binding device info into encryption (which breaks with IP/UA changes), add a **soft validation layer**: record the IP range and coarse User-Agent at session creation, and flag (or require re-authentication) when these change drastically. For example, a session created from a US IP that suddenly appears from a Russian IP is suspicious — not proof of theft, but worth a challenge. This provides device-awareness without the fragility of baking it into encryption.

### 2. Consider Session ID + Server-Side Store
The current architecture stores all session data in the cookie (encrypted). An alternative is to store only a random session ID in the cookie and keep the actual session data server-side (Redis, database). This approach means:
- Cookie replay still works for the session ID, but the server can invalidate sessions explicitly (e.g., on password change, forced logout)
- Session data never leaves the server, even encrypted
- Session revocation is instant (delete the server-side record)
- Trade-off: requires a session store (additional infrastructure, latency per request)

### 3. Rotate SESSION_SECRET Periodically
Implement a mechanism to rotate the secret without invalidating all sessions. Support two secrets simultaneously (current + previous) during a transition window. Decrypt attempts first try the current key; on failure, try the previous key. New encryptions always use the current key.

### 4. Add Encryption Format Versioning
The current format (`iv.ciphertext`) has no version marker. If you ever need to change the algorithm (e.g., migrating to AES-256-GCM-SIV, or changing the HKDF parameters), there's no way to distinguish old-format cookies from new-format cookies. A version prefix like `v1.iv.ciphertext` would make migrations seamless.

### 5. Consider Argon2id Pre-Processing
HKDF is designed for secrets with sufficient entropy (e.g., a 256-bit random key). If the `SESSION_SECRET` could be a human-chosen passphrase (shorter, lower entropy), HKDF alone may not provide adequate key stretching. Adding Argon2id (a memory-hard password hashing function) as a pre-processing step before HKDF would protect against brute-force attacks on weak secrets. In practice, generate a high-entropy random `SESSION_SECRET` and this concern is eliminated.
