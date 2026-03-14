# Kratos Login Traces

This document captures live local traces of the login methods currently enabled in Kratos and maps each stage to the Kratos API responses and the SQLite rows written behind the scenes.

Capture date:
- 2026-03-13

Environment:
- Kratos image: `oryd/kratos:v25.4.0`
- Database: SQLite volume mounted at `/var/lib/sqlite/db.sqlite`
- Mail sink: Mailpit at `http://localhost:4436`

Important context:
- The raw Kratos login flow exposes both `password` and `code` methods.
- The Auth Portal only renders the `password` login section in [apps/auth/src/app/login/page.tsx](../apps/auth/src/app/login/page.tsx).
- Because `selfservice.methods.code.passwordless_enabled` is still `true` in [infra/ory/kratos/kratos.yml](../infra/ory/kratos/kratos.yml), raw Kratos still accepts code login directly on the public API.

Test account used for both traces:
- email: `codex.1773385571@example.com`
- identity id: `f9c95ce2-8654-4ea2-8f89-eb85f877352f`
- email state before login: verified
- password state before login: set

## At A Glance

| Method | Used by Auth Portal UI | Requires emailed code | Session created when | Session `authentication_methods` | Identity data changed |
|---|---|---|---|---|---|
| `password` | Yes | No | immediately after correct password | `password` | No |
| `code` | No, hidden by UI | Yes | immediately after correct login code | `code` | No |

## Shared Raw Login Flow

Both traces started from:

```http
GET /self-service/login/browser?return_to=http://localhost:3337
```

Kratos returned:

```http
HTTP/1.1 303 See Other
Location: http://localhost:3337/login?flow={flow_id}
Set-Cookie: csrf_token_...={value}; HttpOnly; SameSite=Lax
```

Fetching the flow by ID showed that Kratos exposed both login strategies in the same flow:

```json
{
  "state": "choose_method",
  "ui": {
    "action": "http://localhost:4433/self-service/login?flow=...",
    "nodes": [
      { "group": "default", "name": "csrf_token", "type": "hidden" },
      { "group": "default", "name": "identifier", "type": "text" },
      { "group": "code", "name": "method", "type": "submit", "value": "code" },
      { "group": "password", "name": "password", "type": "password" },
      { "group": "password", "name": "method", "type": "submit", "value": "password" }
    ]
  }
}
```

That means the Auth Portal is narrowing login to password at the UI layer, not by removing code login from Kratos itself.

## Flow A: Password Login

This is the login path the Auth Portal currently uses.

Trace identity:
- login flow id: `1283293f-e5d0-4519-acdf-5c21bda4ccd1`
- resulting session id: `4300503d-6e88-4856-94d1-6879daef244d`

### Stage A1: Start Browser Login Flow

Request:

```http
GET /self-service/login/browser?return_to=http://localhost:3337
```

Response:

```http
HTTP/1.1 303 See Other
Location: http://localhost:3337/login?flow=1283293f-e5d0-4519-acdf-5c21bda4ccd1
Set-Cookie: csrf_token_...=wT+FyfFxr0+JrBlgugmfZklej8VHDQNNV/g0w+4Ici8=
```

### Stage A2: Fetch Initial Login Flow

Request:

```http
GET /self-service/login/flows?id=1283293f-e5d0-4519-acdf-5c21bda4ccd1
Cookie: csrf_token_...=wT+FyfFxr0+JrBlgugmfZklej8VHDQNNV/g0w+4Ici8=
```

Key response fields:

```json
{
  "id": "1283293f-e5d0-4519-acdf-5c21bda4ccd1",
  "state": "choose_method",
  "expires_at": "2026-03-13T07:56:55.661254503Z",
  "return_to": "http://localhost:3337",
  "ui": {
    "action": "http://localhost:4433/self-service/login?flow=1283293f-e5d0-4519-acdf-5c21bda4ccd1",
    "nodes": [
      { "group": "default", "name": "csrf_token", "type": "hidden" },
      { "group": "default", "name": "identifier", "type": "text", "required": true },
      { "group": "code", "name": "method", "type": "submit", "value": "code" },
      { "group": "password", "name": "password", "type": "password", "required": true },
      { "group": "password", "name": "method", "type": "submit", "value": "password" }
    ]
  }
}
```

Kratos state at this point:
- no session exists yet for the browser
- the identity already exists and is unchanged
- no login code row exists for this flow

`GET /sessions/whoami` at this stage returned:

```http
HTTP/1.1 401 Unauthorized
```

### Stage A3: Submit Email And Password

Request:

```http
POST /self-service/login?flow=1283293f-e5d0-4519-acdf-5c21bda4ccd1
Content-Type: application/x-www-form-urlencoded

csrf_token=rGayXpCfrNnz3sAQwI8MpH8yVAuANCNYcGaCVwAsGBVtWTeXYe4Dlnpy2XB6hpPCNmzbzsc5IBUnnraU7iRqOg%3D%3D
identifier=codex.1773385571%40example.com
password=TempPassw0rd%21234
method=password
```

Response:

```http
HTTP/1.1 303 See Other
Location: http://localhost:3337
Set-Cookie: ory_kratos_session=...; HttpOnly; SameSite=Lax
```

### Stage A4: Immediate Post-Login State

`GET /sessions/whoami` now returned:

```json
{
  "id": "4300503d-6e88-4856-94d1-6879daef244d",
  "active": true,
  "authentication_methods": [
    {
      "method": "password",
      "aal": "aal1",
      "completed_at": "2026-03-13T07:47:13.085180261Z"
    }
  ],
  "identity": {
    "id": "f9c95ce2-8654-4ea2-8f89-eb85f877352f",
    "traits": {
      "email": "codex.1773385571@example.com",
      "name": {}
    },
    "verifiable_addresses": [
      {
        "value": "codex.1773385571@example.com",
        "verified": true,
        "status": "completed"
      }
    ]
  }
}
```

Meaning:
- a new browser session was created
- the session authentication method was `password`
- the identity record was reused as-is
- login did not mutate `traits`, `verifiable_addresses`, or credentials

### Stage A5: SQLite Rows Backing Password Login

Relevant rows after successful password login:

```text
[selfservice_login_flows]
('1283293f-e5d0-4519-acdf-5c21bda4ccd1', '2026-03-13 07:46:55.661254503+00:00', '2026-03-13 07:56:55.661254503+00:00', 'password', 'choose_method', 'http://localhost:4433/self-service/login/browser?return_to=http://localhost:3337', 0, ...)

[identity_login_codes]
<no rows>

[sessions_latest]
('4300503d-6e88-4856-94d1-6879daef244d', '2026-03-13 07:47:13.085339469+00:00', '2026-03-14 07:47:13.085339469+00:00', '2026-03-13 07:47:13.085339469+00:00', 'f9c95ce2-8654-4ea2-8f89-eb85f877352f', 1, 'aal1', '[{"method":"password","aal":"aal1","completed_at":"2026-03-13T07:47:13.085180261Z"}]')
```

Observed nuance:
- the `sessions` table clearly recorded the successful password login
- the `selfservice_login_flows` row still looked like the original flow and did not show the same post-submit mutation pattern that code login did
- `identity_login_codes` stayed empty, as expected for password login

## Flow B: Code Login

This path is available in raw Kratos because `code.passwordless_enabled` is still `true`, but the Auth Portal currently hides it by only rendering the password section.

Trace identity:
- login flow id: `12cfb84f-72ee-488e-ae30-a9222ee0394b`
- resulting session id: `886ab089-a291-439b-95ba-406131cc150e`
- login code mail id: `Cyxa59UF2cJYz4hfySRcVz`

### Stage B1: Start Browser Login Flow

Request:

```http
GET /self-service/login/browser?return_to=http://localhost:3337
```

Response:

```http
HTTP/1.1 303 See Other
Location: http://localhost:3337/login?flow=12cfb84f-72ee-488e-ae30-a9222ee0394b
Set-Cookie: csrf_token_...=5mVR4bSQizY/Qz7acEhYHRVufQYMIS3jKIXJvgNYMO0=
```

### Stage B2: Fetch Initial Login Flow

Request:

```http
GET /self-service/login/flows?id=12cfb84f-72ee-488e-ae30-a9222ee0394b
Cookie: csrf_token_...=5mVR4bSQizY/Qz7acEhYHRVufQYMIS3jKIXJvgNYMO0=
```

Key response fields:

```json
{
  "id": "12cfb84f-72ee-488e-ae30-a9222ee0394b",
  "state": "choose_method",
  "return_to": "http://localhost:3337",
  "ui": {
    "action": "http://localhost:4433/self-service/login?flow=12cfb84f-72ee-488e-ae30-a9222ee0394b",
    "nodes": [
      { "group": "default", "name": "csrf_token", "type": "hidden" },
      { "group": "default", "name": "identifier", "type": "text", "required": true },
      { "group": "code", "name": "method", "type": "submit", "value": "code" },
      { "group": "password", "name": "password", "type": "password", "required": true },
      { "group": "password", "name": "method", "type": "submit", "value": "password" }
    ]
  }
}
```

As in the password trace:
- `GET /sessions/whoami` returned `401 Unauthorized`
- no session existed yet

### Stage B3: Submit Identifier With `method=code`

Request:

```http
POST /self-service/login?flow=12cfb84f-72ee-488e-ae30-a9222ee0394b
Content-Type: application/x-www-form-urlencoded

csrf_token=xTzgGncC%2Bc8HnwLNXz256xcM2lQBxYPNMjbmir1hKj8jWbH7w5Jy%2BTjcPBcvdeH2AmKnUg3kri4asy80vjka0g%3D%3D
identifier=codex.1773385571%40example.com
method=code
```

Response:

```http
HTTP/1.1 303 See Other
Location: http://localhost:3337/login?flow=12cfb84f-72ee-488e-ae30-a9222ee0394b
```

### Stage B4: Flow State After Starting Code Login

Fetching the same flow again returned:

```json
{
  "id": "12cfb84f-72ee-488e-ae30-a9222ee0394b",
  "state": "sent_email",
  "active": "code",
  "ui": {
    "messages": [
      {
        "id": 1010014,
        "text": "A code was sent to the address you provided. If you didn't receive it, please check the spelling of the address and try again.",
        "type": "info"
      }
    ],
    "nodes": [
      { "group": "default", "name": "identifier", "type": "hidden", "value": "codex.1773385571@example.com" },
      { "group": "code", "name": "method", "type": "hidden", "value": "code" },
      { "group": "code", "name": "code", "type": "text", "required": true },
      { "group": "code", "name": "method", "type": "submit", "value": "code" },
      { "group": "code", "name": "resend", "type": "submit", "value": "code" },
      { "group": "default", "name": "csrf_token", "type": "hidden" }
    ]
  }
}
```

Mailpit received:

```text
Subject: Use code 359606 to log in
Body:    Login to your account with the following code: 359606
```

Kratos state after this stage:
- still no browser session
- the identity was unchanged
- a row had been issued in `identity_login_codes`

### Stage B5: Submit Login Code

Request:

```http
POST /self-service/login?flow=12cfb84f-72ee-488e-ae30-a9222ee0394b
Content-Type: application/x-www-form-urlencoded

csrf_token=ipTrCVa0lJ16lUdAvMTlWjZ9lLXWE07Jr1OCwwQKJz5s8bro4iQfq0XWeZrMjL1HIxPps9oyYyqH1kt9B1IX0w%3D%3D
identifier=codex.1773385571%40example.com
method=code
code=359606
```

Response:

```http
HTTP/1.1 303 See Other
Location: http://localhost:3337
Set-Cookie: ory_kratos_session=...; HttpOnly; SameSite=Lax
```

### Stage B6: Immediate Post-Code-Login State

`GET /sessions/whoami` now returned:

```json
{
  "id": "886ab089-a291-439b-95ba-406131cc150e",
  "active": true,
  "authentication_methods": [
    {
      "method": "code",
      "aal": "aal1",
      "completed_at": "2026-03-13T07:48:26.667914503Z"
    }
  ],
  "identity": {
    "id": "f9c95ce2-8654-4ea2-8f89-eb85f877352f",
    "traits": {
      "email": "codex.1773385571@example.com",
      "name": {}
    },
    "verifiable_addresses": [
      {
        "value": "codex.1773385571@example.com",
        "verified": true,
        "status": "completed"
      }
    ]
  }
}
```

Meaning:
- a new browser session was created only after the correct code was submitted
- the session authentication method was `code`
- the identity record was reused as-is
- code login did not change traits or verification state because the account was already verified

### Stage B7: SQLite Rows Backing Code Login

Relevant rows after successful code login:

```text
[identity_login_codes]
('32ac9cd6-f4b7-4a79-9244-ccb6a6728c43', 'a591a4f32fadf886683ab34f1fc6c8110cc788b1a7295e316e23fad3005540fb', 'codex.1773385571@example.com', '2026-03-13 07:48:26.66269692+00:00', '2026-03-13 08:48:09.742489051+00:00', '2026-03-13 07:48:09.742489051+00:00', '12cfb84f-72ee-488e-ae30-a9222ee0394b', 'f9c95ce2-8654-4ea2-8f89-eb85f877352f', '2026-03-13 07:48:09.742664+00:00', '2026-03-13 07:48:09.742664+00:00', 'email')

[selfservice_login_flows]
('12cfb84f-72ee-488e-ae30-a9222ee0394b', '2026-03-13 07:47:52.380144959+00:00', '2026-03-13 07:57:52.380144959+00:00', 'code', 'passed_challenge', 'http://localhost:4433/self-service/login/browser?return_to=http://localhost:3337', 1, ...)

[sessions_latest]
('886ab089-a291-439b-95ba-406131cc150e', '2026-03-13 07:48:26.668486753+00:00', '2026-03-14 07:48:26.668486753+00:00', '2026-03-13 07:48:26.668486753+00:00', 'f9c95ce2-8654-4ea2-8f89-eb85f877352f', 1, 'aal1', '[{"method":"code","aal":"aal1","completed_at":"2026-03-13T07:48:26.667914503Z"}]')
```

Important details:
- the login code was not stored in plaintext in the database table used for validation
- the `identity_login_codes.used_at` column was set only after the correct code was submitted
- unlike the password login flow, the code login flow row clearly moved to `state='passed_challenge'` and `submit_count=1`

## Key Differences Between Password And Code Login

1. Both methods start from the same raw Kratos login flow.
- Kratos exposes both branches together.
- The Auth Portal chooses to render only the `password` section.

2. Password login does not involve any challenge persistence outside the flow and session.
- no `identity_login_codes` row is created
- success is visible mainly in the new `sessions` row

3. Code login creates explicit challenge state in storage.
- `identity_login_codes` gets a row tied to the login flow and identity
- the code is later marked as used through `used_at`

4. Neither login method mutates the identity itself.
- `traits` did not change
- `verifiable_addresses` did not change
- credentials did not change

5. The session tells you how the user authenticated.
- password login session: `authentication_methods = [{"method":"password", ...}]`
- code login session: `authentication_methods = [{"method":"code", ...}]`

## What This Means For Configuration

1. The current portal is password-only by presentation, not by Kratos policy.
- [apps/auth/src/app/login/page.tsx](../apps/auth/src/app/login/page.tsx) renders `sectionGroups={["password"]}`
- raw Kratos still exposes `method=code`

2. If you truly do not support code login at all, the Kratos setting to revisit is:
- `selfservice.methods.code.passwordless_enabled`

3. Keeping `credentials.code` in the identity schema still has side effects beyond registration.
- with `passwordless_enabled: true`, it supports code login
- if you disable raw code login, you still need to think separately about registration, verification, and recovery behavior

## Local Artifacts

Raw trace files from this capture were written to:
- `/tmp/kratos-password-login-trace-1773391599`
- `/tmp/kratos-code-login-trace-1773391644`

These include raw headers, flow payloads, cookies, and intermediate responses captured during the trace.
