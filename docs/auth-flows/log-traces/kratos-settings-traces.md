# Kratos Settings Traces

This document captures the current live settings behavior for BookShare's boxed auth flow.

Capture date:
- 2026-04-09

Environment:
- Web app: `http://localhost:3334`
- Auth Portal: `http://localhost:3337`
- Kratos public/admin: `http://localhost:4433` / `http://localhost:4434`
- Kratos version: `v26.2.0`

Raw artifacts from this capture:
- `/tmp/bookshare-auth-traces-1775718679/settings`

Trace identity:
- email: `trace.1775718679@example.com`
- profile settings flow id: `ee5c82d9-5b77-4f28-a6e3-f63d4f138911`
- password settings flow id: `bbac41c0-c2bc-4091-a7f8-9161622b0552`

## What This Trace Proves

1. Normal settings visits are fully owned by Auth Portal.
2. Auth Portal bootstraps the Kratos browser settings flow and redirects to `?flow=...`.
3. Kratos returns both `profile` and `password` groups in the same settings flow.
4. BookShare splits that raw flow into independent profile and password forms.
5. After a normal settings save, Auth Portal returns the user to web `/profile`.

## Why Settings Uses A Conversion Layer

Kratos' raw settings flow is not a single product screen. It is a combined node graph that contains:

1. hidden CSRF state
2. profile fields and a `method=profile` submit
3. password fields and a `method=password` submit

BookShare converts that raw flow into separate settings models because it wants:

1. a profile form that only shows profile fields
2. a password form that only shows password fields
3. deterministic completion behavior after save

## Profile Settings Trace

### Stage 1: Auth Portal Boots The Profile Flow

Request:

```http
GET /settings?section=profile
```

Response from `/settings/04-profile-page-start.http`:

```http
HTTP/1.1 307 Temporary Redirect
Location: /settings?section=profile&flow=ee5c82d9-5b77-4f28-a6e3-f63d4f138911
```

This redirect is Auth Portal's server-side bootstrap. The page route creates a Kratos browser settings flow and normalizes the URL to include the flow id.

### Stage 2: Kratos Returns The Combined Settings Flow

Relevant fields from `/settings/05-profile-flow.json`:

```json
{
  "id": "ee5c82d9-5b77-4f28-a6e3-f63d4f138911",
  "state": "show_form",
  "ui": {
    "action": "http://localhost:4433/self-service/settings?flow=ee5c82d9-5b77-4f28-a6e3-f63d4f138911",
    "nodes": [
      { "group": "profile", "name": "traits.email", "type": "email", "value": "trace.1775718679@example.com" },
      { "group": "profile", "name": "traits.name.first", "type": "text", "value": "Trace" },
      { "group": "profile", "name": "traits.name.last", "type": "text", "value": "Runner" },
      { "group": "profile", "name": "traits.gender", "type": "text", "value": "prefer_not_to_say" },
      { "group": "profile", "name": "method", "type": "submit", "value": "profile" },
      { "group": "password", "name": "password", "type": "password", "required": true },
      { "group": "password", "name": "method", "type": "submit", "value": "password" }
    ]
  }
}
```

The Auth Portal profile page intentionally ignores the password nodes and renders only the profile subset.

### Stage 3: Submit Profile Changes

Submitted form data:

```http
POST /self-service/settings?flow=ee5c82d9-5b77-4f28-a6e3-f63d4f138911
Content-Type: application/x-www-form-urlencoded

csrf_token=...
traits.email=trace.1775718679%40example.com
traits.name.first=TraceUpdated
traits.name.last=Runner
traits.gender=prefer_not_to_say
method=profile
```

Response from `/settings/06-submit-profile.http`:

```http
HTTP/1.1 303 See Other
Location: http://localhost:3337/settings/complete
```

Replaying `/settings/complete` with that session returned:

```http
HTTP/1.1 307 Temporary Redirect
Location: http://localhost:3334/profile
```

So the normal boxed-auth settings outcome is:

1. save in auth
2. finish in auth
3. return to the web app profile page

## Password Settings Trace

### Stage 1: Auth Portal Boots The Password Flow

Request:

```http
GET /settings?section=password
```

Response from `/settings/07-password-page-start.http`:

```http
HTTP/1.1 307 Temporary Redirect
Location: /settings?section=password&flow=bbac41c0-c2bc-4091-a7f8-9161622b0552
```

### Stage 2: Kratos Returns The Same Combined Settings Shape

Relevant fields from `/settings/08-password-flow.json`:

```json
{
  "id": "bbac41c0-c2bc-4091-a7f8-9161622b0552",
  "state": "show_form",
  "ui": {
    "nodes": [
      { "group": "profile", "name": "traits.email", "type": "email", "value": "trace.1775718679@example.com" },
      { "group": "profile", "name": "traits.name.first", "type": "text", "value": "TraceUpdated" },
      { "group": "profile", "name": "traits.name.last", "type": "text", "value": "Runner" },
      { "group": "profile", "name": "traits.gender", "type": "text", "value": "prefer_not_to_say" },
      { "group": "profile", "name": "method", "type": "submit", "value": "profile" },
      { "group": "password", "name": "password", "type": "password", "required": true },
      { "group": "password", "name": "method", "type": "submit", "value": "password" }
    ]
  }
}
```

The raw Kratos flow still contains the profile branch. The Auth Portal password page deliberately ignores it and renders only the password step.

### Stage 3: Submit Password Change

Submitted form data:

```http
POST /self-service/settings?flow=bbac41c0-c2bc-4091-a7f8-9161622b0552
Content-Type: application/x-www-form-urlencoded

csrf_token=...
password=ResetPassw0rd2026
method=password
```

Response from `/settings/09-submit-password.http`:

```http
HTTP/1.1 303 See Other
Location: http://localhost:3337/settings/complete
```

Replaying `/settings/complete` with that session returned:

```http
HTTP/1.1 307 Temporary Redirect
Location: http://localhost:3334/profile
```

That gives the same normal settings outcome as the profile save:

1. Kratos persists the change
2. Auth Portal completes the flow
3. the user returns to web `/profile`
