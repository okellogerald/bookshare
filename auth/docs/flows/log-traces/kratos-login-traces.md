# Kratos Login Traces

This document captures the current live login behavior for BookShare's boxed auth flow, including both the Hydra-backed successful path and the unverified-account branch.

Capture date:
- 2026-04-09

Environment:
- Web app: `http://localhost:3334`
- Auth Portal: `http://localhost:3337`
- Hydra public/admin: `http://localhost:4444` / `http://localhost:4445`
- Kratos public/admin: `http://localhost:4433` / `http://localhost:4434`
- Kratos version: `v26.2.0`

Raw artifacts from this capture:
- `/tmp/bookshare-auth-traces-1775718679/login-hydra`
- `/tmp/bookshare-auth-traces-1775718679/login-unverified`

Trace identity:
- email: `trace.1775718679@example.com`
- login flow id: `3c222fe2-93de-4562-ad58-293f09c9673a`

## What This Trace Proves

1. The web app starts with Hydra, not with Auth Portal pages directly.
2. Hydra sends the browser to Auth Portal `/oauth/login`.
3. Auth Portal stores the Hydra login challenge as auth-owned state and sends the user to `/login`.
4. Kratos only exposes the current password login path: `identifier`, `password`, and `method=password`.
5. After login, Auth Portal decides the next branch:
   - verified and complete user: resume Hydra
   - unverified user: go to `/verification`

## Current Login Flow Shape

Relevant fields from `/login-hydra/06-login-flow.json`:

```json
{
  "id": "3c222fe2-93de-4562-ad58-293f09c9673a",
  "state": "choose_method",
  "ui": {
    "action": "http://localhost:4433/self-service/login?flow=3c222fe2-93de-4562-ad58-293f09c9673a",
    "method": "POST",
    "nodes": [
      { "group": "default", "name": "csrf_token", "type": "hidden" },
      { "group": "default", "name": "identifier", "type": "text", "required": true },
      { "group": "password", "name": "password", "type": "password", "required": true },
      { "group": "password", "name": "method", "type": "submit", "value": "password" }
    ]
  }
}
```

Why BookShare still converts this into a login-specific model:

1. The Auth Portal wants a stable login contract with only the supported fields.
2. The footer links and page copy are product-owned, not Kratos-owned.
3. The login feature should fail loudly if Kratos ever stops returning the expected password shape.

## Successful Hydra-Backed Login

### Stage 1: Web App Starts OIDC Login

`/login-hydra/01-web-login.http`:

```http
HTTP/1.1 307 Temporary Redirect
Location: http://localhost:4444/oauth2/auth?redirect_uri=http%3A%2F%2Flocalhost%3A3334%2Fapi%2Fauth%2Fcallback&scope=openid+profile+email+offline_access&code_challenge=...&code_challenge_method=S256&state=...&prompt=login&max_age=0&client_id=bookshare-web&response_type=code
```

The web app only starts Hydra. It does not know about registration, verification, or recovery.

### Stage 2: Hydra Creates The Login Challenge

`/login-hydra/02-hydra-auth.http`:

```http
HTTP/1.1 302 Found
Location: http://localhost:3337/oauth/login?login_challenge=...
Set-Cookie: ory_hydra_login_csrf_dev_...=...
```

Hydra is asking the auth box to prove the user.

### Stage 3: Auth Portal Internalizes The Hydra State

`/login-hydra/03-auth-oauth-login.http`:

```http
HTTP/1.1 307 Temporary Redirect
Set-Cookie: bookshare_hydra_login_challenge=...; HttpOnly; SameSite=lax
Location: http://localhost:3337/login
```

This is the boxed-auth design in one response:

1. the Hydra challenge is stored by Auth Portal
2. the browser is sent to `/login`
3. there is no generic page-level `return_to` threading anymore

### Stage 4: Auth Portal Boots The Kratos Login Flow

`/login-hydra/05-kratos-browser.http` created the browser flow and redirected to:

```http
HTTP/1.1 303 See Other
Location: http://localhost:3337/login?flow=3c222fe2-93de-4562-ad58-293f09c9673a
Set-Cookie: csrf_token_...=...
```

Then `/login-hydra/06-login-flow.json` returned the password login shape shown earlier.

### Stage 5: User Submits Email And Password To Kratos

Submitted form data:

```http
POST /self-service/login?flow=3c222fe2-93de-4562-ad58-293f09c9673a
Content-Type: application/x-www-form-urlencoded

csrf_token=...
identifier=trace.1775718679%40example.com
password=ResetPassw0rd2026
method=password
```

Response from `/login-hydra/07-submit-login.http`:

```http
HTTP/1.1 303 See Other
Location: http://localhost:3337/oauth/login
Set-Cookie: ory_kratos_session=...; HttpOnly; SameSite=Lax
```

At this point Kratos has done its job:

1. credential validation is complete
2. a browser session exists
3. control returns to Auth Portal

### Stage 6: Auth Portal Resumes Hydra

Auth Portal now sees:

1. a valid Kratos session
2. a verified email
3. a complete profile

So it accepts Hydra's login request and continues the OAuth chain.

`/login-hydra/10-auth-consent.http` shows the consent continuation:

```http
HTTP/1.1 307 Temporary Redirect
Location: http://localhost:4444/oauth2/auth?...&consent_verifier=...
```

### Stage 7: Web Callback Creates The App Session

`/login-hydra/12-web-callback.http`:

```http
HTTP/1.1 307 Temporary Redirect
Location: http://localhost:3334/browse
Set-Cookie: bookshare_token=...; HttpOnly; SameSite=lax
```

This is the final handoff:

1. Hydra returns to the web app callback
2. the web app exchanges the authorization code
3. the web app creates its own session
4. the browser lands on the requested web route

## Unverified Login Branch

The unverified-account branch is a separate auth-box outcome.

Initial login flow from `/login-unverified/02-login-flow.json`:

```json
{
  "id": "6f6d9944-bfe3-4f99-a27d-e0d2718efbe7",
  "state": "choose_method",
  "ui": {
    "nodes": [
      { "group": "default", "name": "identifier", "type": "text", "required": true },
      { "group": "password", "name": "password", "type": "password", "required": true },
      { "group": "password", "name": "method", "type": "submit", "value": "password" }
    ]
  }
}
```

Submitting the same password form returned `/login-unverified/03-submit-login.http`:

```http
HTTP/1.1 303 See Other
Location: http://localhost:3337/oauth/login
Set-Cookie: ory_kratos_session=...; HttpOnly; SameSite=Lax
```

So Kratos still authenticated the user and created a session. The difference happens at the Auth Portal gate.

`/login-unverified/04-oauth-login.http` then returned:

```http
HTTP/1.1 307 Temporary Redirect
Location: http://localhost:3337/verification
```

That is the boxed-auth rule:

1. login succeeded
2. the user is still not allowed to leave auth
3. auth sends the user into verification instead of resuming Hydra

This is why login, verification, and Hydra continuation must stay in one auth-owned decision point rather than being left to page-level links.
