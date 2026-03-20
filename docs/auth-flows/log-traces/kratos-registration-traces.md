# Kratos Registration Traces

This document keeps the relevant local trace notes for the current registration shape.

Capture date:
- 2026-03-13

Environment:
- Kratos image: `oryd/kratos:v25.4.0`
- Database: SQLite at `/var/lib/sqlite/db.sqlite`
- Mail sink: Mailpit at `http://localhost:4436`

## Current Config Context

BookShare now keeps only the password registration path.

Current config intent:

1. `selfservice.methods.password.enabled: true`
2. `selfservice.methods.code.passwordless_enabled: false`
3. `link` not enabled
4. registration uses password, then verification uses code

So the relevant registration trace is:

1. password registration
2. email verification after registration

## Password Registration Trace

Test identity:

- email: `codex.password.1773387193@example.com`
- identity id: `08b8cc73-00d6-4d89-95ab-dd75ae211143`
- registration flow id: `61351b19-d2e0-4413-b947-a23c0ae91e6a`
- verification flow id: `065f20ba-b998-4d0e-8393-cbc7b68e6009`

### Stage 1: Start Browser Registration Flow

Request:

```http
GET /self-service/registration/browser?return_to=http://localhost:3337
```

Response:

```http
HTTP/1.1 303 See Other
Location: http://localhost:3337/register?flow=61351b19-d2e0-4413-b947-a23c0ae91e6a
Set-Cookie: csrf_token_...=...
```

### Stage 2: Fetch Registration Flow

Relevant fields:

```json
{
  "id": "61351b19-d2e0-4413-b947-a23c0ae91e6a",
  "state": "choose_method",
  "ui": {
    "action": "http://localhost:4433/self-service/registration?flow=61351b19-d2e0-4413-b947-a23c0ae91e6a",
    "nodes": [
      { "group": "default", "name": "csrf_token", "type": "hidden" },
      { "group": "default", "name": "traits.email", "type": "email" },
      { "group": "default", "name": "traits.name.first", "type": "text" },
      { "group": "default", "name": "traits.name.last", "type": "text" },
      { "group": "default", "name": "traits.gender", "type": "text" },
      { "group": "password", "name": "password", "type": "password" },
      { "group": "password", "name": "method", "type": "submit", "value": "password" }
    ]
  }
}
```

> _`group`: A frontend hint for organizing form fields_
> _`method`: The way a user authenticates. It could be: password, code, link etc_
> _In `identity.schema.json`, email is the identifier for the member and therefore must be unique_

This is the shape BookShare expects after disabling passwordless code registration.

### Stage 3: Submit Registration

Request:

```http
POST /self-service/registration?flow=61351b19-d2e0-4413-b947-a23c0ae91e6a
Content-Type: application/x-www-form-urlencoded

csrf_token=...
traits.name.first=Codex
traits.name.last=Password
traits.gender=prefer_not_to_say
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

What this means:

1. the identity is created immediately
2. the password is stored immediately
3. a session is created immediately
4. Kratos redirects straight into verification because of `show_verification_ui`

### Stage 4: Immediate Post-Registration State

`GET /sessions/whoami` immediately returned:

```json
{
  "active": true,
  "authentication_methods": [
    {
      "method": "password",
      "aal": "aal1"
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

### Stage 5: Verification Flow

Relevant verification flow shape:

```json
{
  "id": "065f20ba-b998-4d0e-8393-cbc7b68e6009",
  "state": "sent_email",
  "active": "code",
  "ui": {
    "nodes": [
      { "group": "code", "name": "method", "type": "hidden", "value": "code" },
      { "group": "code", "name": "code", "type": "text" },
      { "group": "code", "name": "method", "type": "submit", "value": "code" }
    ]
  }
}
```

Mailpit received:

```text
Subject: Use code 206412 to verify your account
Body:    Verify your account with the following code: 206412
```

### Stage 6: Submit Verification Code

After the verification code is submitted correctly, Kratos marks the address as verified and the verification flow reaches `passed_challenge`.

### Stage 7: Post-Verification State

`GET /admin/identities/{id}` then showed:

```json
{
  "verifiable_addresses": [
    {
      "value": "codex.password.1773387193@example.com",
      "verified": true,
      "status": "completed"
    }
  ]
}
```

The session remains a password-authenticated session. Verification changes the address state, not the auth method.

## SQLite Notes

Relevant persistence order:

1. identity row created
2. password credential row created
3. verifiable address created with `status='sent'`
4. verification flow/code rows created
5. address later updated to `verified=1`, `status='completed'`

## Historical Note

Older traces in this repository discussed a raw code-registration branch. That is no longer part of the intended current flow because `passwordless_enabled` is now disabled.
