# Kratos Registration Traces

This document captures live local traces of the registration methods currently enabled in Kratos and maps each stage to the Kratos API responses and the SQLite rows written behind the scenes.

Capture date:
- 2026-03-13

Environment:
- Kratos image: `oryd/kratos:v25.4.0`
- Database: SQLite volume mounted at `/var/lib/sqlite/db.sqlite`
- Mail sink: Mailpit at `http://localhost:4436`

Important context:
- The raw Kratos registration flow exposes both `code` and `password` methods.
- The Auth Portal only renders the `code` registration section in [apps/auth/src/app/register/page.tsx](../apps/auth/src/app/register/page.tsx).
- The `password` registration path is still enabled in Kratos itself and can be exercised directly against the public API.

## At A Glance

| Method | Used by Auth Portal UI | Identity created when | Email becomes verified when | Session created when | Password hash stored when |
|---|---|---|---|---|---|
| `code` | Yes | after correct registration code | after correct registration code | after correct registration code | later, in settings flow |
| `password` | No, hidden by UI | immediately after registration submit | later, in verification flow | immediately after registration submit | immediately after registration submit |

## Shared Raw Registration Flow

Both traces started from the same Kratos endpoint:

```http
GET /self-service/registration/browser?return_to=http://localhost:3337
```

Kratos returned:

```http
HTTP/1.1 303 See Other
Location: http://localhost:3337/register?flow={flow_id}
Set-Cookie: csrf_token_...={value}; HttpOnly; SameSite=Lax
```

Fetching the flow by ID showed that Kratos exposed both strategies in the same registration flow:

```json
{
  "state": "choose_method",
  "ui": {
    "action": "http://localhost:4433/self-service/registration?flow=...",
    "nodes": [
      { "group": "default", "name": "csrf_token", "type": "hidden" },
      { "group": "default", "name": "traits.email", "type": "email" },
      { "group": "default", "name": "traits.name.first", "type": "text" },
      { "group": "default", "name": "traits.name.last", "type": "text" },
      { "group": "default", "name": "traits.gender", "type": "text" },
      { "group": "code", "name": "method", "type": "submit", "value": "code" },
      { "group": "password", "name": "password", "type": "password" },
      { "group": "password", "name": "method", "type": "submit", "value": "password" }
    ]
  }
}
```

That means the portal is narrowing the experience at the UI layer, not by disabling the password registration branch in Kratos.

## Flow A: Code Registration

This is the registration path the Auth Portal currently uses.

Trace identity:
- test email: `codex.1773385571@example.com`
- identity id after completion: `f9c95ce2-8654-4ea2-8f89-eb85f877352f`
- registration flow id: `4db47807-f3a9-4d26-8f0f-7d599370359c`

### Stage A1: Start Browser Registration Flow

Request:

```http
GET /self-service/registration/browser?return_to=http://localhost:3337
```

Response:

```http
HTTP/1.1 303 See Other
Location: http://localhost:3337/register?flow=4db47807-f3a9-4d26-8f0f-7d599370359c
Set-Cookie: csrf_token_...=6EZeayeTY80HrXK3eoNDbYJrRSYm3IYvT1JCdX+7zU4=
```

### Stage A2: Fetch Initial Registration Flow

Request:

```http
GET /self-service/registration/flows?id=4db47807-f3a9-4d26-8f0f-7d599370359c
Cookie: csrf_token_...=6EZeayeTY80HrXK3eoNDbYJrRSYm3IYvT1JCdX+7zU4=
```

Key response fields:

```json
{
  "id": "4db47807-f3a9-4d26-8f0f-7d599370359c",
  "type": "browser",
  "expires_at": "2026-03-13T08:06:45.255071596Z",
  "return_to": "http://localhost:3337",
  "ui": {
    "action": "http://localhost:4433/self-service/registration?flow=4db47807-f3a9-4d26-8f0f-7d599370359c"
  }
}
```

Kratos state at this point:
- no identity exists for the email yet
- no session exists
- only the browser registration flow and CSRF cookie exist

### Stage A3: Submit Email With `method=code`

Request:

```http
POST /self-service/registration?flow=4db47807-f3a9-4d26-8f0f-7d599370359c
Content-Type: application/x-www-form-urlencoded

csrf_token=KKwFHIaTRLi7kYcmtLfh5XGHDsBkAtHsjIGA60s9BfPA6lt3oQAndbw89ZHONKKI8+xL5kLeV8PD08KeNIbIvQ%3D%3D
traits.email=codex.1773385571%40example.com
method=code
```

Response:

```http
HTTP/1.1 303 See Other
Location: http://localhost:3337/register?flow=4db47807-f3a9-4d26-8f0f-7d599370359c
```

### Stage A4: Flow State After Email Submission

Fetching the same flow again returned:

```json
{
  "id": "4db47807-f3a9-4d26-8f0f-7d599370359c",
  "state": "sent_email",
  "active": "code",
  "ui": {
    "messages": [
      {
        "id": 1040005,
        "text": "A code has been sent to the address(es) you provided. If you have not received a message, check the spelling of the address and retry the registration.",
        "type": "info"
      }
    ],
    "nodes": [
      { "group": "default", "name": "csrf_token", "type": "hidden" },
      { "group": "default", "name": "traits.email", "type": "hidden", "value": "codex.1773385571@example.com" },
      { "group": "code", "name": "method", "type": "hidden", "value": "code" },
      { "group": "code", "name": "code", "type": "text" },
      { "group": "code", "name": "method", "type": "submit", "value": "code" },
      { "group": "code", "name": "resend", "type": "submit", "value": "code" }
    ]
  }
}
```

Mailpit received:

```text
Subject: Use code 141153 to complete your account registration
Body:    Complete your account registration with the following code: 141153
```

Kratos state after this stage:
- `GET /sessions/whoami` returned `401 Unauthorized`
- `GET /admin/identities` still returned no identity for `codex.1773385571@example.com`
- a row had been issued in `identity_registration_codes`

### Stage A5: Submit Registration Code

Request:

```http
POST /self-service/registration?flow=4db47807-f3a9-4d26-8f0f-7d599370359c
Content-Type: application/x-www-form-urlencoded

csrf_token=57tZxXzdbd6HJzD9Ba+T9ld43FEdek+MD+7X3mzbwaUP%2FQeuW04OE4CKQkp%2FLNCb1ROZdzumyaNAvJWrE2AM6w%3D%3D
traits.email=codex.1773385571%40example.com
method=code
code=141153
```

Response:

```http
HTTP/1.1 303 See Other
Location: http://localhost:3337
Set-Cookie: ory_kratos_session=...; HttpOnly; SameSite=Lax
```

Note:
- this trace used an explicit `return_to=http://localhost:3337`, so Kratos redirected there
- in the app-driven path, if no explicit `return_to` overrides it, the configured registration return URL is `/setup`

### Stage A6: Immediate Post-Code State

`GET /sessions/whoami` now returned:

```json
{
  "active": true,
  "authentication_methods": [
    {
      "method": "code",
      "aal": "aal1",
      "completed_at": "2026-03-13T07:07:50.174628959Z"
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

`GET /admin/identities/{id}` returned:

```json
{
  "id": "f9c95ce2-8654-4ea2-8f89-eb85f877352f",
  "credentials": {
    "code": {
      "type": "code",
      "identifiers": ["codex.1773385571@example.com"]
    },
    "password": {
      "type": "password",
      "identifiers": ["codex.1773385571@example.com"]
    }
  },
  "verifiable_addresses": [
    {
      "value": "codex.1773385571@example.com",
      "verified": true,
      "status": "completed"
    }
  ]
}
```

Meaning:
- the identity was created at code-verification time
- the email became verified at code-verification time
- the browser session was created at code-verification time
- the session authentication method was `code`

### Stage A7: Start Settings Flow To Write Password

Request:

```http
GET /self-service/settings/browser?return_to=http://localhost:3337
Cookie: ory_kratos_session=...
```

Response:

```http
HTTP/1.1 303 See Other
Location: http://localhost:3337/settings?flow=0a250174-fa05-49a4-8ae4-f58ffd357ddd
```

Settings flow highlights:

```json
{
  "state": "show_form",
  "ui": {
    "nodes": [
      { "group": "profile", "name": "traits.email", "type": "email", "value": "codex.1773385571@example.com" },
      { "group": "password", "name": "password", "type": "password" },
      { "group": "password", "name": "method", "type": "submit", "value": "password" }
    ]
  }
}
```

### Stage A8: Submit Password In Settings Flow

Request:

```http
POST /self-service/settings?flow=0a250174-fa05-49a4-8ae4-f58ffd357ddd
Content-Type: application/x-www-form-urlencoded

csrf_token=Nppp1mXuxyy3%2FEHbA9qHj6Cqk0%2Bt%2BsELNxYK6vnSa93DWmsr7TjOaQsnSoWSI%2Byw0Jv4tPISb2kgxPWAhyiV0A%3D%3D
password=TempPassw0rd%21234
method=password
```

Response:

```http
HTTP/1.1 303 See Other
Location: http://localhost:3337
Set-Cookie: ory_kratos_session=...; HttpOnly; SameSite=Lax
```

Settings flow state after submission:

```json
{
  "state": "success",
  "ui": {
    "messages": [
      {
        "id": 1050001,
        "text": "Your changes have been saved!",
        "type": "success"
      }
    ]
  }
}
```

### Stage A9: Fresh Password Login Verification

A fresh login flow using:

```http
identifier=codex.1773385571@example.com
password=TempPassw0rd!234
method=password
```

produced a new session with:

```json
{
  "authentication_methods": [
    {
      "method": "password",
      "aal": "aal1"
    }
  ]
}
```

So the password written in Stage A8 was the credential actually used for subsequent login.

### Stage A10: SQLite Rows Backing The Code Registration Flow

Relevant rows after the full code registration plus password setup:

```text
[identities]
('f9c95ce2-8654-4ea2-8f89-eb85f877352f', 'default', '{"email":"codex.1773385571@example.com","name":{}}', ..., 'active', ...)

[identity_verifiable_addresses]
('0cbd6edd-a0b5-4558-80ef-2c0c77226490', 'completed', 'email', 1, 'codex.1773385571@example.com', '2026-03-13 07:07:50.033064042+00:00', ...)

[identity_recovery_addresses]
('61af0371-39d4-4c61-9698-1c93747a6bc1', 'email', 'codex.1773385571@example.com', ...)

[identity_registration_codes]
('80bbc0f0-fa7b-4379-ba08-19652b3a2f67', '9393a30e13ad2d78429229676e4cd6c23fbef014b651799e049184979b9f6a56', 'codex.1773385571@example.com', '2026-03-13 07:07:50.003653709+00:00', '2026-03-13 08:07:30.38958363+00:00', '2026-03-13 07:07:30.38958363+00:00', '4db47807-f3a9-4d26-8f0f-7d599370359c', ...)

[selfservice_registration_flows]
('4db47807-f3a9-4d26-8f0f-7d599370359c', ..., 'code', 'passed_challenge', 'http://localhost:4433/self-service/registration/browser?return_to=http://localhost:3337', 1, ...)

[sessions]
('8f8850dc-6cff-4b02-a515-9623df4ee24d', ..., 'f9c95ce2-8654-4ea2-8f89-eb85f877352f', 1, 'aal1', '[{"method":"code","aal":"aal1","completed_at":"2026-03-13T07:07:50.174628959Z"}]')
```

Credential rows after the password was set:

```text
[identity_credentials]
password: ('14692a92-6349-45ef-b0e3-a3b7bb386195', '{"hashed_password":"$2a$08$XY5XGRkznQ1U6effSMnDNeFYmiIeScahr2ajYns4L9inNIUKfGDR2"}', ...)
code:     ('ae2f5209-9634-46b8-8b17-1bbd956171a1', '{"addresses":[{"channel":"email","address":"codex.1773385571@example.com"}]}', ...)

[identity_credential_identifiers]
code identifier row created at:     2026-03-13 07:07:50.157587+00:00
password identifier row created at: 2026-03-13 07:08:18.243728+00:00
```

Important nuance:
- the admin API showed `credentials.password.identifiers` immediately after code registration
- the backing `identity_credential_identifiers` row for `password` was only observed after the password was actually saved
- the password credential row existed before the password hash was finalized, because its `created_at` was at registration-complete time and its `updated_at` changed only when settings wrote the password

## Flow B: Password Registration

This path is available in raw Kratos because `password` registration is enabled, but the Auth Portal currently hides it by only rendering the `code` section.

Trace identity:
- test email: `codex.password.1773387193@example.com`
- identity id after completion: `08b8cc73-00d6-4d89-95ab-dd75ae211143`
- registration flow id: `61351b19-d2e0-4413-b947-a23c0ae91e6a`
- verification flow id: `065f20ba-b998-4d0e-8393-cbc7b68e6009`

### Stage B1: Start Browser Registration Flow

Request:

```http
GET /self-service/registration/browser?return_to=http://localhost:3337
```

Response:

```http
HTTP/1.1 303 See Other
Location: http://localhost:3337/register?flow=61351b19-d2e0-4413-b947-a23c0ae91e6a
```

The fetched flow again exposed both `code` and `password` methods.

### Stage B2: Submit Email And Password Directly

Request:

```http
POST /self-service/registration?flow=61351b19-d2e0-4413-b947-a23c0ae91e6a
Content-Type: application/x-www-form-urlencoded

csrf_token=Q2jM5j1pigd2lb9dsrD272onNghORGUqkRy7pGWcWzlmvH8Z5Pxa7y%2FVAHTDf5iN%2FMrnIxgkwwIP9DWcSnFakA%3D%3D
traits.email=codex.password.1773387193%40example.com
password=TempPassw0rd%21234
method=password
```

Response:

```http
HTTP/1.1 303 See Other
Location: http://localhost:3337/verification?flow=065f20ba-b998-4d0e-8393-cbc7b68e6009
Set-Cookie: ory_kratos_session=...; HttpOnly; SameSite=Lax
```

This is the configured behavior from the `registration.after.password` hooks:
- create a session immediately
- send the user into the verification UI

### Stage B3: Immediate Post-Registration State

`GET /sessions/whoami` immediately returned:

```json
{
  "active": true,
  "authentication_methods": [
    {
      "method": "password",
      "aal": "aal1",
      "completed_at": "2026-03-13T07:33:53.924964377Z"
    }
  ],
  "identity": {
    "id": "08b8cc73-00d6-4d89-95ab-dd75ae211143",
    "traits": {
      "email": "codex.password.1773387193@example.com",
      "name": {}
    },
    "verifiable_addresses": [
      {
        "value": "codex.password.1773387193@example.com",
        "verified": false,
        "status": "sent"
      }
    ]
  }
}
```

`GET /admin/identities/{id}` immediately returned:

```json
{
  "credentials": {
    "code": {
      "type": "code",
      "identifiers": ["codex.password.1773387193@example.com"]
    },
    "password": {
      "type": "password",
      "identifiers": ["codex.password.1773387193@example.com"]
    }
  },
  "verifiable_addresses": [
    {
      "value": "codex.password.1773387193@example.com",
      "verified": false,
      "status": "sent"
    }
  ]
}
```

Meaning:
- the identity already existed
- the password-backed session already existed
- the email was not verified yet
- the verification process had already been started

### Stage B4: Fetch Verification Flow Triggered By Registration

Request:

```http
GET /self-service/verification/flows?id=065f20ba-b998-4d0e-8393-cbc7b68e6009
Cookie: ory_kratos_session=...
```

Response:

```json
{
  "id": "065f20ba-b998-4d0e-8393-cbc7b68e6009",
  "state": "sent_email",
  "active": "code",
  "return_to": "http://localhost:3337",
  "ui": {
    "action": "http://localhost:4433/self-service/verification?flow=065f20ba-b998-4d0e-8393-cbc7b68e6009",
    "messages": [
      {
        "id": 1080003,
        "text": "An email containing a verification code has been sent to the email address you provided. If you have not received an email, check the spelling of the address and make sure to use the address you registered with.",
        "type": "info"
      }
    ],
    "nodes": [
      { "group": "code", "name": "method", "type": "hidden", "value": "code" },
      { "group": "code", "name": "code", "type": "text" },
      { "group": "code", "name": "method", "type": "submit", "value": "code" },
      { "group": "default", "name": "csrf_token", "type": "hidden" },
      { "group": "code", "name": "email", "type": "submit", "value": "codex.password.1773387193@example.com" }
    ]
  }
}
```

Mailpit received:

```text
Subject: Use code 206412 to verify your account
Body:    Verify your account with the following code: 206412
Link:    http://localhost:4433/self-service/verification?code=206412&flow=065f20ba-b998-4d0e-8393-cbc7b68e6009
```

### Stage B5: Submit Verification Code

Request:

```http
POST /self-service/verification?flow=065f20ba-b998-4d0e-8393-cbc7b68e6009
Content-Type: application/x-www-form-urlencoded

csrf_token=DK40bAowNd6%2Fio5ykmRw5VUtyTUsKhIr4arSjxjWvO0qQYHGke%2B2NaoUz70j68uHe0Lp6uYZhoHK9%2Fw3fl4PCw%3D%3D
method=code
code=206412
```

Response:

```http
HTTP/1.1 303 See Other
Location: http://localhost:3337/verification?flow=065f20ba-b998-4d0e-8393-cbc7b68e6009
```

Fetching the verification flow again then showed:

```json
{
  "state": "passed_challenge",
  "active": "code",
  "return_to": "http://localhost:3337",
  "ui": {
    "messages": [
      {
        "id": 1080002,
        "text": "You successfully verified your email address.",
        "type": "success"
      }
    ]
  }
}
```

### Stage B6: Post-Verification State

`GET /admin/identities/{id}` then returned:

```json
{
  "verifiable_addresses": [
    {
      "value": "codex.password.1773387193@example.com",
      "verified": true,
      "status": "completed",
      "verified_at": "2026-03-13T07:34:22.827330376Z"
    }
  ]
}
```

The existing session remained a password-authenticated session:

```json
{
  "authentication_methods": [
    {
      "method": "password",
      "aal": "aal1"
    }
  ]
}
```

So verification changed the address verification state, not the active authentication method or the password credential.

### Stage B7: SQLite Rows Backing The Password Registration Flow

Relevant rows after password registration and later verification:

```text
[identities]
('08b8cc73-00d6-4d89-95ab-dd75ae211143', 'default', '{"email":"codex.password.1773387193@example.com","name":{}}', ..., 'active', ...)

[identity_credentials]
password: ('dc5c3fee-9c29-4f5a-a049-84ffe4e844af', '{"hashed_password":"$2a$08$I.tpKG7o/GBiuJKB5kZAseHd4q2eR7mfCmnHcQMgnjkEVS2Ps6Jna"}', ...)
code:     ('3d8b8b0a-36ac-44ed-806d-2260514a4948', '{"addresses":[{"channel":"email","address":"codex.password.1773387193@example.com"}]}', ...)

[identity_credential_identifiers]
password identifier row created at: 2026-03-13 07:33:53.920294+00:00
code identifier row created at:     2026-03-13 07:33:53.920299+00:00

[identity_verifiable_addresses]
before verification: status='sent', verified=0
after verification:  status='completed', verified=1, verified_at='2026-03-13 07:34:22.827330376+00:00'

[identity_verification_codes]
('89e478e1-7e34-461a-a0d3-d6200b21e9f1', 'eda7475a7e1db622dfbee389d4506458a07b613ddfb6e41e0756517e46a730c6', '2026-03-13 07:34:22.825002876+00:00', '2026-03-13 08:33:53.932527335+00:00', '2026-03-13 07:33:53.932527335+00:00', '065f20ba-b998-4d0e-8393-cbc7b68e6009', 'codex.password.1773387193@example.com', '11288d84-0ea5-41cf-939a-7e165838b155')

[selfservice_verification_flows]
('065f20ba-b998-4d0e-8393-cbc7b68e6009', ..., 'code', 'passed_challenge', 'http://localhost:4433/self-service/registration/browser?return_to=http%3A%2F%2Flocalhost%3A3337', 1)

[sessions]
('598bb3fc-f4db-4e06-a9d6-09aa688a2267', ..., '08b8cc73-00d6-4d89-95ab-dd75ae211143', 1, 'aal1', '[{"method":"password","aal":"aal1","completed_at":"2026-03-13T07:33:53.924964377Z"}]')
```

Observed nuance:
- the password registration flow wrote the password hash immediately
- the verification flow later wrote the verification challenge state
- both `code` and `password` credential types still existed because the identity schema declares both

## What This Means For Configuration

1. `credentials.code` is not only for "login with code".
In this setup it also underpins:
- code registration
- code verification
- code recovery

2. The current Auth Portal behavior is stricter than raw Kratos behavior.
- the portal only renders the `code` registration path
- raw Kratos still accepts password registration directly

3. The meaning of "user is registered" differs by method.
- code registration: identity is not created until the correct code is submitted
- password registration: identity is created immediately on registration submit

4. Email verification state is separate from password credential state.
- code registration verifies the email before the password is written
- password registration writes the password before the email is verified

5. Session creation is also method-dependent.
- code registration creates a `code`-authenticated session after the code challenge passes
- password registration creates a `password`-authenticated session immediately

## Local Artifacts

Raw trace files from this capture were written to:
- `/tmp/kratos-trace-1773385571`
- `/tmp/kratos-login-trace-1773385571`
- `/tmp/kratos-password-reg-trace-1773387193`

These include raw headers, flow payloads, cookies, and intermediate responses captured during the trace.
