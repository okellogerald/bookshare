# Kratos Login Traces

This document captures a live local login trace for the current BookShare sign-in flow from `bookshare-web` all the way back to an authenticated `/browse` page.

Capture date:
- 2026-03-20

Environment:
- Web app: `http://localhost:3334`
- Auth Portal: `http://localhost:3337`
- Hydra public/admin: `http://localhost:4444` / `http://localhost:4445`
- Kratos public/admin: `http://localhost:4433` / `http://localhost:4434`
- Mail sink: `http://localhost:4436`

Trace account:
- email: `william@bookshare.local`
- identity id: `82f166e5-e2da-4e5b-a8cc-8d03c6ed20e6`
- email verified: yes
- profile complete: yes
- password used during capture: `TracePassw0rd!2026`

Preparation note:
- Immediately before the login capture, the password for `william@bookshare.local` was reset through the recovery flow so the credential was known and the account state was controlled.
- That recovery prep is not part of the primary login chain below.

## Current Login Shape

The live login flow exposed only the password path:

```json
{
  "id": "38df5371-4bfe-4aaa-bc83-79bb1174796c",
  "state": "choose_method",
  "ui": {
    "action": "http://localhost:4433/self-service/login?flow=38df5371-4bfe-4aaa-bc83-79bb1174796c",
    "nodes": [
      { "group": "default",  "name": "csrf_token", "type": "hidden" },
      { "group": "default",  "name": "identifier", "type": "text", "required": true },
      { "group": "password", "name": "password",   "type": "password", "required": true },
      { "group": "password", "name": "method",     "type": "submit",   "value": "password" }
    ]
  }
}
```

This confirms the current login UX is:

1. email
2. password
3. no passwordless code login branch

## End-To-End Redirect Chain

```text
GET  /api/auth/login?returnTo=/browse
  -> 307 http://localhost:4444/oauth2/auth?...prompt=login&max_age=0
  -> 302 http://localhost:3337/oauth/login?login_challenge=...
  -> 307 http://localhost:3337/login?return_to=http://localhost:3337/oauth/login?login_challenge=...
  -> 307 http://localhost:4433/self-service/login/browser?return_to=http://localhost:3337/oauth/login?login_challenge=...
  -> 303 http://localhost:3337/login?flow=38df5371-4bfe-4aaa-bc83-79bb1174796c
POST http://localhost:4433/self-service/login?flow=38df5371-4bfe-4aaa-bc83-79bb1174796c
  -> 303 http://localhost:3337/oauth/login?login_challenge=...
  -> 307 http://localhost:4444/oauth2/auth?...login_verifier=...
  -> 302 http://localhost:3337/oauth/consent?consent_challenge=...
  -> 307 http://localhost:4444/oauth2/auth?...consent_verifier=...
  -> 303 http://localhost:3334/api/auth/callback?code=...&state=...
  -> 307 http://localhost:3334/browse
  -> 200 /browse
```

## Flow Trace

### Stage 1: Web App Starts OIDC Login

Request:

```http
GET /api/auth/login?returnTo=/browse
```

Response:

```http
HTTP/1.1 307 Temporary Redirect
Location: http://localhost:4444/oauth2/auth?redirect_uri=http%3A%2F%2Flocalhost%3A3334%2Fapi%2Fauth%2Fcallback&scope=openid+profile+email+offline_access&code_challenge=...&code_challenge_method=S256&state=...&prompt=login&max_age=0&client_id=bookshare-web&response_type=code
Set-Cookie: oidc_code_verifier=...
Set-Cookie: oidc_state=...
Set-Cookie: oidc_return_to=...
Set-Cookie: bookshare_logged_out=; Expires=Thu, 01 Jan 1970 00:00:00 GMT
```

Meaning:

1. the web app generated PKCE state and code verifier
2. it persisted those values in encrypted cookies
3. it redirected the browser to Hydra's authorization endpoint

### Stage 2: Hydra Creates The Login Challenge

Request:

```http
GET /oauth2/auth?redirect_uri=http%3A%2F%2Flocalhost%3A3334%2Fapi%2Fauth%2Fcallback&scope=openid+profile+email+offline_access&code_challenge=...&code_challenge_method=S256&state=...&prompt=login&max_age=0&client_id=bookshare-web&response_type=code
```

Response:

```http
HTTP/1.1 302 Found
Location: http://localhost:3337/oauth/login?login_challenge=...
Set-Cookie: ory_hydra_login_csrf_dev_...=...
```

Hydra admin login-request snapshot for that challenge:

```json
{
  "skip": false,
  "subject": "",
  "requested_scope": ["openid", "profile", "email", "offline_access"],
  "requested_access_token_audience": [],
  "client": {
    "client_id": "bookshare-web",
    "redirect_uris": ["http://localhost:3334/api/auth/callback"],
    "grant_types": ["authorization_code", "refresh_token"],
    "response_types": ["code", "id_token"],
    "scope": "openid profile email offline_access",
    "skip_consent": false
  }
}
```

Important details:

1. `skip: false` means Hydra needs an interactive login decision
2. the requested scopes are exactly the BookShare OIDC scopes
3. Hydra knows nothing about the user's password here

### Stage 3: Auth Portal Sees No Kratos Session

Request:

```http
GET /oauth/login?login_challenge=...
```

Response:

```http
HTTP/1.1 307 Temporary Redirect
Location: http://localhost:3337/login?return_to=http%3A%2F%2Flocalhost%3A3337%2Foauth%2Flogin%3Flogin_challenge%3D...
```

Then:

```http
GET /login?return_to=http://localhost:3337/oauth/login?login_challenge=...
```

Response:

```http
HTTP/1.1 307 Temporary Redirect
Location: http://localhost:4433/self-service/login/browser?return_to=http%3A%2F%2Flocalhost%3A3337%2Foauth%2Flogin%3Flogin_challenge%3D...
```

Meaning:

1. the Auth Portal checked Kratos for a session
2. none existed yet
3. the browser was bounced into a Kratos browser login flow, with Hydra's challenge parked in `return_to`

### Stage 4: Kratos Initializes The Browser Login Flow

Request:

```http
GET /self-service/login/browser?return_to=http://localhost:3337/oauth/login?login_challenge=...
```

Response:

```http
HTTP/1.1 303 See Other
Location: http://localhost:3337/login?flow=38df5371-4bfe-4aaa-bc83-79bb1174796c
Set-Cookie: csrf_token_...=...
```

Fetching the flow returned:

```json
{
  "id": "38df5371-4bfe-4aaa-bc83-79bb1174796c",
  "state": "choose_method",
  "return_to": "http://localhost:3337/oauth/login?login_challenge=...",
  "ui": {
    "action": "http://localhost:4433/self-service/login?flow=38df5371-4bfe-4aaa-bc83-79bb1174796c",
    "nodes": [
      { "group": "default", "name": "csrf_token", "type": "hidden" },
      { "group": "default", "name": "identifier", "type": "text", "required": true },
      { "group": "password", "name": "password", "type": "password", "required": true },
      { "group": "password", "name": "method", "type": "submit", "value": "password" }
    ]
  }
}
```

The rendered Auth Portal HTML page showed:

1. heading `Sign in`
2. form `action="http://localhost:4433/self-service/login?flow=..."`
3. footer links `Register` and `Forgot password?`

### Stage 5: User Submits Email And Password To Kratos

Request:

```http
POST /self-service/login?flow=38df5371-4bfe-4aaa-bc83-79bb1174796c
Content-Type: application/x-www-form-urlencoded

csrf_token=Eke9cCCAImFdzmN5Tgs5dm6AMhsPJbslkW1S%2BgPr99NzLNsEfNp4TUAY6CpwFr6ofT%2BzMdTGGclkCZIS89SVtQ%3D%3D
identifier=william%40bookshare.local
password=TracePassw0rd%212026
method=password
```

Response:

```http
HTTP/1.1 303 See Other
Location: http://localhost:3337/oauth/login?login_challenge=...
Set-Cookie: ory_kratos_session=...; HttpOnly; SameSite=Lax
```

Immediately after that, `GET /sessions/whoami` returned:

```json
{
  "id": "9220c826-5150-43ff-9081-a27105f4144a",
  "active": true,
  "authentication_methods": [
    {
      "method": "password",
      "aal": "aal1",
      "completed_at": "2026-03-20T05:22:34.697748881Z"
    }
  ],
  "identity": {
    "id": "82f166e5-e2da-4e5b-a8cc-8d03c6ed20e6",
    "traits": {
      "email": "william@bookshare.local",
      "gender": "male",
      "name": {
        "first": "William",
        "last": "Gerald"
      }
    },
    "verifiable_addresses": [
      {
        "value": "william@bookshare.local",
        "verified": true,
        "status": "completed"
      }
    ]
  }
}
```

Meaning:

1. Kratos validated the password
2. Kratos created the browser session
3. the identity is verified and profile-complete, so the Auth Portal can safely resume Hydra login

### Stage 6: Auth Portal Accepts Hydra's Login Challenge

Request:

```http
GET /oauth/login?login_challenge=...
Cookie: ory_kratos_session=...
```

Response:

```http
HTTP/1.1 307 Temporary Redirect
Location: http://localhost:4444/oauth2/auth?...&login_verifier=...
```

This is the Auth Portal's decision point:

1. session exists
2. email is verified
3. profile is complete

So instead of redirecting to `/login`, `/verification`, or `/settings?section=profile`, it accepts Hydra's login request.

### Stage 7: Hydra Produces A Consent Challenge

Request:

```http
GET /oauth2/auth?...&login_verifier=...
```

Response:

```http
HTTP/1.1 302 Found
Location: http://localhost:3337/oauth/consent?consent_challenge=...
Set-Cookie: ory_hydra_session_dev=...
Set-Cookie: ory_hydra_consent_csrf_dev_...=...
```

Hydra admin consent-request snapshot:

```json
{
  "subject": "82f166e5-e2da-4e5b-a8cc-8d03c6ed20e6",
  "requested_scope": ["openid", "profile", "email", "offline_access"],
  "requested_access_token_audience": [],
  "context": {
    "traits": {
      "email": "william@bookshare.local",
      "gender": "male",
      "name": {
        "first": "William",
        "last": "Gerald"
      }
    }
  }
}
```

Important detail:

1. the Auth Portal passed Kratos traits into Hydra's login acceptance context
2. Hydra then made those traits available on the consent request

### Stage 8: Auth Portal Auto-Accepts Consent

Request:

```http
GET /oauth/consent?consent_challenge=...
```

Response:

```http
HTTP/1.1 307 Temporary Redirect
Location: http://localhost:4444/oauth2/auth?...&consent_verifier=...
```

Then:

```http
GET /oauth2/auth?...&consent_verifier=...
```

Response:

```http
HTTP/1.1 303 See Other
Location: http://localhost:3334/api/auth/callback?code=ory_ac_...&scope=openid+profile+email+offline_access&state=...
```

Meaning:

1. the Auth Portal granted the requested scopes
2. Hydra converted that into a normal authorization code redirect to the web app callback

### Stage 9: Web Callback Exchanges The Authorization Code

Request:

```http
GET /api/auth/callback?code=ory_ac_...&scope=openid+profile+email+offline_access&state=...
```

Response:

```http
HTTP/1.1 307 Temporary Redirect
Location: http://localhost:3334/browse
Set-Cookie: oidc_code_verifier=; Expires=Thu, 01 Jan 1970 00:00:00 GMT
Set-Cookie: oidc_state=; Expires=Thu, 01 Jan 1970 00:00:00 GMT
Set-Cookie: oidc_return_to=; Expires=Thu, 01 Jan 1970 00:00:00 GMT
Set-Cookie: bookshare_session=...; HttpOnly; SameSite=Lax
Set-Cookie: bookshare_token=...; HttpOnly; SameSite=Lax
```

Meaning:

1. the web app completed the authorization-code + PKCE token exchange
2. it created BookShare's own session cookies
3. it cleared the temporary OIDC bootstrap cookies
4. it redirected to the original requested route `/browse`

### Stage 10: Final Authenticated Web Page

Request:

```http
GET /browse
Cookie: bookshare_session=...
```

Response:

```http
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
```

The resulting HTML contained the authenticated app shell and serialized user state:

```json
{
  "id": "82f166e5-e2da-4e5b-a8cc-8d03c6ed20e6",
  "email": "william@bookshare.local",
  "name": "William Gerald",
  "username": "william",
  "emailVerified": true
}
```

This proves the end result is not just a successful OAuth redirect. The final web page is already rendering with the authenticated BookShare session.

## Cookie State At The End

After the final `/browse` load, the browser cookie jar still contained:

1. `ory_kratos_session`
2. `ory_hydra_login_csrf_dev_...`
3. `ory_hydra_consent_csrf_dev_...`
4. `ory_hydra_session_dev`
5. `bookshare_session`
6. `bookshare_token`
7. `csrf_token_...`

And it no longer contained:

1. `oidc_code_verifier`
2. `oidc_state`
3. `oidc_return_to`

## What This Trace Proves

1. The web app never sees the user's password.
2. Kratos owns credential validation and the primary browser identity session.
3. The Auth Portal is the bridge between Hydra challenges and Kratos session state.
4. Hydra owns the OAuth2/OIDC login challenge, consent challenge, and authorization code.
5. The web callback owns the final BookShare app session cookies and return-to redirect.
