# Kratos Recovery Traces

This document captures a live local trace of the password-recovery flow and maps each stage to the Kratos API responses and the SQLite rows written behind the scenes.

Capture date:
- 2026-03-13

Environment:
- Kratos image: `oryd/kratos:v25.4.0`
- Database: SQLite volume mounted at `/var/lib/sqlite/db.sqlite`
- Mail sink: Mailpit at `http://localhost:4436`

Important context:
- Recovery uses the Kratos `code` method.
- After a correct recovery code, Kratos creates a privileged `code_recovery` session and redirects into the settings flow.
- The resulting settings flow still contains both `profile` and `password` sections, so the Auth Portal must choose the correct section.

Test account used for the trace:
- email: `codex.1773385571@example.com`
- identity id: `f9c95ce2-8654-4ea2-8f89-eb85f877352f`

## At A Glance

| Stage | Kratos object created or updated | Key effect |
|---|---|---|
| Recovery flow start | `selfservice_recovery_flows` row | browser recovery flow created |
| Email submitted | `identity_recovery_codes` row | emailed recovery code challenge created |
| Recovery code accepted | `sessions` row | privileged session created with `method=code_recovery` |
| Recovery-created settings flow | `selfservice_settings_flows` row | password reset must happen through settings |
| New password submitted | `identity_credentials.password.config` | bcrypt hash replaced |

## Flow Trace

Trace IDs:
- recovery flow id: `b64f1b19-8eff-4132-9921-12da8ada424a`
- recovery-created settings flow id: `1c33d1fa-4112-4a37-997a-95b4a010ffcd`
- recovery session id: `6d3e9693-5c30-41a4-a836-09514245985d`
- recovery mail id: `PMuh33J2jMxNSofNhp2kUH`

### Stage 1: Start Recovery Flow

Request:

```http
GET /self-service/recovery/browser?return_to=http://localhost:3337
```

Response:

```http
HTTP/1.1 303 See Other
Location: http://localhost:3337/recovery?flow=b64f1b19-8eff-4132-9921-12da8ada424a
Set-Cookie: csrf_token_...=IvQ3t85Ts13W51LUKsSVRPBCKJV1ueyXI+lCUNX2hoo=
```

### Stage 2: Fetch Initial Recovery Flow

Request:

```http
GET /self-service/recovery/flows?id=b64f1b19-8eff-4132-9921-12da8ada424a
Cookie: csrf_token_...=IvQ3t85Ts13W51LUKsSVRPBCKJV1ueyXI+lCUNX2hoo=
```

Key response fields:

```json
{
  "id": "b64f1b19-8eff-4132-9921-12da8ada424a",
  "state": "choose_method",
  "expires_at": "2026-03-13T11:08:03.973524255Z",
  "return_to": "http://localhost:3337",
  "ui": {
    "action": "http://localhost:4433/self-service/recovery?flow=b64f1b19-8eff-4132-9921-12da8ada424a",
    "nodes": [
      { "group": "default", "name": "csrf_token", "type": "hidden" },
      { "group": "code", "name": "email", "type": "email", "required": true },
      { "group": "code", "name": "method", "type": "submit", "value": "code" }
    ]
  }
}
```

Kratos state at this point:
- no privileged session exists yet
- no recovery code exists for this flow yet

`GET /sessions/whoami` returned:

```http
HTTP/1.1 401 Unauthorized
```

### Stage 3: Submit Recovery Email

Request:

```http
POST /self-service/recovery?flow=b64f1b19-8eff-4132-9921-12da8ada424a
Content-Type: application/x-www-form-urlencoded

csrf_token=dYiy8RRTYPeexBfJus%2Bkxg4q9XGPKo8MBBdMamjFhV9XfIVG2gDTqkgjRR2QCzGC%2Fmjd5PqTY5sn%2Fg46vTMD1Q%3D%3D
email=codex.1773385571%40example.com
method=code
```

Response:

```http
HTTP/1.1 303 See Other
Location: http://localhost:3337/recovery?flow=b64f1b19-8eff-4132-9921-12da8ada424a
```

### Stage 4: Flow State After Email Submission

Fetching the same flow again returned:

```json
{
  "id": "b64f1b19-8eff-4132-9921-12da8ada424a",
  "state": "sent_email",
  "active": "code",
  "ui": {
    "messages": [
      {
        "id": 1060003,
        "text": "An email containing a recovery code has been sent to the email address you provided. If you have not received an email, check the spelling of the address and make sure to use the address you registered with.",
        "type": "info"
      }
    ],
    "nodes": [
      { "group": "default", "name": "csrf_token", "type": "hidden" },
      { "group": "code", "name": "code", "type": "text", "required": true },
      { "group": "code", "name": "method", "type": "hidden", "value": "code" },
      { "group": "code", "name": "method", "type": "submit", "value": "code" },
      { "group": "code", "name": "email", "type": "submit", "value": "codex.1773385571@example.com" }
    ]
  }
}
```

Mailpit received:

```text
Subject: Use code 093334 to recover access to your account
Body:    Recover access to your account by entering the following code: 093334
```

Kratos state after this stage:
- still no session
- a recovery-code row had been created in `identity_recovery_codes`

### Stage 5: Submit Recovery Code

Request:

```http
POST /self-service/recovery?flow=b64f1b19-8eff-4132-9921-12da8ada424a
Content-Type: application/x-www-form-urlencoded

csrf_token=JsXfr7Omw1GCwwVeIcIH0fZ1XObeBzW1zvQalHgcTtkEMegYffVwDFQkV4oLBpKVBjd0c6u%2B2SLtHVjErerIUw%3D%3D
method=code
code=093334
```

Response:

```http
HTTP/1.1 303 See Other
Location: http://localhost:3337/settings?flow=1c33d1fa-4112-4a37-997a-95b4a010ffcd
Set-Cookie: ory_kratos_session=...; HttpOnly; SameSite=Lax
```

This is the key transition:
- the recovery flow itself does not write the new password
- it creates a privileged session and sends the browser into the settings flow

### Stage 6: Immediate Post-Recovery Session

`GET /sessions/whoami` immediately after the recovery code returned:

```json
{
  "id": "6d3e9693-5c30-41a4-a836-09514245985d",
  "active": true,
  "authentication_methods": [
    {
      "method": "code_recovery",
      "aal": "aal1",
      "completed_at": "2026-03-13T10:08:33.983639297Z"
    }
  ],
  "identity": {
    "id": "f9c95ce2-8654-4ea2-8f89-eb85f877352f",
    "traits": {
      "email": "codex.1773385571@example.com",
      "name": {}
    }
  }
}
```

Important detail:
- the session method is `code_recovery`
- this is the cleanest signal that the following settings flow is a password-reset flow, not a normal account-settings visit

### Stage 7: Fetch Recovery-Created Settings Flow

Request:

```http
GET /self-service/settings/flows?id=1c33d1fa-4112-4a37-997a-95b4a010ffcd
Cookie: ory_kratos_session=...
```

Key response fields:

```json
{
  "id": "1c33d1fa-4112-4a37-997a-95b4a010ffcd",
  "state": "show_form",
  "return_to": "http://localhost:3337",
  "identity": {
    "id": "f9c95ce2-8654-4ea2-8f89-eb85f877352f",
    "traits": {
      "email": "codex.1773385571@example.com",
      "name": {}
    }
  },
  "ui": {
    "messages": [
      {
        "id": 1060001,
        "text": "You successfully recovered your account. Please change your password or set up an alternative login method (e.g. social sign in) within the next 15.00 minutes.",
        "type": "success"
      }
    ],
    "nodes": [
      { "group": "default", "name": "csrf_token", "type": "hidden" },
      { "group": "profile", "name": "traits.email", "type": "email" },
      { "group": "profile", "name": "traits.name.first", "type": "text" },
      { "group": "profile", "name": "traits.name.last", "type": "text" },
      { "group": "profile", "name": "traits.gender", "type": "text" },
      { "group": "profile", "name": "method", "type": "submit", "value": "profile" },
      { "group": "password", "name": "password", "type": "password", "autocomplete": "new-password" },
      { "group": "password", "name": "method", "type": "submit", "value": "password" }
    ]
  }
}
```

This is the exact point where the UI bug happened:
- Kratos included both `profile` and `password` sections
- the Auth Portal settings page was hard-coded to render `sectionGroups={["profile"]}`
- the recovery-reset path therefore showed profile fields instead of the new-password form

### Stage 8: Submit New Password

Request:

```http
POST /self-service/settings?flow=1c33d1fa-4112-4a37-997a-95b4a010ffcd
Content-Type: application/x-www-form-urlencoded

csrf_token=C2t%2FlyIvyfaww%2BMDGzjWq%2BgforoFMDoZJ4K7n%2FdCzwlGwuxySXEZ8g3C1dKrMk5qQaC2fz7YauUvtvpTqv84SA%3D%3D
password=RecoveredPassw0rd%219
method=password
```

Response:

```http
HTTP/1.1 303 See Other
Location: http://localhost:3337
Set-Cookie: ory_kratos_session=...; HttpOnly; SameSite=Lax
```

Fetching the same settings flow after the password write returned:

```json
{
  "id": "1c33d1fa-4112-4a37-997a-95b4a010ffcd",
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

### Stage 9: Password Credential Update

The password credential row for the identity was updated in place:

```text
[identity_credentials]
('79f0e884-b6e1-4ea0-8fc2-d274af34148f', '{"hashed_password":"$2a$08$strTRNCvn1rIULbsb7jvYemkLAnjIA89PUD1sKovUYFOykewf3q6a"}', '78c1b41d-8341-4507-aa60-aff1d4369670', 'f9c95ce2-8654-4ea2-8f89-eb85f877352f', '2026-03-13 07:07:50.150135+00:00', '2026-03-13 10:09:05.511729+00:00', 0)
```

What changed:
- same credential row id
- same credential type (`password`)
- new bcrypt hash stored in `config.hashed_password`
- `updated_at` moved to the password-reset timestamp

The recovery session remained a `code_recovery` session:

```text
[sessions_latest]
('6d3e9693-5c30-41a4-a836-09514245985d', ..., '[{"method":"code_recovery","aal":"aal1","completed_at":"2026-03-13T10:08:33.983639297Z"}]')
```

## SQLite Rows Backing The Recovery Flow

### Recovery Flow Row

```text
[selfservice_recovery_flows]
('b64f1b19-8eff-4132-9921-12da8ada424a', '2026-03-13 10:08:03.973524255+00:00', '2026-03-13 11:08:03.973524255+00:00', 'code', 'passed_challenge', 'http://localhost:4433/self-service/recovery/browser?return_to=http://localhost:3337', 1, ...)
```

### Recovery Code Row

```text
[identity_recovery_codes]
('45504cbf-53f4-43fb-8d1e-52bddd579db9', '878a309e5f04fb8c61e7cd71f7f67739a15ad6377f1485e7c698eb7987b2810f', '2026-03-13 10:08:33.972588922+00:00', '61af0371-39d4-4c61-9698-1c93747a6bc1', 2, '2026-03-13 11:08:21.515841347+00:00', '2026-03-13 10:08:21.515841347+00:00', 'b64f1b19-8eff-4132-9921-12da8ada424a', '2026-03-13 10:08:21.516133+00:00', '2026-03-13 10:08:21.516133+00:00', '4cb872d0-d168-467a-9cb2-f1eb45a8dd39', 'f9c95ce2-8654-4ea2-8f89-eb85f877352f')
```

Important details:
- the database row did not store the plaintext recovery code
- `used_at` was populated only after the correct code was submitted
- the row linked the challenge to both the flow and the identity

### Recovery-Created Settings Flow Row

```text
[selfservice_settings_flows]
('1c33d1fa-4112-4a37-997a-95b4a010ffcd', '2026-03-13 10:08:33.988346214+00:00', '2026-03-13 11:08:33.988346214+00:00', 'success', 'http://localhost:4433/self-service/recovery?flow=b64f1b19-8eff-4132-9921-12da8ada424a&return_to=http%3A%2F%2Flocalhost%3A3337', ...)
```

Important detail:
- the settings flow `request_url` clearly pointed back to the recovery flow origin
- this is another strong indicator that the settings visit came from account recovery, not from a normal profile-settings action

## Auth Portal Fix

The fix applied in the Auth Portal is:
- detect recovery-created settings visits using the Kratos session method `code_recovery`
- render the `password` section instead of the `profile` section
- redirect to `/login` after a successful reset rather than dropping back into profile settings

Relevant files:
- [settings/page.tsx](../apps/auth/src/app/settings/page.tsx)
- [kratos.ts](../apps/auth/src/lib/kratos.ts)

## What This Means

1. Recovery does not have its own separate "reset password" flow in Kratos.
- It transitions into the settings flow after the recovery challenge passes.

2. The settings flow is multi-section even in recovery.
- Kratos still includes both `profile` and `password`.
- The UI has to choose the correct section based on context.

3. The correct recovery context signal is the session method.
- normal settings: typically `password` or `code`
- recovery-created settings: `code_recovery`

4. Password reset changes the password credential, not the recovery session method.
- the session remained `code_recovery`
- the password hash changed in `identity_credentials`

## Local Artifacts

Raw trace files from this capture were written to:
- `/tmp/kratos-recovery-trace-1773396461`

These include raw headers, flow payloads, cookies, and intermediate responses captured during the trace.
