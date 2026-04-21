# CSRF Token Protection

## What Is CSRF?

Cross-Site Request Forgery (CSRF) is an attack where a malicious website tricks a user's browser into making an unwanted request to a different website where the user is authenticated. The browser automatically attaches session cookies to the request, making it appear legitimate.

**Example**: A user is logged into BookShare. They visit a malicious site that contains:
```html
<form action="https://bookshare.app/api/profiles/delete" method="POST">
  <input type="hidden" name="confirmation" value="DELETE" />
</form>
<script>document.forms[0].submit();</script>
```
The browser sends the request with the user's session cookie — the server sees a valid session and executes the deletion. The user never intended to submit that form. They were simply visiting another page.

The fundamental problem: **the browser cannot distinguish between a request the user intentionally made and one that a malicious page triggered on their behalf.** Cookies travel with requests regardless of which page initiated them.

---

## Attack Scenarios

### 1. Cross-Site Form Submission
A malicious page auto-submits a hidden form targeting BookShare. The browser attaches the user's BookShare cookies. The server has no way to know this wasn't a legitimate form submission from BookShare's own UI.

### 2. Authorization Code Injection (OAuth CSRF)
An attacker initiates their own OAuth flow, obtains an authorization code tied to their identity, then crafts a URL like `/api/auth/callback?code=attackers_code&state=attackers_state`. If the victim clicks it, the callback links the attacker's identity to the victim's session. The victim is now logged in as the attacker — and any data they add (books, addresses, payment info) goes to the attacker's account.

### 3. Login CSRF
Similar to code injection but simpler: an attacker auto-submits a login form with the attacker's credentials on behalf of the victim. The victim is now logged into the attacker's account without realizing it. Everything the victim does — adding books, updating their profile — is captured by the attacker.

### 4. Logout CSRF
A malicious page triggers a logout request, killing the user's session. While seemingly low-impact, it degrades trust and can be chained: force logout → redirect to a phishing login page → steal credentials.

### 5. Open Redirect Exploitation
An attacker manipulates the `returnTo` parameter: `/api/auth/login?returnTo=https://evil.com/phishing`. After legitimate authentication, the user is redirected to a phishing site that mimics BookShare's UI and captures further input.

---

## The Browser's Defense Landscape: SOP, CORS, and Their Limits

Before diving into BookShare's CSRF defenses, it's essential to understand the browser's built-in security model and why it is **insufficient on its own** to prevent CSRF.

### Same-Origin Policy (SOP)

The Same-Origin Policy is the browser's foundational security boundary. Two URLs share the same origin only when **all three** match: scheme (https), host (bookshare.app), and port (443).

#### What SOP Does Well

SOP restricts **reading** cross-origin responses. If `evil.com` sends a `fetch()` to `bookshare.app/api/profile`, SOP prevents `evil.com`'s JavaScript from reading the response body. This protects data confidentiality — `evil.com` cannot scrape your BookShare data, read your private book lists, or extract your profile information through JavaScript.

SOP also prevents cross-origin JavaScript from accessing:
- DOM contents of another origin's pages (no reading iframe contents)
- Cookies of another origin (JavaScript on `evil.com` cannot read `bookshare.app`'s cookies)
- LocalStorage/SessionStorage of another origin

#### Why SOP Fails Against CSRF

SOP's critical weakness is that it **only restricts reading responses, not sending requests**. The browser freely allows:

- **Form submissions**: `<form action="https://bookshare.app/api/delete" method="POST">` — the browser sends this POST with all of BookShare's cookies attached. SOP doesn't block it because forms predate SOP and are considered "simple" requests.
- **Image tags**: `<img src="https://bookshare.app/api/logout">` — triggers a GET request with cookies.
- **Script tags**: `<script src="https://bookshare.app/api/data">` — triggers a GET request with cookies.

SOP says: "You can send the request. You just can't read what comes back." But CSRF doesn't need to read the response. The damage is done by the server processing the forged request. When `evil.com` submits a form to delete your account, it doesn't matter that `evil.com` can't read the server's "account deleted" response — the account is already gone.

**SOP's design philosophy**: It was designed to protect **data confidentiality** (preventing cross-origin data theft), not **action integrity** (preventing cross-origin state changes). CSRF is fundamentally an action-integrity attack.

#### SOP Gaps Summary

| SOP Allows (Dangerous for CSRF) | SOP Blocks (Useful but Irrelevant for CSRF) |
|---|----|
| Cross-origin form submissions (GET + POST) | Reading cross-origin fetch/XHR responses |
| Cross-origin image/script/link requests | Accessing cross-origin DOM |
| Cross-origin navigations | Reading cross-origin cookies via JS |
| Cookies traveling with all of the above | Cross-origin localStorage access |

---

### CORS (Cross-Origin Resource Sharing)

CORS was designed to **selectively relax** SOP. When a server wants to allow specific origins to read its responses, it uses CORS headers. But CORS has also become a de facto CSRF defense for AJAX-based attacks — with significant caveats.

#### How CORS Works

When JavaScript on `evil.com` makes a `fetch()` to `bookshare.app/api/`:

1. **Simple requests** (GET, POST with form content types, HEAD — no custom headers): The browser sends the request immediately, with cookies if `credentials: "include"` is set. The server responds. The browser then checks the `Access-Control-Allow-Origin` response header. If it doesn't include `evil.com`, the browser **blocks JavaScript from reading the response** — but **the request was already sent and processed**.

2. **Preflighted requests** (PUT, DELETE, PATCH, or any request with custom headers like `Authorization` or `Content-Type: application/json`): The browser sends a preliminary `OPTIONS` request first. The server responds with allowed origins, methods, and headers. If `evil.com` isn't allowed, the browser **never sends the actual request**. This is genuine CSRF protection — for these specific request types.

#### CORS Strengths

**For API endpoints using JSON and custom headers, CORS provides strong CSRF protection.** BookShare's NestJS API receives requests with `Content-Type: application/json` and `Authorization: DPoP ...` headers. These trigger preflight checks. A cross-origin page cannot send these requests without the server's CORS policy explicitly allowing that origin.

BookShare's CORS configuration restricts the API to a single origin:
```typescript
app.enableCors({
  origin: process.env.CORS_ORIGIN || "http://localhost:3334",
  credentials: true,
});
```

This means **only** `http://localhost:3334` (the web app) can make credentialed AJAX requests to the API. Any other origin's fetch/XHR is blocked at the preflight stage for non-simple requests, or has its response blocked for simple requests.

#### CORS Weaknesses

1. **Simple requests still go through**: A cross-origin `<form>` POST with `Content-Type: application/x-www-form-urlencoded` is a "simple request." The browser sends it without preflight, with cookies attached. CORS only blocks the response from being read — but the server already processed the form. This is the classic CSRF hole that CORS cannot close.

2. **CORS is an opt-in relaxation, not a restriction**: CORS was designed to let servers open up, not lock down. A misconfigured `Access-Control-Allow-Origin: *` combined with `Access-Control-Allow-Credentials: true` (which browsers actually reject — but developers sometimes try) would defeat the protection entirely.

3. **CORS doesn't protect GET endpoints**: GET requests are always "simple." If a GET endpoint has side effects (like `/api/logout` or `/api/toggle-setting?value=off`), CORS provides zero protection. An `<img src="...">` tag triggers the GET with cookies.

4. **CORS is browser-enforced only**: A `curl` command, a mobile app, or a compromised browser ignores CORS entirely. It's not a server-side defense — it relies on the browser cooperating.

5. **Origin header can be absent**: Some browser features (bookmarks, URL bar typing, certain redirects) don't include an `Origin` header. A server relying solely on origin checking has edge cases.

#### CORS Gaps Summary

| CORS Protects Against | CORS Does NOT Protect Against |
|---|---|
| Cross-origin fetch/XHR to JSON APIs (preflight blocks it) | Cross-origin form submissions (no preflight) |
| Custom-header requests from unauthorized origins | Image/script/link-triggered GET requests |
| Reading API responses from unauthorized origins | Any server-side tool (curl, postman, scripts) |
| | GET endpoints with side effects |

---

### Why Neither SOP nor CORS Is Sufficient Alone

Consider this attack against a hypothetical BookShare with only SOP + CORS protection:

```html
<!-- On evil.com -->
<form action="https://bookshare.app/api/auth/login" method="POST"
      enctype="application/x-www-form-urlencoded">
  <input type="hidden" name="email" value="attacker@evil.com" />
  <input type="hidden" name="password" value="attackerpassword" />
</form>
<script>document.forms[0].submit();</script>
```

1. **SOP**: Allows the form submission (forms are "simple requests")
2. **CORS**: No preflight because `application/x-www-form-urlencoded` is a simple content type
3. **Result**: The victim's browser submits the login form. The server processes it. The victim is now logged in as the attacker.

The browser only blocks `evil.com` from reading the response. The damage (login CSRF) is already done.

**This is why CSRF tokens, SameSite cookies, and other mechanisms exist** — to fill the gap that SOP and CORS leave open for form-based and simple-request attacks.

---

## How XSS Defeats the CSRF Double-Submit Cookie Strategy

The double-submit cookie pattern is a widely used CSRF defense. Understanding how XSS breaks it reveals why defense-in-depth matters.

### How Double-Submit Cookie Works (Normal Case)

1. Server generates a random CSRF token
2. Token is set as a cookie: `Set-Cookie: csrf_token=abc123`
3. Token is also embedded in the HTML form: `<input type="hidden" name="csrf_token" value="abc123">`
4. When the user submits the form, the browser sends both:
   - The cookie (`Cookie: csrf_token=abc123`) — automatic
   - The form field (`csrf_token=abc123`) — in the POST body
5. Server compares the two values. If they match → legitimate request.

**Why this stops CSRF**: An attacker on `evil.com` can trigger a form submission to `bookshare.app`. The browser will automatically attach the `csrf_token` cookie. BUT the attacker cannot read that cookie's value (SOP prevents it), so they cannot include the matching value in the hidden form field. The two values won't match → request rejected.

### How XSS Destroys This

XSS (Cross-Site Scripting) means an attacker can execute arbitrary JavaScript **within the application's origin**. This changes everything because the malicious script now has the same privileges as the legitimate application code.

#### Step-by-Step XSS Attack on Double-Submit Cookies

**Step 1: Read the CSRF cookie**

If the CSRF cookie is NOT httpOnly (common in many implementations because the JavaScript needs to read it to include it in AJAX requests):
```javascript
// Attacker's XSS payload
const csrfToken = document.cookie
  .split('; ')
  .find(c => c.startsWith('csrf_token='))
  .split('=')[1];
```

The attacker now has the exact token value. SOP doesn't help because the script is running on the same origin.

**Step 2: Craft and submit a forged request with the matching token**
```javascript
// XSS payload continues
fetch('/api/profiles/delete', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    confirmation: 'DELETE',
    csrf_token: csrfToken  // Matches the cookie perfectly
  })
});
```

The server sees: cookie token matches form token → request appears legitimate → account deleted.

#### But what if the CSRF cookie IS httpOnly?

httpOnly prevents `document.cookie` from seeing the value. This is better, but XSS still wins:

**Technique 1: Extract token from the DOM**

The CSRF token is embedded in the current page's form as a hidden field:
```javascript
const csrfToken = document.querySelector('input[name="csrf_token"]').value;
```

httpOnly protects the cookie, but the same token value is sitting in the DOM, readable by any script.

**Technique 2: Fetch a fresh page and extract the token**

Even if the attacker's XSS runs on a page without a form:
```javascript
// Fetch any page that contains a CSRF token
const response = await fetch('/settings');
const html = await response.text();
const parser = new DOMParser();
const doc = parser.parseFromString(html, 'text/html');
const csrfToken = doc.querySelector('input[name="csrf_token"]').value;

// Now use it
fetch('/api/profiles/delete', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ confirmation: 'DELETE', csrf_token: csrfToken })
});
```

This works because the XSS script is same-origin — it can fetch any page and read the response.

**Technique 3: Let the browser handle it**

The XSS payload can simply create and submit a form programmatically:
```javascript
const settingsPage = await fetch('/settings');
const html = await settingsPage.text();
// Parse out the CSRF token, create a form, submit it
// Or even simpler — inject an iframe with the form page and submit it
```

#### Why This Matters Conceptually

The double-submit cookie pattern relies on one assumption: **the attacker cannot read values from the target origin**. SOP enforces this for cross-origin attackers. But XSS operates within the origin. It is a same-origin attacker. Every defense that depends on "the attacker can't read this" fails against XSS, because XSS can read everything the legitimate application can read.

This is why XSS is considered more severe than CSRF. CSRF is a confused-deputy attack (trick the browser into acting for you). XSS is an impersonation attack (become the application itself). An XSS vulnerability effectively nullifies:
- CSRF tokens (double-submit, synchronizer token, all patterns)
- SameSite cookies (the script is same-site)
- CORS restrictions (the script is same-origin)
- Any client-side security check

The only defenses that remain meaningful after XSS:
- **httpOnly cookies**: The attacker can't directly read the cookie value (though they can often work around this as shown above)
- **Server-side validation**: Rate limiting, confirmation steps, re-authentication for sensitive actions
- **DPoP token binding**: The attacker can execute API calls from the browser, but DPoP proofs are generated server-side (in Next.js route handlers), not in browser JavaScript. The XSS script would need to go through the Next.js proxy layer, which adds some friction.
- **Re-authentication walls**: Requiring the user's current password before destructive actions (account deletion, email change) — the XSS attacker doesn't know the password

---

## How BookShare Implements CSRF Protection

BookShare uses a **defense-in-depth** strategy — multiple layers that each address different attack vectors, so that no single failure is catastrophic.

### Layer 1: Kratos Per-Flow CSRF Tokens (Double-Submit Cookie Pattern)

**What it protects**: All identity flows — login, registration, recovery, settings — handled by the Kratos identity server.

**How it works**:
1. When a flow is created (e.g., user visits the login page), Kratos generates a random CSRF token
2. The token is stored in an httpOnly cookie (`csrf_token_*`)
3. The same token is included in the flow's JSON response
4. The Auth Portal renders it as a hidden form field
5. On form submission, the browser sends both the cookie and the form field
6. Kratos validates that the two values match

**Why it works against CSRF**: A cross-origin attacker can trigger a form submission, and the browser will attach the cookie. But the attacker cannot read the cookie value (httpOnly + SOP), so they cannot populate the hidden form field with the matching value. The mismatch causes Kratos to reject the request.

**Limitation**: As discussed above, this layer is defeated by XSS. If an attacker achieves script execution within the Auth Portal's origin, they can extract the token from the DOM and bypass this check. This is why additional layers exist.

---

### Layer 2: SameSite=Lax on All Cookies

**What it protects**: All cookie-based state across the entire application.

**How it works**: The `SameSite=Lax` attribute tells the browser:
- **Allow** cookies on top-level navigations (user clicks a link to BookShare from another site)
- **Block** cookies on cross-origin subrequests: form POSTs, AJAX calls, iframes, image loads triggered from other sites

**Why Lax and not Strict?**
`Strict` blocks cookies on ALL cross-origin navigations, including clicking a link to BookShare from an email or Google search. The user would land without their session cookie and be forced to log in again — terrible UX. `Lax` allows cookies on top-level GET navigations (the link-clicking case) but blocks them on cross-origin POST — the primary CSRF vector.

**Why Lax is not bulletproof**:
- **GET-based state changes**: If any endpoint performs state changes on GET requests, Lax doesn't help because top-level GET navigations still send cookies. This is why all state-changing operations in BookShare use POST/PUT/DELETE.
- **Subdomain attacks**: SameSite is based on the "site" (registrable domain), not the "origin." If an attacker controls a subdomain (e.g., `compromised.bookshare.app`), SameSite=Lax still sends cookies for requests from that subdomain. In BookShare's architecture, there's only one domain, so this isn't currently a concern.

---

### Layer 3: OAuth State Parameter (CSRF on the OAuth Flow)

**What it protects**: The authorization code exchange — prevents authorization code injection and session fixation during OAuth.

**How it works**:
1. At login initiation, a cryptographically random `state` value is generated
2. The state is encrypted with AES-256-GCM and stored in an httpOnly cookie
3. The same state is included as a query parameter in the authorization URL sent to Hydra
4. When Hydra redirects back with the authorization code, it includes the `state` in the callback URL
5. The callback handler decrypts the cookie and compares it to the URL parameter
6. If they don't match, the flow is rejected

**Why encryption instead of just httpOnly?** The state in the URL is visible (in browser history, server logs, referrer headers). If the cookie value were stored in plaintext, any cookie-reading vulnerability (browser extension, side-channel) would expose it. Encrypting the cookie value means even if both the URL state and the cookie are obtained, the cookie reveals only ciphertext that must match the URL value after decryption — an attacker who intercepts the state in transit can't forge the encrypted cookie value.

---

### Layer 4: Return-To URL Sanitization

**What it protects**: Prevents open redirect attacks that could redirect users to phishing pages after authentication.

The `returnTo` parameter tells the app where to send the user after login. Without validation, an attacker crafts `/api/auth/login?returnTo=https://evil.com/phishing`. After legitimate authentication, the user trusts the redirect because they just typed their real password.

**Validation rules**:
1. Must start with `/` (relative paths only — no absolute URLs to other domains)
2. Must not start with `//` (blocks protocol-relative URLs like `//evil.com` which browsers resolve to `https://evil.com`)
3. Must not start with `/api/auth` (prevents infinite redirect loops)
4. Falls back to `/browse` if any check fails

On the Auth Portal's logout handler, full URL parsing with an origin allowlist is used — only BookShare's own domains are accepted as valid redirect targets.

---

### Layer 5: httpOnly Cookie Flag

**What it protects**: Prevents JavaScript from accessing cookie values, making XSS cookie theft significantly harder.

Without httpOnly, any XSS payload could execute `document.cookie` and exfiltrate all session tokens in a single line. With httpOnly, the attacker must use indirect techniques (DOM extraction, page fetching) that are more complex and more detectable.

Every cookie in BookShare is set with `httpOnly: true`. This doesn't make XSS harmless, but it removes the most trivial exploitation path and forces attackers into noisier techniques.

---

### Layer 6: Cookie Encryption (AES-256-GCM)

All sensitive cookies (session data, access tokens, PKCE verifiers, OAuth state) are encrypted with AES-256-GCM before storage. Even if a cookie value is somehow obtained, it's ciphertext that requires the `SESSION_SECRET` to decrypt. See the [Cookie Encryption](./COOKIE-ENCRYPTION.md) document for the full analysis.

---

### Layer 7: CORS Restriction

The NestJS API restricts cross-origin requests to a single configured origin (the web app). This blocks all cross-origin AJAX/fetch attacks — any request from another origin with custom headers (like `Authorization` or `Content-Type: application/json`) triggers a preflight `OPTIONS` check, which fails for unauthorized origins.

As discussed above, CORS doesn't protect against form-based CSRF. But BookShare's API exclusively accepts `application/json` with custom headers — there's no form-based endpoint on the API. The combination of CORS + JSON-only makes the API immune to traditional CSRF.

---

### Layer 8: Token-Based API Authentication (Inherent CSRF Immunity)

The NestJS API and PostgREST both use JWT access tokens transmitted via the `Authorization` header, not session cookies. CSRF fundamentally exploits the browser's automatic cookie attachment. The `Authorization` header is never automatically attached — application code must explicitly set it. A cross-origin page cannot set this header on the victim's behalf (CORS preflight blocks it).

This is why the API doesn't need CSRF tokens at all. The authentication mechanism is inherently immune to CSRF by design.

---

## How the Layers Complement Each Other

No single layer is perfect. The defense-in-depth strategy means each layer covers the others' blind spots:

| Scenario | What Fails | What Still Protects |
|---|---|---|
| Attacker submits form from evil.com | SOP allows form POST | SameSite=Lax blocks cookies on cross-site POST; CSRF token mismatch |
| SameSite bypassed (subdomain attack) | SameSite=Lax | CSRF token mismatch (attacker can't read token from another subdomain's DOM) |
| XSS on Auth Portal | CSRF tokens (attacker reads from DOM) | SameSite still effective for cross-site, httpOnly blocks trivial cookie theft, re-authentication for destructive ops |
| XSS + CSRF token bypass | CSRF tokens | API uses token-based auth (not cookies), DPoP proofs generated server-side |
| Cookie stolen from logs | Cookie confidentiality | Cookie values are encrypted; useless without SESSION_SECRET |
| OAuth code intercepted | Code alone | PKCE requires code_verifier; state parameter prevents injection |
| Redirect manipulation | URL trust | Return-to sanitization with path-only and origin allowlists |

---

## Summary

| Layer | Mechanism | Protects Against | Defeated By |
|-------|-----------|-----------------|-------------|
| Kratos CSRF tokens | Double-submit cookie | Cross-site form submissions | XSS (same-origin script reads token from DOM) |
| SameSite=Lax | Browser cookie policy | Cross-site POST requests | GET-based state changes, subdomain attackers |
| OAuth state parameter | Encrypted nonce | Authorization code injection | XSS + cookie decryption (extremely difficult) |
| Return-to sanitization | URL validation + allowlist | Open redirect attacks | Nothing (server-side, XSS-independent) |
| httpOnly cookies | Browser cookie policy | Trivial XSS cookie theft | Advanced XSS techniques (DOM extraction) |
| Cookie encryption | AES-256-GCM | Cookie value interception | SESSION_SECRET compromise |
| CORS | Origin restriction | Cross-origin AJAX requests | Form-based submissions (but API is JSON-only) |
| Token-based API auth | Authorization header | All CSRF | Nothing (header is never auto-attached) |

---

## Recommendations

1. **Re-authentication for destructive operations**: The most resilient defense against XSS+CSRF combinations is requiring the user's current password before high-impact actions like account deletion, email change, and password change. BookShare already requires confirmation strings ("DELETE", "DEACTIVATE") and password verification for these operations — this is excellent and should be maintained for any future sensitive actions.

2. **Content Security Policy (CSP)**: Adding strict CSP headers would reduce XSS risk significantly, which in turn protects the CSRF token layer. A policy like `script-src 'self'` blocks inline scripts and scripts from other origins, making XSS exploitation much harder.

3. **Consider `SameSite=Strict` for the session cookie specifically**: While most cookies should remain Lax for UX, the session cookie could be Strict with a "session resumption" pattern — if the session cookie is missing on a top-level navigation, redirect through a same-site page that re-attaches it. This adds complexity but eliminates the Lax gap for the most sensitive cookie.

4. **Server-side `Origin`/`Referer` validation as a CORS backstop**: For defense-in-depth, the API could check the `Origin` header on all state-changing requests and reject any origin not in the allowlist. This provides server-side CSRF protection independent of browser CORS enforcement.
