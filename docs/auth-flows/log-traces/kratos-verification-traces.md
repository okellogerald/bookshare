# Kratos Verification Traces

This document captures the current live verification behavior for BookShare's boxed auth flow.

Capture date:
- 2026-04-09

Environment:
- Auth Portal: `http://localhost:3337`
- Kratos public/admin: `http://localhost:4433` / `http://localhost:4434`
- Mailpit: `http://localhost:4436`
- Kratos version: `v26.2.0`

Raw artifacts from this capture:
- `/tmp/bookshare-auth-traces-1775718679/registration`
- `/tmp/bookshare-auth-traces-1775718679/login-unverified`

Trace identity:
- email: `trace.1775718679@example.com`
- verification flow id: `46d2420a-22c6-4cee-bf5e-88457ac6ca3f`

## What This Trace Proves

1. Verification is a separate auth-owned flow after registration.
2. Login of an unverified user is routed back into verification instead of Hydra.
3. Kratos uses the `code` method for verification.
4. After a correct code, the Auth Portal sends the user to `/login`.

## Entry Point 1: Registration Sends The Browser To Verification

`/registration/05-submit-password.http`:

```http
HTTP/1.1 303 See Other
Location: http://localhost:3337/verification?flow=46d2420a-22c6-4cee-bf5e-88457ac6ca3f
```

Registration is complete enough for identity creation, but not complete enough for login. Control moves into the verification route.

## Entry Point 2: Login Gate Sends Unverified Users To Verification

`/login-unverified/04-oauth-login.http`:

```http
HTTP/1.1 307 Temporary Redirect
Location: http://localhost:3337/verification
```

This is the boxed-auth gate:

1. Kratos already validated the password
2. Auth Portal still blocks the Hydra continuation
3. the next required step is verification

## Verification Flow Shape

Relevant fields from `/registration/07-verification-flow.json`:

```json
{
  "id": "46d2420a-22c6-4cee-bf5e-88457ac6ca3f",
  "state": "sent_email",
  "active": "code",
  "ui": {
    "action": "http://localhost:4433/self-service/verification?flow=46d2420a-22c6-4cee-bf5e-88457ac6ca3f",
    "nodes": [
      { "group": "code", "name": "method", "type": "hidden", "value": "code" },
      { "group": "code", "name": "code", "type": "text", "required": true },
      { "group": "code", "name": "method", "type": "submit", "value": "code" },
      { "group": "default", "name": "csrf_token", "type": "hidden" },
      { "group": "code", "name": "email", "type": "submit", "value": "trace.1775718679@example.com" }
    ],
    "messages": [
      {
        "id": 1080003,
        "text": "An email containing a verification code has been sent to the email address you provided. If you have not received an email, check the spelling of the address and make sure to use the address you registered with."
      }
    ]
  }
}
```

The verification feature converts this raw Kratos flow into its own code-step model so the Auth Portal can:

1. render a dedicated verification page
2. show resend behavior explicitly
3. keep verification isolated from registration and login UI concerns

## Verification Email

Mailpit received:

```json
{
  "Subject": "Use code 834642 to verify your account",
  "Created": "2026-04-09T07:11:20.321Z",
  "Snippet": "Verify your account with the following code: 834642 ..."
}
```

The extracted code from `/registration/08-verification-code.txt` was:

```text
834642
```

## Submit Verification Code

Submitted form data:

```http
POST /self-service/verification?flow=46d2420a-22c6-4cee-bf5e-88457ac6ca3f
Content-Type: application/x-www-form-urlencoded

csrf_token=...
method=code
code=834642
```

Response from `/registration/09-submit-verification.http`:

```http
HTTP/1.1 303 See Other
Location: http://localhost:3337/verification?flow=46d2420a-22c6-4cee-bf5e-88457ac6ca3f
```

Then requesting the verification route again with that flow returned:

```http
HTTP/1.1 307 Temporary Redirect
Location: /login
```

That is the current BookShare rule:

1. verification completes inside auth
2. no session is created by verification itself
3. the next step is always login

## Post-Verification Identity State

`/registration/10-identity-after-verification.json` showed:

```json
{
  "id": "dfc0f507-4e36-4d69-9d8a-dd02b08b825d",
  "verifiable_addresses": [
    {
      "value": "trace.1775718679@example.com",
      "verified": true,
      "status": "completed"
    }
  ]
}
```

Kratos changed the verifiable-address state. The user still needs a separate login flow afterward.
