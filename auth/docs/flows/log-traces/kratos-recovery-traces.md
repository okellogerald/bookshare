# Kratos Recovery Traces

This document captures the current live password-recovery behavior for BookShare's boxed auth flow.

Capture date:
- 2026-04-09

Environment:
- Auth Portal: `http://localhost:3337`
- Kratos public/admin: `http://localhost:4433` / `http://localhost:4434`
- Mailpit: `http://localhost:4436`
- Kratos version: `v26.2.0`

Raw artifacts from this capture:
- `/tmp/bookshare-auth-traces-1775718679/recovery`

Trace identity:
- email: `trace.1775718679@example.com`
- identity id: `dfc0f507-4e36-4d69-9d8a-dd02b08b825d`
- recovery flow id: `74124c0b-886e-4041-8386-ab63939c8170`
- recovery-created settings flow id: `b871d432-8db2-4743-b686-e649e7f931c3`

## What This Trace Proves

1. Recovery uses Kratos' `code` strategy.
2. A correct recovery code does not write a new password directly.
3. Kratos creates a privileged session and redirects into the settings flow.
4. The recovery-created settings flow still includes both `profile` and `password` groups.
5. BookShare must convert that raw settings flow into a password-only recovery-reset step.
6. After the reset is saved, the boxed auth flow returns the user to `/login`, not straight into the web app.

## Stage 1: Start Browser Recovery Flow

Request:

```http
GET /self-service/recovery/browser
```

Response from `/recovery/01-start.http`:

```http
HTTP/1.1 303 See Other
Location: http://localhost:3337/recovery?flow=74124c0b-886e-4041-8386-ab63939c8170
Set-Cookie: csrf_token_...=...
```

## Stage 2: Initial Recovery Flow

Relevant fields from `/recovery/02-initial-flow.json`:

```json
{
  "id": "74124c0b-886e-4041-8386-ab63939c8170",
  "state": "choose_method",
  "active": "code",
  "ui": {
    "action": "http://localhost:4433/self-service/recovery?flow=74124c0b-886e-4041-8386-ab63939c8170",
    "method": "POST",
    "nodes": [
      { "group": "default", "name": "csrf_token", "type": "hidden" },
      { "group": "code", "name": "email", "type": "email", "required": true },
      { "group": "code", "name": "method", "type": "submit", "value": "code" }
    ]
  }
}
```

At this point there is no privileged session yet. Recovery is still in the "send a code" phase.

## Stage 3: Submit Recovery Email

Submitted form data:

```http
POST /self-service/recovery?flow=74124c0b-886e-4041-8386-ab63939c8170
Content-Type: application/x-www-form-urlencoded

csrf_token=...
email=trace.1775718679%40example.com
method=code
```

Response from `/recovery/03-submit-email.http`:

```http
HTTP/1.1 303 See Other
Location: http://localhost:3337/recovery?flow=74124c0b-886e-4041-8386-ab63939c8170
```

## Stage 4: Recovery Code Step

Relevant fields from `/recovery/04-code-flow.json`:

```json
{
  "id": "74124c0b-886e-4041-8386-ab63939c8170",
  "state": "sent_email",
  "active": "code",
  "ui": {
    "nodes": [
      { "group": "default", "name": "csrf_token", "type": "hidden" },
      { "group": "code", "name": "code", "type": "text", "required": true, "maxlength": 6 },
      { "group": "code", "name": "method", "type": "hidden", "value": "code" },
      { "group": "code", "name": "method", "type": "submit", "value": "code" },
      { "group": "code", "name": "email", "type": "submit", "value": "trace.1775718679@example.com" }
    ],
    "messages": [
      {
        "id": 1060003,
        "text": "An email containing a recovery code has been sent to the email address you provided. If you have not received an email, check the spelling of the address and make sure to use the address you registered with."
      }
    ]
  }
}
```

Mailpit received:

```json
{
  "Subject": "Use code 276808 to recover access to your account",
  "Created": "2026-04-09T07:11:24.345Z",
  "Snippet": "Recover access to your account by entering the following code: 276808 ..."
}
```

The extracted recovery code from `/recovery/05-recovery-code.txt` was:

```text
276808
```

## Stage 5: Submit Recovery Code

Submitted form data:

```http
POST /self-service/recovery?flow=74124c0b-886e-4041-8386-ab63939c8170
Content-Type: application/x-www-form-urlencoded

csrf_token=...
method=code
code=276808
```

Response from `/recovery/06-submit-code.http`:

```http
HTTP/1.1 303 See Other
Location: http://localhost:3337/settings?flow=b871d432-8db2-4743-b686-e649e7f931c3
Set-Cookie: ory_kratos_session=...; HttpOnly; SameSite=Lax
```

This is the key recovery transition:

1. the recovery challenge is now complete
2. Kratos creates a privileged session
3. Kratos redirects into the settings flow
4. the new password is not written yet

## Stage 6: Recovery-Created Settings Flow

Relevant fields from `/recovery/08-settings-flow.json`:

```json
{
  "id": "b871d432-8db2-4743-b686-e649e7f931c3",
  "request_url": "http://localhost:4433/self-service/recovery?flow=74124c0b-886e-4041-8386-ab63939c8170",
  "ui": {
    "action": "http://localhost:4433/self-service/settings?flow=b871d432-8db2-4743-b686-e649e7f931c3",
    "nodes": [
      { "group": "profile", "name": "traits.email", "type": "email", "value": "trace.1775718679@example.com" },
      { "group": "profile", "name": "traits.name.first", "type": "text", "value": "Trace" },
      { "group": "profile", "name": "traits.name.last", "type": "text", "value": "Runner" },
      { "group": "profile", "name": "traits.gender", "type": "text", "value": "prefer_not_to_say" },
      { "group": "profile", "name": "method", "type": "submit", "value": "profile" },
      { "group": "password", "name": "password", "type": "password", "required": true },
      { "group": "password", "name": "method", "type": "submit", "value": "password" }
    ],
    "messages": [
      {
        "id": 1060001,
        "text": "You successfully recovered your account. Please change your password or set up an alternative login method (e.g. social sign in) within the next 15.00 minutes."
      }
    ]
  }
}
```

This is why recovery has to own its own settings model:

1. Kratos returns both profile and password groups.
2. In recovery mode, BookShare must ignore the profile branch.
3. The recovery feature must render a password-only reset form.

## Stage 7: Submit New Password

Submitted form data:

```http
POST /self-service/settings?flow=b871d432-8db2-4743-b686-e649e7f931c3
Content-Type: application/x-www-form-urlencoded

csrf_token=...
password=ResetPassw0rd2026
method=password
```

Response from `/recovery/09-submit-new-password.http`:

```http
HTTP/1.1 303 See Other
Location: http://localhost:3337/settings/complete
Set-Cookie: ory_kratos_session=...; HttpOnly; SameSite=Lax
```

Kratos has now persisted the new password. Control is back in Auth Portal.

## Stage 8: Auth Portal Completes Recovery

Replaying `/settings/complete` with the session created by that reset returned:

```http
HTTP/1.1 307 Temporary Redirect
Location: http://localhost:3337/login
```

That is the current boxed-auth outcome:

1. recovery ends in login
2. recovery does not directly log the user into the app
3. the user must sign in again with the new password
