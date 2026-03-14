# BookShare Authentication System

> This is the primary reference for understanding how authentication works in BookShare. It explains every concept, every decision, and every moving part at a level where a newcomer can read it top-to-bottom and understand the full picture.
>
> For step-by-step technical traces with real request/response data, see the companion docs:
> - [REGISTRATION-FLOW.md](./REGISTRATION-FLOW.md) — Complete registration walkthrough with live Kratos traces
> - [LOGIN-FLOW.md](./LOGIN-FLOW.md) — Complete login walkthrough with live Kratos traces
> - [FORGOT-PASSWORD-FLOW.md](./FORGOT-PASSWORD-FLOW.md) — Complete password recovery walkthrough with live Kratos traces
> - [SECURITY.md](./SECURITY.md) — Comprehensive security reference: all protections, risks mitigated, future improvements
> - [kratos-deep-dive.md](./kratos-deep-dive.md) — Kratos internals, UI rendering, component architecture
> - [kratos-registration-traces.md](./kratos-registration-traces.md) — Raw registration API traces with SQLite rows
> - [kratos-login-traces.md](./kratos-login-traces.md) — Raw login API traces with SQLite rows
> - [kratos-recovery-traces.md](./kratos-recovery-traces.md) — Raw recovery API traces with SQLite rows

---

## Table of Contents

- [BookShare Authentication System](#bookshare-authentication-system)
  - [Table of Contents](#table-of-contents)
  - [The Big Picture](#the-big-picture)
  - [Why Two Systems (Kratos + Hydra)?](#why-two-systems-kratos--hydra)
  - [Key Concepts \& Glossary](#key-concepts--glossary)
    - [Kratos Concepts](#kratos-concepts)
    - [Hydra Concepts](#hydra-concepts)
  - [Architecture](#architecture)
    - [Services \& Ports](#services--ports)
  - [How Kratos Works](#how-kratos-works)
    - [The Flow Lifecycle](#the-flow-lifecycle)
    - [Flow Types](#flow-types)
    - [How Kratos Tracks State](#how-kratos-tracks-state)
    - [What Kratos Returns (and Why)](#what-kratos-returns-and-why)
    - [Sessions and `/sessions/whoami`](#sessions-and-sessionswhoami)
    - [Identity Schema](#identity-schema)
  - [How Hydra Works](#how-hydra-works)
    - [The Challenge Flow](#the-challenge-flow)
    - [What Hydra Issues](#what-hydra-issues)
  - [How the Auth Portal Bridges Them](#how-the-auth-portal-bridges-them)
    - [Role 1: Kratos UI](#role-1-kratos-ui)
    - [Role 2: Hydra Challenge Handler](#role-2-hydra-challenge-handler)
  - [Cookie Strategy](#cookie-strategy)
    - [By Domain](#by-domain)
  - [Cookie Encryption (AES-256-GCM)](#cookie-encryption-aes-256-gcm)
    - [Why Encrypt?](#why-encrypt)
    - [How It Works](#how-it-works)
    - [What's Inside `bookshare_session`](#whats-inside-bookshare_session)
  - [DPoP Token Binding (RFC 9449)](#dpop-token-binding-rfc-9449)
    - [The Problem It Solves](#the-problem-it-solves)
    - [How DPoP Fixes This](#how-dpop-fixes-this)
    - [DPoP Proof Structure](#dpop-proof-structure)
  - [Flow Overview: Registration](#flow-overview-registration)
    - [Summary](#summary)
  - [Flow Overview: Login](#flow-overview-login)
    - [Summary](#summary-1)
  - [Flow Overview: Logout](#flow-overview-logout)
    - [Summary](#summary-2)
  - [Flow Overview: Password Recovery](#flow-overview-password-recovery)
    - [Summary](#summary-3)
  - [Flow Overview: Email Verification](#flow-overview-email-verification)
    - [Triggers](#triggers)
  - [Flow Overview: Account Settings](#flow-overview-account-settings)
    - [Summary](#summary-4)
  - [API Authentication Guard](#api-authentication-guard)
    - [Verification Steps](#verification-steps)
  - [Security Summary](#security-summary)
  - [File Reference](#file-reference)
    - [Web App (`apps/web/src/`)](#web-app-appswebsrc)
    - [Auth Portal (`apps/auth/src/`)](#auth-portal-appsauthsrc)
    - [NestJS API (`apps/api/src/`)](#nestjs-api-appsapisrc)
    - [Infrastructure](#infrastructure)
  - [Further Reading](#further-reading)
    - [Ory Documentation](#ory-documentation)
    - [RFCs \& Standards](#rfcs--standards)
    - [Security References](#security-references)

---

## The Big Picture

When a user signs up, logs in, or performs any identity action in BookShare, the request passes through **four systems**:

1. **Ory Kratos** — Knows who users are. Stores emails, passwords, verification status.
2. **Ory Hydra** — Issues OAuth2 tokens. Doesn't know users at all — it asks Kratos (via the Auth Portal) to authenticate them.
3. **Auth Portal** — A custom Next.js app that renders login/register forms and acts as the glue between Kratos and Hydra.
4. **Web App + API** — The actual BookShare application. Uses the tokens Hydra issues to authenticate API requests.

> **💡 Tip: Why not just use Kratos alone?**
> Kratos handles identity (who you are) but not authorization tokens. If you only had Kratos, the Web App would need to talk directly to Kratos for every request, and you'd have no standardized token format for the API. Hydra adds the OAuth2/OIDC layer — it issues JWTs that the API can verify independently without calling Kratos on every request.
>
> 📖 [Ory documentation: Kratos vs Hydra](https://www.ory.sh/docs/ecosystem/projects)
>
> There are expectations for future clients that may be built, which will depend on Kratos for identity. So Hydra will be responsible for authorizing all different clients that will need access to our resources. One app would be an Admin Dashboard to manage users, organizations etc. Other systems may also be built on top of the resources we have such as specific project for bookstores to view wished books and reach out to those people with others etc. So Hydra will handle authorizations. Kratos will handle identity

---

## Why Two Systems (Kratos + Hydra)?

| Concern | Kratos | Hydra |
|---|---|---|
| Store user accounts | ✅ | ❌ |
| Hash passwords | ✅ | ❌ |
| Send verification emails | ✅ | ❌ |
| Render login/register forms | ❌ (headless) | ❌ (headless) |
| Issue OAuth2 access tokens | ❌ | ✅ |
| Issue OIDC ID tokens | ❌ | ✅ |
| Issue refresh tokens | ❌ | ✅ |
| PKCE, DPoP, JWKS | ❌ | ✅ |

Together they form a complete identity + token system. Kratos owns the user, Hydra owns the tokens. Neither has a UI — that's the Auth Portal's job.

> **💡 Tip: "Headless" means no built-in UI**
> Both Kratos and Hydra are API-only services. They tell you (via JSON) what to render, but they don't render it themselves. This gives you full control over the look and feel of your auth screens. The trade-off is that you must build the UI yourself — which is what the Auth Portal does.

---

## Key Concepts & Glossary

### Kratos Concepts

**Identity**
A user record in Kratos. Contains traits (email, name, gender) and credentials (password hash, code addresses). Each identity has a UUID.

> **💡 Tip: Identity ≠ Account**
> Kratos calls user records "identities" rather than "accounts" or "users." This is intentional — an identity is a broader concept that can represent any entity (person, service account, device). In BookShare, each identity maps to one human user.

**Traits**
User-facing attributes stored on the identity. Defined by a JSON Schema (`identity.schema.json`). BookShare traits: `email`, `name.first`, `name.last`, `gender`.

> **💡 Tip: Why are traits defined by JSON Schema?**
> Kratos doesn't hardcode what user data looks like. Instead, you define a JSON Schema that says "users have an email and a name." Kratos reads this schema to know which fields to show in forms, which field is the login identifier, which field to send verification codes to, etc. This makes Kratos flexible — you can add new traits without changing Kratos code.
>
> 📖 [Kratos Identity Schema docs](https://www.ory.sh/docs/kratos/manage-identities/identity-schema)

**Method**
A strategy for performing an authentication action. Kratos supports multiple methods:

| Method | What it does | Used in BookShare for |
|---|---|---|
| `password` | Email + password authentication | Login, password setup |
| `code` | 6-digit code sent via email | Registration (email verification), recovery |
| `link` | Clickable link sent via email | Enabled but not actively used |
| `totp` | Authenticator app codes | Not enabled |
| `webauthn` | Hardware security keys | Not enabled |
| `oidc` | Social login (Google, GitHub, etc.) | Not enabled |

> **💡 Tip: A "method" is NOT a flow**
> A method is a strategy (how to authenticate), while a flow is an instance (one specific login attempt). A single flow can offer multiple methods — for example, the login flow offers both `password` and `code` methods. The Auth Portal chooses which methods to render.
>
> 📖 [Kratos Self-Service Methods](https://www.ory.sh/docs/kratos/self-service)

**Flow**
A stateful, server-side object representing one authentication attempt. Every user action (registration, login, recovery, etc.) creates a flow with:
- A UUID
- A lifespan (after which it expires)
- A `ui` object describing what form to render
- A `state` that progresses as the user interacts

> **💡 Tip: Flows are independent and isolated**
> Each flow is its own world. If a user starts a login flow and then opens a registration flow in another tab, those are two completely separate flow objects with separate IDs, separate states, and separate lifespans. They don't interfere with each other.
>
> Kratos tracks flow state server-side (in the database), not in browser cookies or sessions. The only thing linking a browser to a flow is the `?flow={id}` query parameter in the URL and the CSRF cookie.

**Flow State**
Flows progress through states:

| State | Meaning |
|---|---|
| `choose_method` | Initial state. User hasn't submitted anything yet. |
| `sent_email` | A code was sent. Waiting for user to enter it. |
| `passed_challenge` | The challenge was completed successfully. |
| `show_form` | Settings flow: form is ready for input. |
| `success` | Settings flow: changes were saved. |

**CSRF Token**
A hidden form field that Kratos requires on every POST submission.

> **💡 Tip: Why does Kratos need a CSRF token?**
> CSRF (Cross-Site Request Forgery) is an attack where a malicious website tricks your browser into submitting a form to another site. For example, a malicious page could have a hidden form that POSTs to Kratos's login endpoint using your browser's cookies.
>
> The CSRF token prevents this. Kratos generates a random token and stores it in a cookie (`csrf_token_...`). The form includes this token as a hidden field. When the form is submitted, Kratos checks that the token in the form matches the token in the cookie. A malicious site can't read the cookie (due to SameSite and HttpOnly flags), so it can't include the correct token.
>
> **Why is it a cookie AND a form field?** The cookie is set by Kratos (on the Kratos domain). The form field is rendered by the Auth Portal. On form submission, the browser automatically sends the cookie, and the form includes the field. Kratos compares both — this is the "double-submit cookie" pattern.
>
> 📖 [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)

**Kratos Session (`ory_kratos_session`)**
When a user successfully authenticates, Kratos creates a session and sets an `ory_kratos_session` cookie. This cookie is scoped to the Kratos domain (localhost:4433). It's used by the Auth Portal to check if a user is logged in when handling Hydra challenges.

> **💡 Tip: This is NOT the Web App session**
> The Kratos session and the Web App session (`bookshare_session`) are completely separate things:
> - `ory_kratos_session` — Set by Kratos, scoped to Kratos domain, used by Auth Portal
> - `bookshare_session` — Set by Web App, scoped to Web App domain, contains OAuth tokens
>
> A user needs both: the Kratos session to prove who they are, and the Web App session to carry their OAuth tokens.

**Hooks**
Post-flow actions that Kratos executes after a flow step succeeds. Configured in `kratos.yml` per flow and per method.

> **💡 Tip: Hooks are Kratos's way of chaining actions**
> Without hooks, a successful registration would just... end. The user would have an identity in the database but no session. Hooks let you say "after registration with the code method succeeds, also create a session." Think of them as middleware that runs after a flow step.
>
> Common hooks:
> - `session` — Creates a Kratos session (logs the user in)
> - `show_verification_ui` — Redirects to email verification
> - `web_hook` — Calls an external URL (not used in BookShare)
>
> 📖 [Kratos Hooks docs](https://www.ory.sh/docs/kratos/hooks/configure-hooks)

**Verifiable Address**
An entry in the identity's `verifiable_addresses` array. Tracks whether a specific email has been verified. Fields: `value` (the email), `verified` (boolean), `status` ("sent", "completed"), `verified_at` (timestamp).

> **💡 Tip: Why is verification separate from the email trait?**
> The `traits.email` field stores the user's email. The `verifiable_addresses` array tracks whether that email has been proven to belong to the user. They're separate because a user might change their email — the old address was verified, but the new one isn't yet. By keeping them separate, Kratos can track verification status per address.

**Privileged Session**
A session that was authenticated recently enough to perform sensitive operations (like changing a password). Configured via `privileged_session_max_age` in `kratos.yml`.

> **💡 Tip: Why does Kratos require re-authentication for settings?**
> Imagine a user logs in at a library computer and walks away. Someone else sits down and navigates to settings. Without privileged session enforcement, they could change the password immediately. With a 15-minute privileged session window, Kratos forces re-authentication if the session is older than 15 minutes — even though the session itself is still valid.
>
> This is the same pattern used by GitHub (re-enter password to change settings) and Google (re-verify to access security settings).

### Hydra Concepts

**OAuth 2.0 Client**
A registered application that can request tokens from Hydra. BookShare registers one client: `bookshare-web`.

| Setting | Value | Why |
|---|---|---|
| `client_id` | `bookshare-web` | Identifies the Web App to Hydra |
| `grant_types` | `authorization_code`, `refresh_token` | Standard OIDC flow + token refresh |
| `response_types` | `code`, `id_token` | Authorization code and ID token |
| `token_endpoint_auth_method` | `none` | Public client (no client secret) |
| `redirect_uris` | `http://localhost:3334/api/auth/callback` | Where Hydra sends the authorization code |

> **💡 Tip: Why "none" for auth method?**
> BookShare's Web App is a "public client" — its code runs in the browser (Next.js server-side routes, but the PKCE flow is designed for clients that can't keep secrets). Public clients don't have a `client_secret`. Instead, they use PKCE (Proof Key for Code Exchange) to secure the authorization code exchange.
>
> 📖 [OAuth 2.0 for Browser-Based Apps (RFC)](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps)

**Login Challenge**
When a user tries to authenticate via OAuth, Hydra creates a login challenge and redirects to the Auth Portal. The challenge says "I need you to authenticate this user." The Auth Portal checks Kratos, and if the user is authenticated, tells Hydra "this user is X" by accepting the challenge.

**Consent Challenge**
After login, Hydra creates a consent challenge. This is where the user would normally see "App X wants access to your email and profile. Allow?" In BookShare, consent is auto-granted (no user prompt) because the Web App is a first-party application.

> **💡 Tip: Login vs. Consent — why two steps?**
> OAuth 2.0 separates authentication (who are you?) from authorization (what can this app access?). In third-party scenarios (like "Log in with Google"), you authenticate with Google (login) and then decide whether the app can see your email (consent). BookShare auto-grants consent because it's the same organization's app.
>
> 📖 [Hydra Login & Consent Flow](https://www.ory.sh/docs/hydra/guides/login)

**PKCE (Proof Key for Code Exchange)**
A security extension to OAuth 2.0 that prevents authorization code interception.

> **💡 Tip: How PKCE works**
> 1. Web App generates a random `code_verifier` (128 chars)
> 2. Web App computes `code_challenge = SHA-256(code_verifier)` and sends it to Hydra
> 3. Hydra stores the challenge and issues an authorization code
> 4. Web App sends the code + original `code_verifier` to Hydra's token endpoint
> 5. Hydra computes SHA-256(code_verifier) and checks it matches the stored challenge
>
> If an attacker intercepts the authorization code in transit, they can't exchange it for tokens because they don't have the `code_verifier`. It was never sent over the redirect — only the SHA-256 hash was.
>
> 📖 [PKCE RFC 7636](https://datatracker.ietf.org/doc/html/rfc7636)

**ID Token**
A JWT that contains claims about the user (email, name, etc.). Issued by Hydra after successful consent. The Web App reads this to populate `SessionData.user`.

**Access Token**
A JWT that the Web App sends to the NestJS API to prove authorization. Contains `sub` (user ID), `email_verified`, and `cnf.jkt` (DPoP key thumbprint).

**Refresh Token**
A long-lived token used to get new access tokens when the current one expires. Stored in the encrypted `bookshare_session` cookie.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          USER'S BROWSER                                  │
│                                                                          │
│  Cookies:                                                                │
│  • ory_kratos_session (domain: localhost:4433)                          │
│  • csrf_token_*       (domain: localhost:4433)                          │
│  • bookshare_session  (domain: localhost:3334, AES-256-GCM encrypted)   │
│  • bookshare_token    (domain: localhost:3334, AES-256-GCM encrypted)   │
└────────┬───────────────────┬──────────────────────┬──────────────────────┘
         │                   │                      │
         ▼                   ▼                      ▼
┌─────────────────┐  ┌───────────────┐  ┌─────────────────────────────────┐
│   Web App       │  │  Auth Portal  │  │   Ory Stack (Docker)            │
│   (Next.js)     │  │  (Next.js)    │  │                                 │
│   Port 3334     │  │  Port 3337    │  │  Kratos public    :4433         │
│                 │  │               │  │  Kratos admin     :4434         │
│  • /api/auth/*  │  │  • /login     │  │  Hydra public     :4444         │
│  • /api/nestjs  │  │  • /register  │  │  Hydra admin      :4445         │
│  • middleware   │  │  • /setup     │  │                                 │
│  • PKCE + DPoP  │  │  • /recovery  │  │  Mailpit (dev)    :4436         │
│                 │  │  • /oauth/*   │  │                                 │
└────────┬────────┘  └───────────────┘  └─────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│  NestJS API     │
│  Port 3333      │
│                 │
│  JWT + DPoP     │
│  validation     │
└─────────────────┘
```

### Services & Ports

| Service | Port | Role |
|---|---|---|
| Kratos (public) | 4433 | Browser-facing identity API |
| Kratos (admin) | 4434 | Internal identity management API |
| Hydra (public) | 4444 | OAuth2/OIDC endpoints |
| Hydra (admin) | 4445 | Challenge acceptance, client management |
| Auth Portal | 3337 | Kratos UI + Hydra bridge |
| Web App | 3334 | Main BookShare frontend |
| NestJS API | 3333 | Protected backend API |
| Mailpit | 4436 | Dev email sink |
| PostgreSQL | 5434 | Main application database |

> **💡 Tip: Public vs. Admin APIs**
> Both Kratos and Hydra expose two API surfaces:
> - **Public API** — Meant for browsers. Handles self-service flows, session checks, token endpoints. Exposed on the external network.
> - **Admin API** — Meant for trusted backends. Can create/delete identities, accept challenges, manage clients. Only accessible on the Docker internal network (never exposed to browsers).
>
> The Auth Portal uses both: public (to initiate flows) and admin (Hydra admin to accept challenges). The Web App only uses Hydra's public API (for token exchange). The NestJS API only uses Hydra's JWKS endpoint (to verify tokens).

---

## How Kratos Works

### The Flow Lifecycle

Every user action in Kratos follows the same pattern:

```
  ┌─────────────────────────────────────────────────────────────────┐
  │ 1. INITIATE                                                     │
  │    Browser → GET /self-service/{type}/browser?return_to=...     │
  │    Kratos creates a flow (UUID + lifespan + initial UI nodes)   │
  │    Kratos redirects → {ui_url}?flow={id}                        │
  │    Kratos sets csrf_token cookie                                │
  └────────────────────────────┬────────────────────────────────────┘
                               │
  ┌────────────────────────────▼────────────────────────────────────┐
  │ 2. FETCH                                                        │
  │    Auth Portal → GET /self-service/{type}/flows?id={id}         │
  │    Kratos returns JSON: { id, state, ui: { action, nodes[] } }  │
  │    Auth Portal renders the nodes as HTML form fields             │
  └────────────────────────────┬────────────────────────────────────┘
                               │
  ┌────────────────────────────▼────────────────────────────────────┐
  │ 3. SUBMIT                                                       │
  │    Browser → POST {flow.ui.action}                              │
  │    Kratos validates the submission                               │
  │    ┌─ Success → run hooks → redirect to return_to               │
  │    └─ Failure → update flow with errors → redirect to ui_url    │
  └────────────────────────────┬────────────────────────────────────┘
                               │
  ┌────────────────────────────▼────────────────────────────────────┐
  │ 4. EXPIRE                                                       │
  │    After {lifespan}, the flow becomes invalid                    │
  │    Any fetch/submit returns an error                             │
  │    User must start a new flow                                    │
  └─────────────────────────────────────────────────────────────────┘
```

> **💡 Tip: Why does Kratos redirect instead of returning JSON directly?**
> Kratos is designed for browser-based flows using redirects (the PRG pattern — Post/Redirect/Get). When you submit a form, Kratos processes it and redirects the browser back to the UI URL. This prevents the "resubmit form?" dialog when the user refreshes the page.
>
> The flow ID in the URL is the only link between the browser and the server-side flow state. Kratos doesn't use query parameters to pass form data or errors — it stores everything in the flow object and lets the UI fetch it.

### Flow Types

| Flow Type | Lifespan | Requires Session | Purpose |
|---|---|---|---|
| `registration` | 1h | No | Create a new identity |
| `login` | 10m | No | Authenticate an existing identity |
| `recovery` | 1h | No | Reset a forgotten password |
| `verification` | 1h | No | Verify an email address |
| `settings` | 1h | **Yes** | Change password, update profile |

> **💡 Tip: Why does `settings` require a session but `recovery` doesn't?**
> Recovery is for users who can't log in (forgot password). Requiring a session would be a catch-22. Settings is for logged-in users who want to change something. Requiring a session ensures only the account owner can make changes.

### How Kratos Tracks State

Kratos stores flow state **server-side in the database**, not in cookies or browser storage. The key design points:

1. **Flow ID in URL** — The `?flow={id}` parameter links the browser to the server-side flow
2. **CSRF cookie** — Links the browser to the CSRF protection for the flow
3. **Session cookie** — Optional; links the browser to an authenticated identity
4. **Everything else is server-side** — Flow state, submitted data, error messages, code challenges

This means:
- Two browser tabs can have two different flows active simultaneously
- Refreshing the page doesn't lose state (the flow ID is in the URL)
- The flow state can't be tampered with (it's server-side)
- Expired flows simply stop working (the server rejects them)

### What Kratos Returns (and Why)

When you fetch a flow, Kratos returns a JSON object with a `ui` field. This `ui` object is the contract between Kratos and your UI:

```json
{
  "id": "flow-uuid",
  "state": "choose_method",
  "ui": {
    "action": "http://localhost:4433/self-service/login?flow=...",
    "method": "POST",
    "messages": [],
    "nodes": [...]
  }
}
```

| Field | Purpose | Why It Exists |
|---|---|---|
| `ui.action` | Form action URL | Tells the UI where to POST. Includes the flow ID so Kratos knows which flow to process. |
| `ui.method` | HTTP method | Always "POST". Included for completeness. |
| `ui.messages` | Top-level messages | Flow-wide messages (errors, info). Shown above the form. |
| `ui.nodes` | Array of form elements | The actual form fields, hidden inputs, and buttons. |

Each node in `ui.nodes` has:

| Field | Purpose |
|---|---|
| `type` | Always "input" for form elements |
| `group` | Which method this node belongs to ("default", "password", "code", "profile") |
| `attributes.name` | The form field name (submitted to Kratos) |
| `attributes.type` | HTML input type ("hidden", "text", "email", "password", "submit") |
| `attributes.value` | Pre-filled value (for hidden fields, pre-populated traits) |
| `attributes.required` | Whether the field is required |
| `meta.label.text` | Human-readable label for the field |
| `messages` | Per-field error/info messages |

> **💡 Tip: The `group` field is how Kratos supports multiple methods in one flow**
> A single login flow might have nodes in both the `password` group and the `code` group. The `default` group contains shared elements (like the email input and CSRF token). The Auth Portal uses `sectionGroups` to choose which groups to render. For login, it renders `["password"]` — this filters out the code login button while keeping the default group's email input.
>
> 📖 [Kratos UI Node Reference](https://www.ory.sh/docs/kratos/concepts/ui-user-interface)

### Sessions and `/sessions/whoami`

When Kratos creates a session, it returns a session object and sets the `ory_kratos_session` cookie. To check if a user is authenticated, call:

```
GET /sessions/whoami
Cookie: ory_kratos_session=...
```

**Response (authenticated):**
```json
{
  "id": "session-uuid",
  "active": true,
  "authentication_methods": [
    { "method": "password", "aal": "aal1", "completed_at": "..." }
  ],
  "identity": {
    "id": "identity-uuid",
    "traits": { "email": "...", "name": { "first": "...", "last": "..." } },
    "verifiable_addresses": [
      { "value": "...", "verified": true, "status": "completed" }
    ]
  }
}
```

**Response (not authenticated):**
```
HTTP 401 Unauthorized
```

> **💡 Tip: What is `aal` (Authenticator Assurance Level)?**
> AAL is a NIST concept that describes how strongly the user proved their identity:
> - `aal1` — One factor (password OR code). This is what BookShare uses.
> - `aal2` — Two factors (password AND TOTP, for example).
>
> Kratos tracks AAL per session so you can enforce stronger authentication for sensitive operations. BookShare currently only requires `aal1`.
>
> 📖 [NIST AAL Definition](https://pages.nist.gov/800-63-3/sp800-63b.html#sec4)

> **💡 Tip: Why does `whoami` return the full identity?**
> This is by design. The `whoami` endpoint is meant for server-side session checking. It returns the full identity (traits + verification status) so the Auth Portal can make decisions without additional API calls. For example, the OAuth login handler checks email verification and profile completeness — all from the single `whoami` response.

### Identity Schema

File: `infra/ory/kratos/identity.schema.json`

The schema defines what data Kratos stores per user:

```json
{
  "traits": {
    "email": {
      "type": "string", "format": "email",
      "ory.sh/kratos": {
        "credentials": {
          "password": { "identifier": true },
          "code": { "identifier": true, "via": "email" }
        },
        "verification": { "via": "email" },
        "recovery": { "via": "email" }
      }
    },
    "name": {
      "first": { "type": "string" },
      "last": { "type": "string" }
    },
    "gender": { "type": "string", "enum": ["female", "male", "prefer_not_to_say"] }
  }
}
```

> **💡 Tip: What does `ory.sh/kratos` do in the schema?**
> This is a Kratos-specific JSON Schema extension. It tells Kratos how to use each field:
>
> - `credentials.password.identifier: true` — Use this field as the login identifier for password authentication. Users type their email to log in.
> - `credentials.code.identifier: true` — Use this field as the identifier for code-based authentication.
> - `credentials.code.via: "email"` — Send the code to this field's value via email (not SMS).
> - `verification.via: "email"` — Send verification codes to this email.
> - `recovery.via: "email"` — Send recovery codes to this email.
>
> Without these annotations, Kratos wouldn't know which field is the email, which field to send codes to, or which field to use for login.
>
> 📖 [Kratos Identity Schema Reference](https://www.ory.sh/docs/kratos/manage-identities/identity-schema)

---

## How Hydra Works

Hydra is a pure OAuth 2.0 / OpenID Connect server. It has no user database. When it needs to authenticate a user, it delegates to the Auth Portal via challenge endpoints.

### The Challenge Flow

```
1. Web App redirects browser to Hydra /oauth2/auth
2. Hydra creates a login_challenge → redirects to Auth Portal /oauth/login
3. Auth Portal checks Kratos session → accepts the challenge → tells Hydra "user is X"
4. Hydra creates a consent_challenge → redirects to Auth Portal /oauth/consent
5. Auth Portal auto-grants consent → tells Hydra "grant these scopes"
6. Hydra generates authorization code → redirects to Web App /api/auth/callback
7. Web App exchanges code for tokens (with PKCE + DPoP)
```

> **💡 Tip: Why does Hydra need the Auth Portal at all?**
> Hydra doesn't know how to authenticate users. It only knows how to issue tokens. The login/consent challenge flow is Hydra's way of asking "who is this user and what should I give them?" The Auth Portal answers these questions by checking Kratos.
>
> This separation means you could swap out Kratos for any other identity provider and Hydra wouldn't know the difference. You'd just change the Auth Portal to check a different system.

### What Hydra Issues

After the challenge flow, Hydra issues three tokens:

| Token | Type | Contains | Lifetime | Purpose |
|---|---|---|---|---|
| Access Token | JWT (RS256) | `sub`, `email_verified`, `cnf.jkt` | ~1h | Authorize API requests |
| ID Token | JWT (RS256) | `email`, `name`, `preferred_username`, `email_verified` | ~1h | User info for the Web App |
| Refresh Token | Opaque | — | Long-lived | Get new access tokens |

> **💡 Tip: Why RS256 for JWTs?**
> RS256 uses asymmetric cryptography (RSA). Hydra signs tokens with a private key and publishes the public key at `/.well-known/jwks.json`. The NestJS API can verify tokens using only the public key — it never needs access to Hydra's private key. This is more secure than symmetric algorithms (like HS256) where the verifier needs the same secret.
>
> 📖 [JSON Web Key Sets (JWKS)](https://auth0.com/docs/secure/tokens/json-web-tokens/json-web-key-sets)

---

## How the Auth Portal Bridges Them

The Auth Portal (`apps/auth`) serves two roles:

### Role 1: Kratos UI

Kratos is headless — it returns JSON describing what form to show. The Auth Portal fetches this JSON and renders React components.

**Key mapping:**
- Kratos `ui.nodes` → `KratosFlowForm` component → HTML `<form>` elements
- Kratos `ui.action` → `<form action="...">`
- Kratos `ui.messages` → Alert banners above the form
- Kratos `node.messages` → Error text below individual fields

See [kratos-deep-dive.md](./kratos-deep-dive.md) for the full component architecture and rendering logic.

### Role 2: Hydra Challenge Handler

The Auth Portal handles three Hydra challenge endpoints:

| Endpoint | What Hydra Asks | What Auth Portal Does |
|---|---|---|
| `/oauth/login` | "Authenticate this user" | Checks Kratos session → accepts with identity ID |
| `/oauth/consent` | "What scopes should I grant?" | Auto-grants all requested scopes + builds ID token claims |
| `/oauth/logout` | "Should I end this session?" | Always accepts |

---

## Cookie Strategy

BookShare uses cookies at three levels. Understanding which cookie belongs to which domain is critical.

### By Domain

| Domain | Cookie | Set By | Content |
|---|---|---|---|
| localhost:4433 | `ory_kratos_session` | Kratos | Session token (Kratos signs it) |
| localhost:4433 | `csrf_token_*` | Kratos | CSRF protection for flows |
| localhost:3337 | `bookshare_register_flow` | Auth Portal | Registration flow ID (plaintext) |
| localhost:3334 | `bookshare_session` | Web App | Full session data (AES-256-GCM encrypted) |
| localhost:3334 | `bookshare_token` | Web App | API access token (AES-256-GCM encrypted) |
| localhost:3334 | `bookshare_logged_out` | Web App | Logout marker (`"1"`) |
| localhost:3334 | `oidc_code_verifier` | Web App | PKCE verifier (AES-256-GCM encrypted, 10min) |
| localhost:3334 | `oidc_state` | Web App | OAuth state (AES-256-GCM encrypted, 10min) |
| localhost:3334 | `oidc_return_to` | Web App | Return path (AES-256-GCM encrypted, 10min) |

All cookies are `httpOnly` (inaccessible to JavaScript) and `sameSite: lax` (prevents cross-site submission). In production, all use `secure: true` (HTTPS only).

> **💡 Tip: Why are there three separate cookie domains?**
> Each service sets cookies on its own domain. Browsers enforce the Same-Origin Policy — a cookie set by localhost:4433 (Kratos) is only sent to localhost:4433. The Web App (localhost:3334) can't read Kratos cookies and vice versa.
>
> This isolation is a security feature. Even if the Web App has an XSS vulnerability, the attacker can't steal the Kratos session cookie because it's on a different domain.

> **💡 Tip: Why store the registration flow ID in a cookie?**
> During registration, Kratos redirects the browser multiple times (flow creation → email entry → code entry). Some of these redirects can lose the `?flow=` query parameter. The Auth Portal middleware stores the flow ID in a `bookshare_register_flow` cookie so it can restore the flow ID if the URL loses it.

---

## Cookie Encryption (AES-256-GCM)

All sensitive Web App cookies are encrypted before being stored in the browser.

### Why Encrypt?

Even with `httpOnly` (JS can't read) and `secure` (HTTPS only), cookies are stored in plaintext on the user's machine. Anyone with physical access or malware could read them. Encryption ensures that even if the raw cookie bytes are extracted, they're useless without the server's `SESSION_SECRET`.

### How It Works

```
SESSION_SECRET (env var)
    ↓
HKDF-SHA256 (salt: "bookshare-session-v1", info: "aes-256-gcm")
    ↓
256-bit AES-GCM key
    ↓
encrypt(plaintext) → "{base64url(IV)}.{base64url(ciphertext+authTag)}"
```

- **HKDF** derives a strong key from the `SESSION_SECRET`, even if the secret is a simple string
- **AES-256-GCM** provides authenticated encryption — tampering with any bit causes decryption to fail
- **12-byte IV** (initialization vector) is randomly generated per encryption, ensuring the same plaintext produces different ciphertext each time

> **💡 Tip: What is "authenticated encryption"?**
> AES-GCM doesn't just encrypt — it also produces an authentication tag (like a signature). If an attacker modifies even one bit of the ciphertext, decryption fails entirely instead of producing garbled data. This prevents both reading AND tampering.
>
> 📖 [AES-GCM (NIST SP 800-38D)](https://csrc.nist.gov/publications/detail/sp/800-38d/final)

### What's Inside `bookshare_session`

When decrypted, the `bookshare_session` cookie contains:

```json
{
  "accessToken": "eyJhbG...",
  "refreshToken": "ory_rt_...",
  "idToken": "eyJhbG...",
  "expiresAt": 1710000000,
  "dpopJwk": { "kty": "EC", "crv": "P-256", "x": "...", "y": "...", "d": "..." },
  "user": {
    "id": "identity-uuid",
    "email": "user@example.com",
    "name": "Jane Doe",
    "username": "jane",
    "emailVerified": true
  }
}
```

The `dpopJwk` field is particularly sensitive — it contains the private key for DPoP proof generation. This is why encryption is critical.

---

## DPoP Token Binding (RFC 9449)

### The Problem It Solves

Standard OAuth tokens are **bearer tokens** — anyone who has the token can use it. If an attacker steals your access token (from logs, compromised proxy, packet sniffing), they can make API requests as you from their own machine.

### How DPoP Fixes This

DPoP (Demonstration of Proof-of-Possession) binds each token to a cryptographic keypair. The token is useless without the private key.

```
At Login:
  1. Web App generates ECDSA P-256 keypair
  2. Sends public key to Hydra during token exchange
  3. Hydra stamps the access token with the key's thumbprint: cnf.jkt = SHA-256(publicKey)
  4. Web App stores the private key in the encrypted session cookie

On Every API Request:
  1. Web App creates a DPoP proof JWT (signed with private key)
  2. Sends both: Authorization: DPoP {token} + DPoP: {proof}
  3. API verifies:
     a. Proof is signed by the key embedded in the proof header
     b. Key thumbprint matches the token's cnf.jkt claim
     c. Proof is fresh (iat within 60 seconds)
     d. Proof targets the right URL and method (htm, htu)
     e. Proof is bound to this specific token (ath = SHA-256(token))
```

> **💡 Tip: Think of DPoP as a car key + ignition**
> A bearer token is like a car with a push-button start — anyone who has the key fob can drive it. DPoP is like a traditional key + ignition — you need both the token (key) and the ability to produce proofs (turning the key) to start the car. Stealing just the key fob from a distance doesn't help.
>
> 📖 [RFC 9449: OAuth 2.0 DPoP](https://datatracker.ietf.org/doc/html/rfc9449)

### DPoP Proof Structure

```
Header:  { typ: "dpop+jwt", alg: "ES256", jwk: {public key} }
Payload: { jti: "uuid", htm: "POST", htu: "https://api/path", iat: timestamp, ath: "hash" }
Signature: ECDSA P-256
```

Each field serves a specific anti-abuse purpose:

| Field | Prevents |
|---|---|
| `jti` (unique ID) | Replay attacks (same proof used twice) |
| `htm` (HTTP method) | Method confusion (POST proof used for DELETE) |
| `htu` (target URL) | URL confusion (proof for /users used on /admin) |
| `iat` (issued at) | Stale proofs (proof from yesterday) |
| `ath` (access token hash) | Token substitution (proof used with different token) |

---

## Flow Overview: Registration

Registration is a multi-step process that spans Kratos flows and ends with OAuth2 token acquisition.

**For full technical detail with real Kratos API responses at every stage, see [REGISTRATION-FLOW.md](./REGISTRATION-FLOW.md).**

### Summary

```
1. User clicks "Create account" on Web App landing page
2. → Auth Portal /register (email entry form)
3. → Kratos sends 6-digit code to email
4. → Auth Portal /register (code entry form)
5. → Kratos verifies code → creates identity + session
6. → Auth Portal /setup (password form)
7. → Auth Portal /setup (profile form)
8. → Web App /api/auth/login (starts OAuth2 flow)
9. → Hydra login challenge → Auth Portal auto-accepts (session exists)
10. → Hydra consent challenge → Auth Portal auto-grants
11. → Web App /api/auth/callback (exchanges code for tokens with DPoP)
12. → User lands on /browse, fully authenticated
```

> **💡 Tip: Why does registration end with an OAuth flow?**
> After Kratos registration, the user has a Kratos session but no OAuth tokens. The Web App needs OAuth tokens (access token, ID token) to authenticate API requests. So the final step of registration is an automatic login through Hydra — the user has a Kratos session, so the Auth Portal accepts the login challenge without asking for credentials again.

> **💡 Tip: Why is the password set AFTER email verification?**
> BookShare uses code-based registration: enter email → verify with code → set password. This order ensures:
> 1. The email is verified before the account is fully created
> 2. No password is wasted on an unverifiable email
> 3. The user can't be tricked into setting a password for an email they don't own
>
> The alternative (password registration) creates the identity immediately and verifies email afterward — which means there's a window where an unverified identity exists with a password. BookShare chose code-first to avoid this.

---

## Flow Overview: Login

Login combines Kratos password authentication with Hydra's OAuth2 challenge flow.

**For full technical detail with real Kratos API responses at every stage, see [LOGIN-FLOW.md](./LOGIN-FLOW.md).**

### Summary

```
1. User visits protected route (e.g., /my-library)
2. → Web App middleware detects no session → redirects to /api/auth/login
3. → Web App generates PKCE credentials + state → stores in encrypted cookies
4. → Redirect to Hydra /oauth2/auth
5. → Hydra creates login_challenge → redirects to Auth Portal /oauth/login
6. → Auth Portal checks for Kratos session → none found → redirects to /login
7. → User enters email + password → Kratos validates → creates session
8. → Back to /oauth/login → Auth Portal accepts challenge (user is authenticated)
9. → Hydra creates consent_challenge → Auth Portal auto-grants
10. → Hydra issues authorization code → redirects to /api/auth/callback
11. → Web App exchanges code for tokens (PKCE + DPoP)
12. → User lands on /my-library with full session
```

> **💡 Tip: Why does Kratos expose both password and code login methods?**
> Kratos's login flow returns nodes for BOTH `password` and `code` groups because both methods are enabled in `kratos.yml`. The Auth Portal only renders `sectionGroups={["password"]}`, effectively hiding the code login option. This is a UI decision, not a Kratos restriction. Raw Kratos still accepts code login via the API.
>
> [CONSIDERED FOR REMOVAL] This matters for security: if you truly want to disable code login, you should set `passwordless_enabled: false` in `kratos.yml` rather than relying on the UI to hide it.
>
> [ADDED] Code login can't be disabled since it is what the user logs in with initially during registration. During registration, user logs in with email + code even though we do not call it "login". Kratos calls it, but we do not. Since we need only email + password. We call it "partial login". To be "fully logged-in" in our terms, you need a password and a complete profile.

---

## Flow Overview: Logout

Logout invalidates three separate sessions across three systems.

### Summary

```
1. User clicks logout → /api/auth/logout
2. Web App deletes local cookies (bookshare_session, bookshare_token, etc.)
3. Web App sets bookshare_logged_out marker (prevents redirect loops)
4. → Redirect to Hydra /oauth2/sessions/logout (end-session)
5. → Hydra creates logout_challenge → Auth Portal /oauth/logout auto-accepts
6. → Hydra invalidates OAuth session and tokens
7. → Redirect to Web App /api/auth/post-logout
8. → Redirect to Auth Portal /logout
9. → Auth Portal requests Kratos logout URL → Kratos destroys session
10. → Final redirect to Web App home page
```

**Three sessions invalidated:**
1. **Web App** — `bookshare_session` + `bookshare_token` cookies deleted
2. **Hydra** — OAuth session and all tokens revoked
3. **Kratos** — `ory_kratos_session` cookie cleared

> **💡 Tip: Why is logout so many redirects?**
> Each system owns its own session, and each system needs to clean up its own state. The Web App can't delete the Kratos cookie (different domain), and Kratos can't revoke Hydra tokens. So the browser bounces between systems, and each one cleans up its piece.
>
> The `bookshare_logged_out` marker (30-minute TTL) prevents a UX issue: if the user visits a protected route right after logout, the middleware sees no session and would redirect to `/api/auth/login`. But Hydra might still have cached state that auto-logs them back in. The marker tells the middleware "the user just logged out — send them to the landing page, not the login flow."

---

## Flow Overview: Password Recovery

### Summary

```
1. User clicks "Forgot password?" on login page
2. → Auth Portal /recovery (email entry form)
3. → Kratos sends 6-digit recovery code to email
4. → Auth Portal /recovery (code entry form)
5. → Kratos validates code → grants privileged session
6. → Redirects to settings flow → user sets new password
```

> **💡 Tip: Why does recovery grant a "privileged" session?**
> The recovery code proves the user owns the email. Kratos treats this as sufficient proof to allow a password change. But instead of a custom "reset password" endpoint, Kratos reuses the existing settings flow. The recovery flow creates a privileged session, and the settings flow checks for a privileged session before allowing password changes.

---

## Flow Overview: Email Verification

### Triggers

Email verification is enforced at four points:

1. **During registration** — The code method verifies email as part of registration (steps 3-4)
2. **During OAuth login challenge** — Auth Portal checks `isKratosEmailVerified(session)`
3. **During Web App callback** — Checks `email_verified` claim in ID token
4. **During Web App middleware** — Checks `session.user.emailVerified`

> **💡 Tip: The `isKratosEmailVerified` function is stricter than you'd expect**
> It doesn't just check if ANY address is verified. It checks if the CURRENT `traits.email` matches a verified address. This prevents a scenario where a user changes their email (if supported in the future) and the old verified status carries over to the new unverified email.

---

## Flow Overview: Account Settings

### Summary

```
1. User navigates to Auth Portal /settings
2. → Kratos creates settings flow (requires active session)
3. → Auth Portal renders profile fields (email read-only, name, gender editable)
4. → User submits changes → Kratos updates identity traits
```

**Current limitations:**
- Email is **read-only** — changing email requires a new verification flow that isn't implemented yet
- Password changes are possible via the `password` group but aren't exposed in the current UI
- The settings flow re-authenticates if the session is older than 15 minutes (`privileged_session_max_age`)

---

## API Authentication Guard

File: `apps/api/src/common/guards/auth.guard.ts`

Every request to the NestJS API goes through the auth guard (unless decorated with `@Public()`).

### Verification Steps

```
1. Parse Authorization header
   ┌─ "Bearer {token}" → standard JWT verification
   └─ "DPoP {token}"   → JWT verification + DPoP proof validation

2. Fetch JWKS from Hydra (http://hydra:4444/.well-known/jwks.json)
   Cached for 10 minutes, max 5 keys in cache

3. Verify JWT (RS256)
   - Valid signature (matches Hydra's public key)
   - Valid issuer (matches OIDC_ISSUER env var)
   - Not expired (exp claim)

4. If DPoP: validate the proof JWT
   - Proof signed by the public key embedded in the proof's jwk header
   - typ = "dpop+jwt"
   - htm matches request method
   - htu matches request URL (no query string)
   - iat within 60 seconds of now
   - jti present (unique nonce)
   - ath = base64url(SHA-256(access_token))
   - JWK thumbprint matches access token's cnf.jkt claim

5. Check account deactivation
   - Query memberProfiles.deactivatedAt
   - If deactivated → 401 Unauthorized

6. Attach user to request
   - Available via @CurrentUser() decorator
```

> **💡 Tip: Why support both Bearer and DPoP?**
> DPoP is the security goal, but backward compatibility matters. The PostgREST proxy doesn't support DPoP, so it uses Bearer. New code should always use DPoP.

---

## Security Summary

| Mechanism | Protects Against | How |
|---|---|---|
| **PKCE (S256)** | Auth code interception | Code is useless without the verifier |
| **OAuth state** | CSRF during OAuth flow | Random state verified on callback |
| **DPoP (RFC 9449)** | Token theft / replay | Token bound to cryptographic key |
| **AES-256-GCM cookies** | Cookie tampering + data exposure | Authenticated encryption |
| **httpOnly** | XSS token theft | JS can't access cookies |
| **SameSite=Lax** | CSRF attacks | Cookies not sent on cross-site POSTs |
| **Secure (prod)** | Network sniffing | HTTPS only |
| **CSRF token** | Cross-site form submission | Double-submit cookie pattern |
| **Email verification** | Account takeover | Must prove email ownership |
| **Privileged session** | Stale session settings changes | Re-auth after 15 minutes |
| **Bcrypt (cost 8)** | Password brute force | Slow hash function |
| **XChaCha20-Poly1305** | Data at rest exposure | Kratos encrypts sensitive DB fields |
| **Return URL sanitization** | Open redirect | Whitelist of allowed origins |
| **cnf.jkt binding** | Stolen tokens | Token + proof must use same key |
| **Logged-out marker** | Login redirect loops | 30-min cookie prevents auto-re-login |

---

## File Reference

### Web App (`apps/web/src/`)

| File | Purpose |
|---|---|
| `features/auth/lib/crypto.ts` | AES-256-GCM encrypt/decrypt |
| `features/auth/lib/dpop.ts` | DPoP keypair + proof generation |
| `features/auth/lib/session.ts` | Session cookie read/write |
| `features/auth/lib/oidc.ts` | OIDC client configuration |
| `features/auth/lib/auth-portal.ts` | Auth Portal URL builders |
| `features/auth/lib/api-client.ts` | Server-side API fetch with DPoP |
| `app/api/auth/login/route.ts` | PKCE flow initiation |
| `app/api/auth/callback/route.ts` | Token exchange with DPoP |
| `app/api/auth/logout/route.ts` | Cookie cleanup + Hydra end-session |
| `app/api/auth/post-logout/route.ts` | Redirect to Auth Portal logout |
| `middleware.ts` | Protected route enforcement |

### Auth Portal (`apps/auth/src/`)

| File | Purpose |
|---|---|
| `lib/kratos.ts` | Kratos API client + session helpers |
| `lib/kratos-ui.ts` | Node label + autocomplete resolution |
| `lib/hydra.ts` | Hydra admin API client |
| `lib/config.ts` | URL configuration |
| `middleware.ts` | Registration flow cookie persistence |
| `app/login/page.tsx` | Login UI (password method) |
| `app/register/page.tsx` | Registration UI (code method) |
| `app/setup/page.tsx` | Post-registration setup |
| `app/recovery/page.tsx` | Password recovery |
| `app/verification/page.tsx` | Email verification |
| `app/settings/page.tsx` | Account settings |
| `app/oauth/login/route.ts` | Hydra login challenge handler |
| `app/oauth/consent/route.ts` | Hydra consent challenge handler |
| `app/oauth/logout/route.ts` | Hydra logout challenge handler |
| `app/logout/route.ts` | Kratos session logout |

### NestJS API (`apps/api/src/`)

| File | Purpose |
|---|---|
| `common/guards/auth.guard.ts` | JWT + DPoP verification |
| `common/decorators/public.decorator.ts` | Skip auth for endpoint |
| `common/decorators/current-user.decorator.ts` | Inject authenticated user |

### Infrastructure

| File | Purpose |
|---|---|
| `infra/ory/kratos/kratos.yml` | Kratos configuration |
| `infra/ory/kratos/identity.schema.json` | Identity traits schema |
| `infra/ory/hydra/hydra.yml` | Hydra configuration |
| `infra/ory/hydra/init-client.sh` | OAuth client bootstrap |
| `docker-compose.dev.yml` | Service orchestration |

---

## Further Reading

### Ory Documentation
- [Kratos Overview](https://www.ory.sh/docs/kratos/ory-kratos-intro)
- [Kratos Self-Service Flows](https://www.ory.sh/docs/kratos/self-service)
- [Kratos Identity Schema](https://www.ory.sh/docs/kratos/manage-identities/identity-schema)
- [Kratos Hooks](https://www.ory.sh/docs/kratos/hooks/configure-hooks)
- [Kratos UI Node Reference](https://www.ory.sh/docs/kratos/concepts/ui-user-interface)
- [Hydra Login & Consent Flow](https://www.ory.sh/docs/hydra/guides/login)
- [Hydra OAuth2 Token Introspection](https://www.ory.sh/docs/hydra/guides/oauth2-token-introspection)

### RFCs & Standards
- [RFC 6749 — OAuth 2.0 Framework](https://datatracker.ietf.org/doc/html/rfc6749)
- [RFC 7636 — PKCE](https://datatracker.ietf.org/doc/html/rfc7636)
- [RFC 9449 — DPoP](https://datatracker.ietf.org/doc/html/rfc9449)
- [RFC 7638 — JWK Thumbprint](https://datatracker.ietf.org/doc/html/rfc7638)
- [OpenID Connect Core](https://openid.net/specs/openid-connect-core-1_0.html)

### Security References
- [OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [NIST SP 800-63B — Authentication](https://pages.nist.gov/800-63-3/sp800-63b.html)
- [AES-GCM (NIST SP 800-38D)](https://csrc.nist.gov/publications/detail/sp/800-38d/final)
