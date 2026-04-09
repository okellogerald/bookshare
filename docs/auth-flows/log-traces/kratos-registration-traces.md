# Kratos Registration Traces

This document captures the current live registration behavior for BookShare's boxed auth flow.

Capture date:
- 2026-04-09

Environment:
- Web app: `http://localhost:3334`
- Auth Portal: `http://localhost:3337`
- Hydra public/admin: `http://localhost:4444` / `http://localhost:4445`
- Kratos public/admin: `http://localhost:4433` / `http://localhost:4434`
- Mailpit: `http://localhost:4436`
- Kratos version: `v26.2.0`

Raw artifacts from this capture:
- `/tmp/bookshare-auth-traces-1775718679/registration`
- `/tmp/bookshare-auth-traces-1775718679/registration-duplicate`

Trace identity:
- email: `trace.1775718679@example.com`
- identity id: `dfc0f507-4e36-4d69-9d8a-dd02b08b825d`
- registration flow id: `4edd5173-4a94-4380-b89d-1889dd688559`
- verification flow id: `46d2420a-22c6-4cee-bf5e-88457ac6ca3f`

## What This Trace Proves

1. Registration is now Kratos' default two-step flow.
2. Step 1 is a `profile` submit, not a password submit.
3. Step 2 reuses the same flow id and carries the step-1 values as hidden inputs.
4. Successful registration creates the identity and password credential, but does not create a browser session.
5. Verification is required before the user can continue to login.
6. Duplicate-email registration is reported by Kratos only after the password step is submitted.

## Stage 1: Start Browser Registration Flow

Request:

```http
GET /self-service/registration/browser
```

Response:

```http
HTTP/1.1 303 See Other
Location: http://localhost:3337/register?flow=4edd5173-4a94-4380-b89d-1889dd688559
Set-Cookie: csrf_token_...=...
```

Kratos creates a browser registration flow and sends the browser back to the Auth Portal route with a `flow` id.

## Stage 2: Initial Flow Returned To Auth

Relevant fields from `/registration/02-initial-flow.json`:

```json
{
  "id": "4edd5173-4a94-4380-b89d-1889dd688559",
  "state": "choose_method",
  "ui": {
    "action": "http://localhost:4433/self-service/registration?flow=4edd5173-4a94-4380-b89d-1889dd688559",
    "method": "POST",
    "nodes": [
      { "group": "default", "name": "csrf_token", "type": "hidden" },
      { "group": "default", "name": "traits.email", "type": "email", "required": true },
      { "group": "default", "name": "traits.name.first", "type": "text" },
      { "group": "default", "name": "traits.name.last", "type": "text" },
      { "group": "default", "name": "traits.gender", "type": "text" },
      { "group": "profile", "name": "method", "type": "submit", "value": "profile" }
    ]
  }
}
```

This is the important shift from the old one-step assumption:

1. Kratos does not expose a password field yet.
2. The first submit is `method=profile`.
3. The Auth Portal therefore converts this raw node array into a dedicated registration profile-step model.

Why the conversion is necessary:

1. Kratos returns generic UI nodes, not a stable product form contract.
2. BookShare wants a fixed field order and a dedicated profile-step form.
3. The registration feature needs to own which nodes become visible fields, hidden carry-over fields, and submit actions.

## Stage 3: Submit Profile Step

Submitted form data:

```http
POST /self-service/registration?flow=4edd5173-4a94-4380-b89d-1889dd688559
Content-Type: application/x-www-form-urlencoded

csrf_token=...
traits.email=trace.1775718679%40example.com
traits.name.first=Trace
traits.name.last=Runner
traits.gender=prefer_not_to_say
method=profile
```

Response from `/registration/03-submit-profile.http`:

```http
HTTP/1.1 303 See Other
Location: http://localhost:3337/register?flow=4edd5173-4a94-4380-b89d-1889dd688559
```

The flow id stays the same. Kratos advances the same flow into the password step rather than creating a second registration flow.

## Stage 4: Password Step On The Same Flow

Relevant fields from `/registration/04-password-flow.json`:

```json
{
  "id": "4edd5173-4a94-4380-b89d-1889dd688559",
  "state": "choose_method",
  "ui": {
    "nodes": [
      { "group": "default", "name": "csrf_token", "type": "hidden" },
      { "group": "default", "name": "traits.email", "type": "hidden", "value": "trace.1775718679@example.com" },
      { "group": "password", "name": "password", "type": "password", "required": true },
      { "group": "default", "name": "traits.name.first", "type": "hidden", "value": "Trace" },
      { "group": "default", "name": "traits.name.last", "type": "hidden", "value": "Runner" },
      { "group": "default", "name": "traits.gender", "type": "hidden", "value": "prefer_not_to_say" },
      { "group": "password", "name": "method", "type": "submit", "value": "password" },
      { "group": "profile", "name": "screen", "type": "submit", "value": "previous" }
    ],
    "messages": [
      {
        "id": 1040009,
        "text": "Please choose a credential to authenticate yourself with."
      }
    ]
  }
}
```

This is the key reason the Auth Portal keeps a dedicated registration password-step model:

1. The password form must render only the password UI.
2. The hidden profile fields must still be re-submitted to Kratos.
3. The Back action is not client navigation. It is Kratos' `screen=previous` submit node and must be kept separate from the password submit.

## Stage 5: Submit Password Step

Submitted form data:

```http
POST /self-service/registration?flow=4edd5173-4a94-4380-b89d-1889dd688559
Content-Type: application/x-www-form-urlencoded

csrf_token=...
traits.email=trace.1775718679%40example.com
traits.name.first=Trace
traits.name.last=Runner
traits.gender=prefer_not_to_say
password=TracePassw0rd2026
method=password
```

Response from `/registration/05-submit-password.http`:

```http
HTTP/1.1 303 See Other
Location: http://localhost:3337/verification?flow=46d2420a-22c6-4cee-bf5e-88457ac6ca3f
Set-Cookie: csrf_token_...=...
```

What this means:

1. Kratos created the identity.
2. Kratos created the password credential.
3. Kratos started a verification flow.
4. Kratos did not create a browser session.

That last point is confirmed by `/registration/06-whoami-after-registration.http`:

```http
HTTP/1.1 401 Unauthorized

{"error":{"code":401,"status":"Unauthorized","reason":"No valid session credentials found in the request.","message":"The request could not be authorized"}}
```

## Stage 6: Verification Flow Returned After Registration

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

Mailpit received:

```json
{
  "Subject": "Use code 834642 to verify your account",
  "Created": "2026-04-09T07:11:20.321Z",
  "Snippet": "Verify your account with the following code: 834642 ..."
}
```

The extracted verification code from `/registration/08-verification-code.txt` was:

```text
834642
```

## Stage 7: Submit Verification Code

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

Then requesting the verification page again with the same flow and CSRF cookie returned:

```http
HTTP/1.1 307 Temporary Redirect
Location: /login
```

That is the current boxed behavior:

1. verification finishes inside auth
2. auth does not sign the user in
3. auth sends the user to `/login`

`/registration/10-identity-after-verification.json` then showed:

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

## Duplicate Email Branch

BookShare also needs the duplicate-email path because this is where registration stops being a new-account flow and becomes a login or recovery problem.

Duplicate attempt:
- flow id: `2a090c8d-5c37-4720-aa38-a0e109410bc5`
- email reused: `trace.1775718679@example.com`

After the profile step, Kratos still advanced into the password step:

```http
HTTP/1.1 303 See Other
Location: http://localhost:3337/register?flow=2a090c8d-5c37-4720-aa38-a0e109410bc5
```

After the password submit, `/registration-duplicate/06-after-password.json` returned:

```json
{
  "id": "2a090c8d-5c37-4720-aa38-a0e109410bc5",
  "state": "choose_method",
  "ui": {
    "messages": [
      {
        "id": 4000007,
        "text": "An account with the same identifier (email, phone, username, ...) exists already.",
        "type": "error"
      }
    ],
    "nodes": [
      { "group": "default", "name": "traits.email", "type": "hidden", "value": "trace.1775718679@example.com" },
      { "group": "password", "name": "password", "type": "password" },
      { "group": "password", "name": "method", "type": "submit", "value": "password" },
      { "group": "profile", "name": "screen", "type": "submit", "value": "previous" }
    ]
  }
}
```

What BookShare does with that Kratos result:

1. It does not keep the user in registration.
2. It maps this into the existing-account branch.
3. It offers `Sign in`, `Reset password`, and `Try another email`.

That mapping is product-owned. Kratos only emits the raw duplicate-identifier error.
