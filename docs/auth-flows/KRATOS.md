# Ory Kratos Deep Dive — BookShare Implementation

> Companion document to [auth-system.md](./auth-system.md). This covers Kratos internals in full detail: how flows work, what Kratos returns at each stage, how responses map to UI, and the exact request/response lifecycle.

## Table of Contents

- [What Is Kratos](#what-is-kratos)
- [How Kratos Flows Work (Concept)](#how-kratos-flows-work-concept)
- [Kratos Configuration Walkthrough](#kratos-configuration-walkthrough)
- [Identity Schema](#identity-schema)
- [The Auth Portal: Kratos UI Layer](#the-auth-portal-kratos-ui-layer)
- [Registration Flow (Deep Dive)](#registration-flow-deep-dive)
- [Login Flow (Deep Dive)](#login-flow-deep-dive)
- [Recovery Flow (Deep Dive)](#recovery-flow-deep-dive)
- [Verification Flow (Deep Dive)](#verification-flow-deep-dive)
- [Settings Flow (Deep Dive)](#settings-flow-deep-dive)
- [Setup Flow (Password + Profile)](#setup-flow-password--profile)
- [Logout Flow (Deep Dive)](#logout-flow-deep-dive)
- [Error Handling](#error-handling)
- [How Kratos Flow Responses Map to UI](#how-kratos-flow-responses-map-to-ui)
- [Kratos Session Model](#kratos-session-model)
- [Hooks](#hooks)
- [Courier (Email)](#courier-email)
- [Secrets & Cryptography](#secrets--cryptography)

---

## What Is Kratos

Ory Kratos is a **headless identity management system**. It handles:

- User account storage (identities with traits)
- Password hashing and verification (bcrypt)
- Self-service flows (registration, login, recovery, verification, settings)
- Session management (browser cookies)
- Email delivery for verification/recovery codes

Kratos is **headless** — it has no built-in UI. Instead, it provides a JSON API that describes what UI should be rendered. The Auth Portal (`apps/auth`) is our custom UI that reads these JSON descriptions and renders React components.

Kratos does **not** handle OAuth2 or OIDC — that's Hydra's job. Kratos focuses purely on identity and self-service flows.

---

## How Kratos Flows Work (Concept)

Every user action (registration, login, recovery, etc.) in Kratos is modeled as a **flow**. A flow is a stateful server-side object with a unique ID and a lifecycle.

### Flow Lifecycle

```
1. INITIATION
   Browser → GET /self-service/{type}/browser
   Kratos creates a flow object, stores it server-side, assigns a UUID.
   Kratos redirects to the configured ui_url with ?flow={flowId}.

2. FETCHING
   Auth Portal → GET /self-service/{type}/flows?id={flowId}
   Kratos returns the flow object as JSON.
   The JSON contains a `ui` object describing what form to render.

3. SUBMISSION
   Browser → POST to flow.ui.action (Kratos endpoint)
   Kratos processes the submission.
   If validation fails: Kratos updates the flow with error messages,
     redirects back to ui_url with ?flow={flowId}
   If validation succeeds: Kratos runs hooks and redirects to return_to.

4. EXPIRATION
   Each flow has a lifespan. After expiration, the flow is invalid.
   Attempting to fetch or submit returns an error.
   The user must start a new flow.
```

### Flow Types and Lifespans (from kratos.yml)

| Flow Type | Lifespan | UI URL |
|---|---|---|
| registration | 1h | http://localhost:3337/register |
| login | 10m | http://localhost:3337/login |
| recovery | default (1h) | http://localhost:3337/recovery |
| verification | default (1h) | http://localhost:3337/verification |
| settings | default (1h) | http://localhost:3337/settings |
| error | n/a | http://localhost:3337/error |

### Flow ID Propagation

Every Kratos self-service endpoint works with a flow ID:

- **Create flow:** `GET /self-service/{type}/browser` → redirects with `?flow={id}`
- **Fetch flow:** `GET /self-service/{type}/flows?id={id}` → returns JSON
- **Submit flow:** `POST {flow.ui.action}` → the action URL has the flow ID baked in
- **Error lookup:** `GET /self-service/errors?id={errorId}` → returns error details

---

## Kratos Configuration Walkthrough

File: `infra/ory/kratos/kratos.yml`

### Serving

```yaml
serve:
  public:
    base_url: http://localhost:4433/    # Browser-facing URL
    cors:
      enabled: true                     # Needed for cross-origin Auth Portal
  admin:
    base_url: http://kratos:4434/       # Internal Docker network only
```

The public API (port 4433) is what browsers and the Auth Portal interact with. The admin API (port 4434) is for internal use only (e.g., identity management).

### Self-Service Configuration

```yaml
selfservice:
  default_browser_return_url: http://localhost:3337
  allowed_return_urls:
    - http://localhost:3337              # Auth Portal
    - http://localhost:3334              # Web App
    - http://localhost:3334/api/auth/login  # Web App OAuth login
    - http://localhost:3337/oauth/login     # Auth Portal OAuth handler
```

`default_browser_return_url`: Where Kratos redirects when a flow completes and no specific `return_to` was provided.

`allowed_return_urls`: Whitelist of URLs that can be used as `return_to` values. Any other URL is rejected. This prevents open redirect attacks.

### Methods

```yaml
methods:
  password:
    enabled: true           # Email + password login
  code:
    enabled: true
    passwordless_enabled: true  # Allows code-only registration
    config:
      lifespan: 1h          # Code validity period
  link:
    enabled: true           # For future email-link flows
```

**Password method:** Traditional email + password authentication. Used for login and settings (password change).

**Code method:** 6-digit numeric codes sent via email. Used for registration (email verification), recovery, and standalone verification. `passwordless_enabled: true` means a user can start registration with just an email + code, without setting a password upfront.

**Link method:** Enabled but not actively used in the current UI. Reserved for future email-link verification flows.

### Flow-Specific Settings

```yaml
flows:
  login:
    ui_url: http://localhost:3337/login
    lifespan: 10m

  registration:
    lifespan: 1h
    style: unified
    ui_url: http://localhost:3337/register
    after:
      default_browser_return_url: http://localhost:3337/setup
      code:
        hooks:
          - hook: session
      password:
        hooks:
          - hook: session
          - hook: show_verification_ui

  recovery:
    enabled: true
    ui_url: http://localhost:3337/recovery
    use: code

  verification:
    enabled: true
    ui_url: http://localhost:3337/verification
    use: code
    after:
      default_browser_return_url: http://localhost:3337/welcome

  settings:
    ui_url: http://localhost:3337/settings
    privileged_session_max_age: 15m

  logout:
    after:
      default_browser_return_url: http://localhost:3337/login
```

**`style: unified`** (registration): Renders all registration methods in a single form rather than separate tabs. This means the code and password methods share the same UI flow.

**`privileged_session_max_age: 15m`** (settings): After 15 minutes, Kratos considers the session "non-privileged" and requires re-authentication before allowing sensitive changes (like password updates).

---

## Identity Schema

File: `infra/ory/kratos/identity.schema.json`

The identity schema defines what data Kratos stores for each user (called "traits"). It also controls which fields are used for authentication.

```json
{
  "traits": {
    "type": "object",
    "properties": {
      "email": {
        "type": "string",
        "format": "email",
        "minLength": 3,
        "ory.sh/kratos": {
          "credentials": {
            "code": { "identifier": true, "via": "email" },
            "password": { "identifier": true }
          },
          "verification": { "via": "email" },
          "recovery": { "via": "email" }
        }
      },
      "name": {
        "type": "object",
        "properties": {
          "first": { "type": "string", "title": "First Name" },
          "last": { "type": "string", "title": "Last Name" }
        }
      },
      "gender": {
        "type": "string",
        "enum": ["female", "male", "prefer_not_to_say"]
      }
    },
    "required": ["email"]
  }
}
```

In Ory Kratos identity schemas, the key "ory.sh/kratos" tells Kratos how this field should behave in authentication flows (login, verification, recovery).

So your schema defines the user identity structure, and this section configures how Kratos uses email during auth.

1. Credentials: Controls how the user can log in.

```json
"credentials": {
  "code": { "identifier": true, "via": "email" },
  "password": { "identifier": true }
}
````

Password Login

```json
"password": { "identifier": true }
```

This means the **email field acts as the login identifier for password authentication**.

Users log in with:

```
email + password
```

Example:

```
identifier: user@email.com
password: secret
```

---

Passwordless Code Login

```json
"code": { "identifier": true, "via": "email" }
```

This enables **passwordless login using a code sent to the user's email**.

Meaning:

* Email can be used as a login identifier
* Kratos sends a login code to the email
* The user enters the code to sign in

Example flow:

1. User enters email
2. Kratos sends OTP to email
3. User enters code
4. Login succeeds

---

2. Verification

```json
"verification": { "via": "email" }
```

This enables **email verification**.

When a user registers:

1. Kratos sends a verification email
2. User clicks the link or enters a code
3. Email becomes verified

---

3. Recovery

```json
"recovery": { "via": "email" }
```

This enables **password recovery via email**.

Flow:

1. User clicks **Forgot Password**
2. Kratos sends a recovery link or code to email
3. User resets their password

### The `ory.sh/kratos` Extension

This is Kratos-specific JSON Schema metadata that tells Kratos how to use each field:

**`credentials.code.identifier: true`** — The email field is the identifier for the code method. When a user enters their email during registration, Kratos knows to send a code to this address.

**`credentials.code.via: "email"`** — Deliver the code via email (as opposed to SMS).

**`credentials.password.identifier: true`** — The email field is the identifier for the password method. During login, the user enters this email + their password.

**`verification.via: "email"`** — Send verification codes to this email address.

**`recovery.via: "email"`** — Send recovery codes to this email address.

### How Traits Become Form Fields

Kratos reads the schema and generates UI nodes for each trait property. For example:
- `traits.email` → text input with type="email"
- `traits.name.first` → text input with type="text"
- `traits.gender` → text input (Auth Portal overrides this to a select dropdown)

---

## The Auth Portal: Kratos UI Layer

The Auth Portal is a Next.js app that serves as Kratos's custom UI. Kratos does not render forms itself — it tells the Auth Portal what to render via the flow JSON.

### Architecture

```
Kratos                          Auth Portal
──────                          ──────────
Creates flow object    ──→      Fetches flow JSON
Returns ui.nodes[]     ──→      Parses nodes into sections
Processes form POST    ←──      Renders HTML form pointing to Kratos
Updates flow state     ──→      Re-fetches and re-renders
```

### Component Hierarchy

```
KratosFlowForm                    (entry point — receives flow + page config)
  ├── AuthShell                   (card layout with title + description)
  ├── FlowMessages                (top-level flow messages: errors, info, success)
  ├── FlowSection (× N)          (one per method group: password, code, profile, etc.)
  │     ├── <form>                (action = flow.ui.action, method = flow.ui.method)
  │     │   ├── hidden inputs     (csrf_token, method, etc.)
  │     │   ├── FlowField (× N)  (visible input fields)
  │     │   │   ├── Label         (from node.meta.label.text or fallback)
  │     │   │   ├── Input/Select/Checkbox (based on node type/name)
  │     │   │   └── Error messages (from node.messages[])
  │     │   ├── Confirm password  (optional, for setup step)
  │     │   └── Submit button(s)  (from submit nodes)
  ├── FlowFooterLinks            (navigation links: "Back to sign in", etc.)
```

### The Kratos API Client

File: `apps/auth/src/lib/kratos.ts`

Two key functions handle all Kratos communication:

**`initBrowserFlow(kind, returnTo)`** — Creates a new flow. Calls Kratos with the Auth Portal's cookies forwarded (so Kratos can associate the flow with an existing session if one exists). Returns the flow ID from the redirect Location header or response body.

**`getBrowserFlow(kind, flowId)`** — Fetches an existing flow by ID. Forwards the browser's cookies to Kratos for session association. Returns the full flow JSON or null if invalid/expired.

Both functions use `getKratosInternalPublicUrl()` (Docker internal: `http://kratos:4433`) for server-to-server calls and forward the browser's cookies so Kratos can identify the user's session.

---

## Registration Flow (Deep Dive)

### Stage 1: Flow Creation

**Request:**
```
Browser → GET http://localhost:4433/self-service/registration/browser
            ?return_to=http://localhost:3337/oauth/login
```

**Kratos response:** HTTP 303 redirect
```
Location: http://localhost:3337/register?flow=a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

Kratos has created a registration flow with:
- A UUID identifier
- A 1-hour lifespan
- The return_to URL stored in the flow
- Initial UI nodes for the code method (email entry)

### Stage 2: Fetch Flow (Email Entry Phase)

**Request:**
```
Auth Portal → GET http://kratos:4433/self-service/registration/flows
                ?id=a1b2c3d4-e5f6-7890-abcd-ef1234567890
              Cookie: ory_kratos_session=... (if any)
```

**Kratos response (simplified):**
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "type": "browser",
  "state": "choose_method",
  "ui": {
    "action": "http://localhost:4433/self-service/registration?flow=a1b2c3d4-...",
    "method": "POST",
    "messages": [],
    "nodes": [
      {
        "type": "input",
        "group": "default",
        "attributes": {
          "name": "csrf_token",
          "type": "hidden",
          "value": "qKx7..."
        },
        "messages": [],
        "meta": {}
      },
      {
        "type": "input",
        "group": "code",
        "attributes": {
          "name": "traits.email",
          "type": "email",
          "required": true,
          "value": ""
        },
        "messages": [],
        "meta": {
          "label": {
            "id": 1070002,
            "text": "E-Mail",
            "type": "info"
          }
        }
      },
      {
        "type": "input",
        "group": "code",
        "attributes": {
          "name": "method",
          "type": "submit",
          "value": "code"
        },
        "messages": [],
        "meta": {
          "label": {
            "id": 1040006,
            "text": "Sign up with code",
            "type": "info"
          }
        }
      }
    ]
  }
}
```

### How Auth Portal Renders Stage 2

The `/register` page calls `getBrowserFlow("registration", flowId)` and passes the result to `<KratosFlowForm>`:

```tsx
<KratosFlowForm
  flow={flow}
  title="Register"
  description="Enter your email to start account creation."
  sectionGroups={["code"]}
  fieldAllowlist={["traits.email"]}     // Only show email field
  submitAllowlist={["method"]}          // Only show "method" submit buttons
  hideBackOnlySections
  links={[{ href: loginHref, label: "Back to sign in" }]}
/>
```

**Node partitioning (`buildSections`):**

1. Collects all nodes from the flow
2. Groups them by `node.group` ("default", "code", "password", etc.)
3. Filters by `preferredGroups: ["code"]` — only show the "code" section
4. Filters input nodes by `fieldAllowlist: ["traits.email"]` — only show email field
5. Merges "default" group's hidden nodes (like csrf_token) into every section

**Resulting section:**
```
Section: "code"
  hiddenNodes: [csrf_token]
  inputNodes: [traits.email]
  submitNodes: [method=code ("Sign up with code")]
```

**Rendered HTML (conceptual):**
```html
<form action="http://localhost:4433/self-service/registration?flow=a1b2c3..." method="post">
  <input type="hidden" name="csrf_token" value="qKx7..." />

  <label for="field-code-traits_email-0">E-Mail</label>
  <input id="field-code-traits_email-0"
         name="traits.email"
         type="email"
         required
         autocomplete="email" />

  <button type="submit" name="method" value="code">Sign up with code</button>
</form>

<a href="/login">Back to sign in</a>
```

### Stage 3: Email Submission

**Request:**
```
Browser → POST http://localhost:4433/self-service/registration?flow=a1b2c3d4-...
          Content-Type: application/x-www-form-urlencoded

          csrf_token=qKx7...&traits.email=user@example.com&method=code
```

**What Kratos does:**
1. Validates the email format (JSON schema: `"format": "email"`)
2. Checks if an identity with this email already exists
3. If new: generates a 6-digit code and queues it for email delivery
4. Updates the flow state — now includes a `code` input field
5. Redirects back to the UI: `HTTP 303 → /register?flow=a1b2c3d4-...`

**If email already exists:** Kratos updates the flow with an error message on the `traits.email` node and redirects back.

### Stage 4: Fetch Flow (Code Entry Phase)

**Kratos response (simplified):**
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "state": "sent_email",
  "ui": {
    "action": "http://localhost:4433/self-service/registration?flow=a1b2c3d4-...",
    "method": "POST",
    "messages": [
      {
        "id": 1040005,
        "text": "An email containing a code has been sent to the email address you provided.",
        "type": "info"
      }
    ],
    "nodes": [
      {
        "type": "input",
        "group": "default",
        "attributes": {
          "name": "csrf_token",
          "type": "hidden",
          "value": "qKx7..."
        },
        "messages": [],
        "meta": {}
      },
      {
        "type": "input",
        "group": "code",
        "attributes": {
          "name": "traits.email",
          "type": "email",
          "required": true,
          "value": "user@example.com"
        },
        "messages": [],
        "meta": {
          "label": {
            "id": 1070002,
            "text": "E-Mail",
            "type": "info"
          }
        }
      },
      {
        "type": "input",
        "group": "code",
        "attributes": {
          "name": "code",
          "type": "text",
          "required": true
        },
        "messages": [],
        "meta": {
          "label": {
            "id": 1040014,
            "text": "Verification code",
            "type": "info"
          }
        }
      },
      {
        "type": "input",
        "group": "code",
        "attributes": {
          "name": "method",
          "type": "submit",
          "value": "code"
        },
        "messages": [],
        "meta": {
          "label": {
            "id": 1040015,
            "text": "Submit",
            "type": "info"
          }
        }
      },
      {
        "type": "input",
        "group": "code",
        "attributes": {
          "name": "screen",
          "type": "submit",
          "value": "previous"
        },
        "messages": [],
        "meta": {
          "label": {
            "id": 1040016,
            "text": "Back",
            "type": "info"
          }
        }
      }
    ]
  }
}
```

### How Auth Portal Renders Stage 4

The `/register` page detects the code step by checking if any node has `name === "code"`:

```tsx
const isCodeStep = flow.ui.nodes.some(
  (node) => node.type === "input" && node.attributes.name === "code"
);
```

It also extracts the pre-filled email for display:

```tsx
const codeEmail = flow.ui.nodes.find(
  (item) => item.type === "input" && item.attributes.name === "traits.email"
)?.attributes.value;
```

Rendering config switches:

```tsx
<KratosFlowForm
  flow={flow}
  title="Verify your email"
  description={`Enter the latest 6-digit code sent to ${codeEmail}.`}
  sectionGroups={["code"]}
  fieldAllowlist={["code"]}              // Now only show the code field
  submitAllowlist={["method"]}           // Show "Submit" but NOT "Back"
  hideBackOnlySections                   // Hide sections with only back buttons
  links={[
    { href: loginHref, label: "Back to sign in" },
    { href: "/register/reset", label: "Use a different email" },
  ]}
/>
```

**Node partitioning result:**
```
Section: "code"
  hiddenNodes: [csrf_token]
  inputNodes: [code]                     // traits.email filtered out by allowlist
  submitNodes: [method=code ("Submit")]  // screen=previous filtered by allowlist
```

**Key detail — the "Back" button (`screen=previous`):**
The `hideBackOnlySections` prop and `submitAllowlist: ["method"]` both work to prevent rendering the back button. The `isBackNavigationSubmit()` function identifies these nodes:

```ts
function isBackNavigationSubmit(node) {
  return isSubmitNode(node) &&
    node.attributes.name === "screen" &&
    node.attributes.value === "previous";
}
```

**Code field special handling in FlowField:**
```tsx
const isCodeField = name === "code" || name.endsWith("_code");
// If code field:
//   inputMode="numeric"        → mobile keyboard shows numbers
//   placeholder="6-digit code" → visual hint
//   normalizeOneTimeCode()     → strips non-digits, limits to 6 chars
//   autoComplete="one-time-code" → browser autofill from SMS
```

**Rendered HTML (conceptual):**
```html
<p class="info">An email containing a code has been sent...</p>

<form action="http://localhost:4433/self-service/registration?flow=a1b2c3d4-..." method="post">
  <input type="hidden" name="csrf_token" value="qKx7..." />

  <label for="field-code-code-0">Verification code</label>
  <input id="field-code-code-0"
         name="code"
         type="text"
         required
         inputmode="numeric"
         placeholder="6-digit code"
         autocomplete="one-time-code" />

  <button type="submit" name="method" value="code">Submit</button>
</form>

<a href="/login">Back to sign in</a>
<a href="/register/reset">Use a different email</a>
```

### Stage 5: Code Submission

**Request:**
```
Browser → POST http://localhost:4433/self-service/registration?flow=a1b2c3d4-...
          csrf_token=qKx7...&code=123456&method=code
```

**What Kratos does:**
1. Validates the 6-digit code against the stored code
2. If invalid: updates flow with error message, redirects back to UI
3. If valid:
   - Creates the identity in the database
   - Marks the email as verified (`verifiable_addresses[].verified = true`)
   - Executes after-registration hooks (see [Hooks](#hooks)):
     - `hook: session` → Creates a Kratos browser session
   - Sets `ory_kratos_session` cookie
   - Redirects to `registration.after.default_browser_return_url`:
     `HTTP 303 → http://localhost:3337/setup`

**If code is wrong:**
```json
{
  "ui": {
    "nodes": [
      {
        "type": "input",
        "group": "code",
        "attributes": { "name": "code", "type": "text" },
        "messages": [
          {
            "id": 4000001,
            "text": "The code is not valid. Please try again.",
            "type": "error"
          }
        ]
      }
    ]
  }
}
```

The `FlowField` component renders this error below the input:
```html
<input name="code" ... />
<p class="flow-node-message flow-node-message-error">
  The code is not valid. Please try again.
</p>
```

---

## Login Flow (Deep Dive)

### Stage 1: Flow Creation

```
Browser → GET http://localhost:4433/self-service/login/browser
            ?return_to=http://localhost:3337/oauth/login?login_challenge=xyz
```

Kratos creates a login flow (10-minute lifespan) and redirects:
```
Location: http://localhost:3337/login?flow=b2c3d4e5-...
```

### Stage 2: Fetch Flow

**Kratos response:**
```json
{
  "id": "b2c3d4e5-f6a7-8901-bcde-f23456789012",
  "state": "choose_method",
  "return_to": "http://localhost:3337/oauth/login?login_challenge=xyz",
  "ui": {
    "action": "http://localhost:4433/self-service/login?flow=b2c3d4e5-...",
    "method": "POST",
    "messages": [],
    "nodes": [
      {
        "type": "input",
        "group": "default",
        "attributes": {
          "name": "csrf_token",
          "type": "hidden",
          "value": "mNx8..."
        },
        "messages": [],
        "meta": {}
      },
      {
        "type": "input",
        "group": "default",
        "attributes": {
          "name": "identifier",
          "type": "text",
          "required": true,
          "value": ""
        },
        "messages": [],
        "meta": {
          "label": {
            "id": 1070004,
            "text": "ID",
            "type": "info"
          }
        }
      },
      {
        "type": "input",
        "group": "password",
        "attributes": {
          "name": "password",
          "type": "password",
          "required": true
        },
        "messages": [],
        "meta": {
          "label": {
            "id": 1070001,
            "text": "Password",
            "type": "info"
          }
        }
      },
      {
        "type": "input",
        "group": "password",
        "attributes": {
          "name": "method",
          "type": "submit",
          "value": "password"
        },
        "messages": [],
        "meta": {
          "label": {
            "id": 1010001,
            "text": "Sign in",
            "type": "info"
          }
        }
      }
    ]
  }
}
```

### How Auth Portal Renders Login

```tsx
<KratosFlowForm
  flow={flow}
  title="Sign in"
  description="Use your account to continue."
  sectionGroups={["password"]}
  links={[
    { href: "/recovery", label: "Forgot password?" },
  ]}
/>
```

**Node partitioning:**
```
Section: "password"
  hiddenNodes: [csrf_token]
  inputNodes: [identifier (from default group, merged in), password]
  submitNodes: [method=password ("Sign in")]
```

The `identifier` node belongs to the `default` group, but `buildSections` merges default group inputs into non-default sections. This is why the email field appears in the password section.

**Label resolution:**
- `identifier` → Kratos meta label says "ID", but `getNodeLabel()` override: `"identifier" → "Email"`
- `password` → Kratos meta label says "Password"

**Autocomplete logic:**
- `identifier` → `getFieldAutoComplete("identifier")` → `"email"`
- `password` (in login action URL) → `"current-password"` (not `"new-password"` because action URL doesn't contain `/registration` or `/settings`)

**Rendered HTML:**
```html
<form action="http://localhost:4433/self-service/login?flow=b2c3d4e5-..." method="post">
  <input type="hidden" name="csrf_token" value="mNx8..." />

  <label>Email</label>
  <input name="identifier" type="text" required autocomplete="email" />

  <label>Password</label>
  <input name="password" type="password" required autocomplete="current-password" />

  <button type="submit" name="method" value="password">Sign in</button>
</form>

<a href="/recovery">Forgot password?</a>
```

### Stage 3: Credential Submission

```
Browser → POST http://localhost:4433/self-service/login?flow=b2c3d4e5-...
          csrf_token=mNx8...&identifier=user@example.com&password=MyP@ss&method=password
```

**On success:**
1. Kratos validates password against bcrypt hash
2. Creates a browser session
3. Sets `ory_kratos_session` cookie
4. Redirects to `return_to`: `http://localhost:3337/oauth/login?login_challenge=xyz`

**On failure (wrong password):**
```json
{
  "ui": {
    "messages": [
      {
        "id": 4000006,
        "text": "The provided credentials are invalid, check for spelling mistakes in your password or username, email address, or phone number.",
        "type": "error"
      }
    ]
  }
}
```

The `FlowMessages` component renders this as a top-level error alert above the form.

**On failure (account not found):**
Same generic error message (Kratos doesn't distinguish between "account not found" and "wrong password" to prevent user enumeration).

---

## Recovery Flow (Deep Dive)

### Stage 1: Flow Creation

```
Browser → GET http://localhost:4433/self-service/recovery/browser
```

### Stage 2: Fetch Flow (Email Entry)

**Kratos response:**
```json
{
  "id": "c3d4e5f6-...",
  "state": "choose_method",
  "ui": {
    "action": "http://localhost:4433/self-service/recovery?flow=c3d4e5f6-...",
    "method": "POST",
    "nodes": [
      {
        "type": "input",
        "group": "default",
        "attributes": { "name": "csrf_token", "type": "hidden", "value": "..." }
      },
      {
        "type": "input",
        "group": "code",
        "attributes": {
          "name": "email",
          "type": "email",
          "required": true
        },
        "meta": {
          "label": { "text": "Email" }
        }
      },
      {
        "type": "input",
        "group": "code",
        "attributes": {
          "name": "method",
          "type": "submit",
          "value": "code"
        },
        "meta": {
          "label": { "text": "Submit" }
        }
      }
    ]
  }
}
```

### Auth Portal Rendering

```tsx
<KratosFlowForm
  flow={flow}
  title="Recover account"
  description="Reset your password via email code."
  links={[{ href: "/login", label: "Back to sign in" }]}
/>
```

No `sectionGroups` or `fieldAllowlist` — all nodes are rendered as-is.

### Stage 3: Code Entry (after email submission)

Kratos sends a recovery code and updates the flow to include a `code` input node (similar pattern to registration).

### Stage 4: Code Validated

When the correct code is submitted:
1. Kratos grants a **privileged session** (allows password change)
2. Redirects to the settings flow where the user can set a new password
3. The settings flow is pre-configured for password method

---

## Verification Flow (Deep Dive)

### Stage 1: Flow Creation

```
Browser → GET http://localhost:4433/self-service/verification/browser
            ?return_to=http://localhost:3337/oauth/login?login_challenge=xyz
```

### Stage 2: Fetch Flow

**Kratos response:**
```json
{
  "id": "d4e5f6a7-...",
  "state": "choose_method",
  "ui": {
    "action": "http://localhost:4433/self-service/verification?flow=d4e5f6a7-...",
    "method": "POST",
    "nodes": [
      {
        "type": "input",
        "group": "default",
        "attributes": { "name": "csrf_token", "type": "hidden", "value": "..." }
      },
      {
        "type": "input",
        "group": "code",
        "attributes": {
          "name": "email",
          "type": "email",
          "required": true
        },
        "meta": {
          "label": { "text": "Email" }
        }
      },
      {
        "type": "input",
        "group": "code",
        "attributes": {
          "name": "method",
          "type": "submit",
          "value": "code"
        },
        "meta": {
          "label": { "text": "Submit" }
        }
      }
    ]
  }
}
```

### Auth Portal Rendering

```tsx
<KratosFlowForm
  flow={flow}
  title="Verify email"
  description="Enter the code sent to your email."
  links={[
    { href: "/login", label: "Sign in" },
  ]}
/>
```

### Stage 3: Code Submission

User enters email → Kratos sends code → user enters code.

**On success:**
1. Kratos marks `verifiable_addresses[].verified = true`
2. Redirects to `verification.after.default_browser_return_url`:
   `http://localhost:3337/welcome`

The `/welcome` page is a static page that says:
```
"Email verification started"
"Check your inbox for the verification code and complete verification to continue."
```

With links to:
- "Enter verification code" → `/verification`
- "Back to sign in" → `/login`

---

## Settings Flow (Deep Dive)

### Stage 1: Flow Creation

```
Browser → GET http://localhost:4433/self-service/settings/browser
              ?return_to=...
          Cookie: ory_kratos_session=...  (REQUIRED — settings needs an active session)
```

If no session exists, Kratos returns 401 and redirects to the login UI.

### Stage 2: Fetch Flow

**Kratos response:**
```json
{
  "id": "e5f6a7b8-...",
  "state": "show_form",
  "identity": {
    "id": "identity-uuid",
    "traits": {
      "email": "user@example.com",
      "name": { "first": "Jane", "last": "Doe" },
      "gender": "female"
    }
  },
  "ui": {
    "action": "http://localhost:4433/self-service/settings?flow=e5f6a7b8-...",
    "method": "POST",
    "nodes": [
      {
        "type": "input",
        "group": "default",
        "attributes": { "name": "csrf_token", "type": "hidden", "value": "..." }
      },
      {
        "type": "input",
        "group": "profile",
        "attributes": {
          "name": "traits.email",
          "type": "email",
          "value": "user@example.com",
          "required": true
        },
        "meta": { "label": { "text": "E-Mail" } }
      },
      {
        "type": "input",
        "group": "profile",
        "attributes": {
          "name": "traits.name.first",
          "type": "text",
          "value": "Jane"
        },
        "meta": { "label": { "text": "First Name" } }
      },
      {
        "type": "input",
        "group": "profile",
        "attributes": {
          "name": "traits.name.last",
          "type": "text",
          "value": "Doe"
        },
        "meta": { "label": { "text": "Last Name" } }
      },
      {
        "type": "input",
        "group": "profile",
        "attributes": {
          "name": "traits.gender",
          "type": "text",
          "value": "female"
        },
        "meta": { "label": { "text": "Gender" } }
      },
      {
        "type": "input",
        "group": "profile",
        "attributes": {
          "name": "method",
          "type": "submit",
          "value": "profile"
        },
        "meta": { "label": { "text": "Save" } }
      },
      {
        "type": "input",
        "group": "password",
        "attributes": {
          "name": "password",
          "type": "password",
          "required": true
        },
        "meta": { "label": { "text": "Password" } }
      },
      {
        "type": "input",
        "group": "password",
        "attributes": {
          "name": "method",
          "type": "submit",
          "value": "password"
        },
        "meta": { "label": { "text": "Save" } }
      }
    ]
  }
}
```

### Auth Portal Rendering (Settings Page)

```tsx
<KratosFlowForm
  flow={flow}
  title="Account settings"
  description={`Manage profile details for ${accountEmail}.`}
  sectionGroups={["profile"]}
  fieldAllowlist={["traits.email", "traits.name.first", "traits.name.last", "traits.gender"]}
  readonlyFieldNames={["traits.email"]}
  submitAllowlist={["method"]}
  hideBackOnlySections
  links={[{ href: "/login", label: "Back to sign in" }]}
/>
```

**Critical detail — `readonlyFieldNames: ["traits.email"]`:**

The `FlowSection` component checks this set and passes `readOnly={true}` to `FlowField`:

```tsx
readOnly={readonlyNameSet.has(node.attributes.name?.trim() ?? "")}
```

`FlowField` then renders the input with `readOnly`:
```html
<input name="traits.email" type="email" value="user@example.com" readonly />
```

This means the email appears in the form (and is submitted with it) but the user can't modify it.

### Gender Field Special Handling

When `FlowField` encounters `name === "traits.gender"`, it renders a `<Select>` dropdown instead of a text input:

```tsx
const isGenderField = name === "traits.gender";

// ...

isGenderField ? (
  <Select name={name} defaultValue={selectValue}>
    <SelectTrigger>
      <SelectValue placeholder="Select gender" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="female">Female</SelectItem>
      <SelectItem value="male">Male</SelectItem>
      <SelectItem value="prefer_not_to_say">Do not Specify</SelectItem>
    </SelectContent>
  </Select>
)
```

This is a UI override — Kratos sends `type: "text"` for the gender field, but the Auth Portal knows it should be a dropdown based on the field name.

### Trait Value Fallback

Settings flow responses include the current identity traits in `flow.identity.traits`. The `FlowSection` component has a fallback mechanism: if a node's `attributes.value` is empty but the field name starts with `traits.`, it looks up the value from `flow.identity.traits`:

```tsx
const getTraitValueForNode = (nodeName) => {
  if (!nodeName.startsWith("traits.")) return undefined;
  const traitPath = nodeName.slice("traits.".length); // e.g., "name.first"
  const segments = traitPath.split(".");               // ["name", "first"]
  let current = flow.identity?.traits;
  for (const segment of segments) {
    current = current[segment];                        // walk the path
  }
  return current;
};
```

This ensures form fields are pre-populated even if Kratos doesn't set `attributes.value` on every node.

---

## Setup Flow (Password + Profile)

The setup flow uses the same Kratos **settings** flow under the hood but with custom Auth Portal rendering that splits it into two steps.

### Stage 1: Password Step

**Auth Portal renders with:**
```tsx
<KratosFlowForm
  flow={flow}
  title="Set your password"
  description={`Choose a password for ${accountEmail}.`}
  sectionGroups={["password"]}
  fieldAllowlist={["password"]}
  submitAllowlist={["method"]}
  hideBackOnlySections
  enablePasswordConfirmation={true}   // <-- adds confirm password field
  links={[{ href: "/login", label: "Back to sign in" }]}
/>
```

**Password confirmation logic (client-side only):**

When `enablePasswordConfirmation` is true and the section key is `"password"`, `FlowSection` adds a second password input that is NOT sent to Kratos:

```tsx
const needsPasswordConfirmation =
  enablePasswordConfirmation && section.key === "password";

// Rendered:
{needsPasswordConfirmation && (
  <Input
    id="setup-confirm-password"
    type="password"
    autoComplete="new-password"
    placeholder="Re-enter your password"
    value={confirmPassword}
    onChange={...}
  />
)}
```

On form submit, it checks:
```tsx
const handleSubmit = (event) => {
  if (!needsPasswordConfirmation) return;
  const password = form.elements.namedItem("password").value;
  if (confirmation.length === 0) {
    event.preventDefault();
    setConfirmError("Please confirm your password.");
    return;
  }
  if (password !== confirmation) {
    event.preventDefault();
    setConfirmError("Passwords do not match.");
    return;
  }
};
```

This is pure client-side validation — the confirm field has no `name` attribute and is never submitted to Kratos.

### Transition from Password to Profile

After successful password submission, Kratos updates the flow with a success message. The Auth Portal setup page detects this:

```tsx
const allMessages = [
  ...(flow.ui.messages || []),
  ...flow.ui.nodes.flatMap((node) => node.messages || []),
];
const hasSuccessMessage = allMessages.some((message) => message.type === "success");

if (setupStep === "password" && hasSuccessMessage) {
  redirect(`/setup?flow=${flow.id}&step=profile`);
}
```

### Stage 2: Profile Step

Same flow ID, but rendered differently:

```tsx
<KratosFlowForm
  flow={flow}
  title="Create your profile"
  description={`Now complete your profile details for ${accountEmail}.`}
  sectionGroups={["profile"]}
  fieldAllowlist={["traits.email", "traits.name.first", "traits.name.last", "traits.gender"]}
  readonlyFieldNames={["traits.email"]}
  submitAllowlist={["method"]}
  hideBackOnlySections
  links={[{
    href: `/setup?flow=${flow.id}&step=password`,
    label: "Back to password",
  }]}
/>
```

After successful profile submission:
```tsx
if (setupStep === "profile" && hasSuccessMessage) {
  if (returnTo) redirect(returnTo);
  redirect("/login");
}
```

---

## Logout Flow (Deep Dive)

### How Kratos Logout Works

Kratos logout is a two-step process:

**Step 1: Request logout token**
```
Auth Portal → GET http://kratos:4433/self-service/logout/browser
                ?return_to=http://localhost:3334
              Cookie: ory_kratos_session=...
```

Kratos returns a logout URL that includes a CSRF-protected token:
```json
{
  "logout_url": "/self-service/logout?token=abc123&return_to=http://localhost:3334"
}
```

Or if Kratos uses a redirect-based approach, it returns:
```
HTTP 303 Location: /self-service/logout?token=abc123&return_to=...
```

**Step 2: Execute logout**
```
Browser → GET http://localhost:4433/self-service/logout?token=abc123&return_to=...
```

Kratos:
1. Validates the token
2. Destroys the session (deletes `ory_kratos_session` cookie)
3. Redirects to `return_to`

### Auth Portal Logout Handler

File: `apps/auth/src/app/logout/route.ts`

The handler does three things:

1. **Sanitizes return_to** — only allows URLs from the web app or auth portal origins
2. **Fetches the logout flow** — forwards browser cookies so Kratos can identify the session
3. **Redirects to Kratos logout URL** — converts internal Docker URLs to browser-facing URLs

```tsx
// If Kratos responds with a redirect (Location header):
const location = response.headers.get("location");
if (location) {
  return NextResponse.redirect(toKratosBrowserUrl(location));
}

// If Kratos responds with JSON containing logout_url:
const body = await response.json();
if (typeof body.logout_url === "string") {
  return NextResponse.redirect(toKratosBrowserUrl(body.logout_url));
}
```

`toKratosBrowserUrl()` converts internal URLs to browser-accessible ones (e.g., `http://kratos:4433/...` → `http://localhost:4433/...`).

**Edge case — no session (401):** If the user's Kratos session is already gone, the handler redirects directly to `return_to` instead of trying to log out.

---

## Error Handling

### Flow Errors

When Kratos encounters a fatal error during a flow (not a validation error but a system error), it redirects to the configured error UI URL:

```
Location: http://localhost:3337/error?id=error-uuid
```

The Auth Portal error page fetches the error details:

```tsx
const flowError = errorId ? await getFlowErrorById(errorId) : null;
```

Which calls:
```
GET http://kratos:4433/self-service/errors?id=error-uuid
```

**Kratos error response:**
```json
{
  "error": {
    "id": "self_service_flow_expired",
    "code": 410,
    "reason": "The login flow expired 5 minutes ago, please try again.",
    "status": "Gone",
    "message": "self-service flow expired"
  }
}
```

The error page renders this:
```tsx
<AuthShell title="Authentication error" description={errorMessage}>
  {flowError?.error && (
    <pre>{JSON.stringify(flowError.error, null, 2)}</pre>
  )}
  <a href="/login">Back to sign in</a>
</AuthShell>
```

### Hydra Errors

The error page also handles Hydra error parameters (passed as query strings):

```tsx
const hydraError = getSingleParam(params, "error");
const hydraDescription = getSingleParam(params, "error_description");
```

Error message priority:
1. `error_description` (Hydra descriptive error)
2. `error` (Hydra error code)
3. `flowError.error.reason` (Kratos error reason)
4. `flowError.error.message` (Kratos error message)
5. `"Authentication flow failed. Please retry."` (fallback)

### Validation Errors (Non-Fatal)

Validation errors are not redirected to the error page. Instead, they appear in the flow response in two locations:

**Flow-level messages** (`flow.ui.messages[]`) — displayed as alerts above the form:
```json
{
  "ui": {
    "messages": [
      {
        "id": 4000006,
        "text": "The provided credentials are invalid...",
        "type": "error"
      }
    ]
  }
}
```

**Node-level messages** (`node.messages[]`) — displayed below specific fields:
```json
{
  "type": "input",
  "group": "code",
  "attributes": { "name": "code" },
  "messages": [
    {
      "id": 4000001,
      "text": "The code is not valid. Please try again.",
      "type": "error"
    }
  ]
}
```

---

## How Kratos Flow Responses Map to UI

### Complete Mapping Table

| Kratos Response Field | UI Component | What It Does |
|---|---|---|
| `flow.ui.action` | `<form action>` | Where the form POSTs to |
| `flow.ui.method` | `<form method>` | Always "POST" |
| `flow.ui.messages[]` | `FlowMessages` → `Alert` | Top-level info/error/success alerts |
| `node.group` | Section grouping | Nodes are grouped into sections by group name |
| `node.type === "input"` | Determines node handling | Only "input" type is supported |
| `node.attributes.type === "hidden"` | `<input type="hidden">` | CSRF tokens, method values |
| `node.attributes.type === "submit"` | `<Button>` | Submit buttons per section |
| `node.attributes.type === "email"` | `<Input type="email">` | Email fields |
| `node.attributes.type === "password"` | `<Input type="password">` | Password fields |
| `node.attributes.type === "text"` | `<Input type="text">` | Text fields (or select for gender) |
| `node.attributes.type === "checkbox"` | `<Checkbox>` | Boolean toggles |
| `node.attributes.name` | `<input name>` | Form field name (submitted to Kratos) |
| `node.attributes.value` | `defaultValue` | Pre-filled value |
| `node.attributes.required` | `required` | HTML validation |
| `node.attributes.disabled` | `disabled` | Prevents interaction |
| `node.meta.label.text` | `<Label>` content | Human-readable field label |
| `node.messages[]` | `<p>` below field | Per-field error/info/success messages |
| `node.attributes.name === "screen"` + `value === "previous"` | Hidden (filtered out) | Back navigation button |
| `flow.identity.traits` | Trait value fallback | Pre-populates fields in settings/setup |

### Node Classification Logic

```
For each node in flow.ui.nodes:

  Is type === "hidden"?
    → hiddenNode (rendered as <input type="hidden">)

  Is type === "submit" or "button"?
    → submitNode (rendered as <Button>)

  Is name === "screen" && value === "previous"?
    → backNavigationSubmit (usually filtered out)

  Otherwise (has name, not hidden, not submit)?
    → renderableInputNode (rendered as visible form field)
```

### Label Resolution Priority

1. `node.meta.label.text` (Kratos-provided label)
2. Hardcoded overrides in `getNodeLabel()`:
   - `"identifier"` or `"traits.email"` → `"Email"`
   - `"password"` → `"Password"`
   - `"code"` → `"Verification Code"`
   - `"totp_code"` → `"Authenticator Code"`
3. Name-based fallback: split on `.`, take last segment, replace `_`/`-` with spaces, capitalize

### Autocomplete Resolution

| Field Name | Context | Autocomplete Value |
|---|---|---|
| `identifier` | any | `"email"` |
| `traits.email` | any | `"email"` |
| `code`, `*_code` | any | `"one-time-code"` |
| `password` | registration or settings URL | `"new-password"` |
| `password` | login URL | `"current-password"` |
| `traits.name.first` | any | `"given-name"` |
| `traits.name.last` | any | `"family-name"` |
| anything else | any | `"off"` |

---

## Kratos Session Model

### Session Structure

When the Auth Portal calls `GET /sessions/whoami`, Kratos returns:

```json
{
  "id": "session-uuid",
  "active": true,
  "expires_at": "2026-03-13T00:00:00Z",
  "authenticated_at": "2026-03-12T12:00:00Z",
  "authenticator_assurance_level": "aal1",
  "identity": {
    "id": "identity-uuid",
    "schema_id": "default",
    "schema_url": "file:///etc/config/kratos/identity.schema.json",
    "state": "active",
    "traits": {
      "email": "user@example.com",
      "name": { "first": "Jane", "last": "Doe" },
      "gender": "female"
    },
    "verifiable_addresses": [
      {
        "id": "address-uuid",
        "value": "user@example.com",
        "verified": true,
        "via": "email",
        "status": "completed",
        "verified_at": "2026-03-12T12:00:00Z"
      }
    ],
    "recovery_addresses": [
      {
        "id": "recovery-uuid",
        "value": "user@example.com",
        "via": "email"
      }
    ],
    "metadata_public": null,
    "metadata_admin": null
  }
}
```

### Email Verification Check

`isKratosEmailVerified(session)` in `apps/auth/src/lib/kratos.ts`:

```
1. Get verifiable_addresses[] from session.identity
2. Get traits.email (normalized to lowercase)
3. Find an address where:
   - verified === true
   - AND address.value (lowercase) === traits.email (lowercase)
4. If found → verified
5. If no trait email → check if ANY address is verified
```

This ensures the **current** email is verified, not a previously verified email that was changed.

### Profile Completeness Check

`isKratosProfileComplete(session)`:

```
1. Get traits.name.first (trimmed)
2. Get traits.name.last (trimmed)
3. Both must be non-empty strings
```

This is checked during the OAuth login challenge — if the profile is incomplete, the user is redirected to `/setup` to complete it before they can log into the web app.

---

## Hooks

Kratos hooks are actions that execute after a flow step completes successfully. They're configured per-flow and per-method in `kratos.yml`.

### Registration Hooks

```yaml
registration:
  after:
    code:
      hooks:
        - hook: session     # After email code verification → create session
    password:
      hooks:
        - hook: session                # Create session after password method
        - hook: show_verification_ui   # Force email verification
```

**`hook: session`** — Creates a Kratos browser session immediately. This sets the `ory_kratos_session` cookie. Without this hook, the user would complete registration but not be logged in.

In the BookShare flow, this hook fires after code verification (step 4 of registration). The session is needed because the next step (password setup) uses the settings flow, which requires an active session.

**`hook: show_verification_ui`** — Redirects the user to the email verification UI. This hook is on the password method, which isn't used during the current registration flow (code method is used instead). It's there as a safety net in case someone registers directly with the password method.

### Why Session After Code Verification?

The registration flow is:
1. Email entry → code sent
2. Code verification → **session created here** → redirect to `/setup`
3. Password setup (uses settings flow — requires active session)
4. Profile setup (same settings flow)

Without the session hook after code verification, the user would arrive at `/setup` without a session. The settings flow (`GET /self-service/settings/browser`) would return 401, and the setup would fail.

---

## Courier (Email)

Kratos uses a courier system to send emails (verification codes, recovery codes).

### Configuration

```yaml
courier:
  smtp:
    connection_uri: smtp://mailpit:1025/?skip_ssl_verify=true&disable_starttls=true
```

In development, emails are delivered to **Mailpit** (a dev mail sink). Mailpit captures all outgoing emails and provides a web UI to view them (accessible on port 4436 via Docker Compose).

### What Emails Kratos Sends

| Trigger | Email Content |
|---|---|
| Registration (code method) | 6-digit verification code |
| Email verification | 6-digit verification code |
| Password recovery | 6-digit recovery code |
| Email change (if enabled) | Verification code for new email |

### Email Templates

Kratos uses built-in email templates. They can be customized via the `courier.template_override_path` config, but BookShare currently uses the defaults.

---

## Secrets & Cryptography

### Cookie Secret

```yaml
secrets:
  cookie:
    - change-this-dev-cookie-secret
```

Used to sign Kratos session cookies (`ory_kratos_session`). In production, this must be a strong random string (at least 32 characters). Rotating this secret invalidates all existing sessions.

Kratos supports secret rotation — you can list multiple secrets. The first one is used for signing new cookies; all are tried for verification (so old sessions still work during rotation).

### Cipher Secret

```yaml
secrets:
  cipher:
    - 32-char-dev-secret-change-me-123
```

Used to encrypt sensitive identity data at rest (e.g., recovery tokens, verification codes). Must be exactly 32 characters for XChaCha20-Poly1305.

### Hashing

```yaml
ciphers:
  algorithm: xchacha20-poly1305

hashers:
  algorithm: bcrypt
  bcrypt:
    cost: 8
```

**XChaCha20-Poly1305:** Used for encrypting sensitive data in the database (tokens, codes). Modern authenticated encryption.

**Bcrypt (cost 8):** Used for password hashing. Cost 8 is on the lower end (suitable for development — faster login checks). Production should use cost 12-14 for stronger brute-force resistance.

---

## File Reference

| File | Purpose |
|---|---|
| `infra/ory/kratos/kratos.yml` | Full Kratos configuration |
| `infra/ory/kratos/identity.schema.json` | Identity traits schema |
| `apps/auth/src/lib/kratos.ts` | Kratos API client + session helpers |
| `apps/auth/src/lib/kratos-ui.ts` | Node label + autocomplete resolution |
| `apps/auth/src/lib/config.ts` | URL configuration |
| `apps/auth/src/middleware.ts` | Registration flow cookie persistence |
| `apps/auth/src/components/kratos-flow-form.tsx` | Main flow form component |
| `apps/auth/src/components/flow/partition.ts` | Node grouping + section building |
| `apps/auth/src/components/flow/section.tsx` | Form section rendering |
| `apps/auth/src/components/flow/field.tsx` | Individual field rendering |
| `apps/auth/src/components/flow/messages.tsx` | Flow-level message alerts |
| `apps/auth/src/components/flow/footer-links.tsx` | Navigation links |
| `apps/auth/src/components/flow/types.ts` | TypeScript interfaces |
| `apps/auth/src/components/auth-shell.tsx` | Card layout wrapper |
| `apps/auth/src/app/login/page.tsx` | Login page |
| `apps/auth/src/app/register/page.tsx` | Registration page |
| `apps/auth/src/app/register/reset/route.ts` | Registration reset handler |
| `apps/auth/src/app/setup/page.tsx` | Post-registration setup (password + profile) |
| `apps/auth/src/app/recovery/page.tsx` | Password recovery page |
| `apps/auth/src/app/verification/page.tsx` | Email verification page |
| `apps/auth/src/app/settings/page.tsx` | Account settings page |
| `apps/auth/src/app/logout/route.ts` | Kratos logout handler |
| `apps/auth/src/app/welcome/page.tsx` | Post-verification landing |
| `apps/auth/src/app/error/page.tsx` | Error display page |
