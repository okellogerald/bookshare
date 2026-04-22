# Login Destination Resolution

BookShare has three first-party clients that share the same Ory-backed auth
portal:

- Web: reader/member experience.
- Admin: platform staff dashboard.
- Bookstores: bookstore organization workspaces.

The auth portal owns the destination decision after identity gates pass. Client
apps may start OAuth, but they do not decide where a user belongs.

## Resolution Order

Every completed login goes through these checks:

1. Kratos session exists.
2. Email is verified.
3. Profile has first and last name.
4. Admin access is resolved.
5. Bookstore organization access is resolved.
6. Web is used as the fallback.

The priority order is intentional:

```text
verified Kratos identity
  -> admin email/role
  -> bookstore membership or invite
  -> web
```

## Admin Rule

Any verified email in the admin domain is treated as an Admin user. The default
domain is `bookshare.local`, configurable through `ADMIN_EMAIL_DOMAIN`.

The domain rule is applied in three places:

- Auth portal role minting: `auth/web/src/shared/lib/staff-roles.ts`
- Main API token mapping: `apps/api/src/common/guards/auth.guard.ts`
- Admin callback defense: `apps/admin/src/app/api/auth/callback/route.ts`

The default role for the domain rule is `platform_staff`. Explicit
`platform_admin` assignment still comes from `BOOTSTRAP_ADMIN_EMAILS` or the
`staff_roles` table.

## Bookstore Rule

Bookstore access is resolved from the main application organization tables:

- `organizations`
- `organization_memberships`
- `organization_invites`

The resolver uses `organization_memberships.user_id` for active membership.
Before looking up memberships, it claims matching pending invites for the
verified email in an idempotent transaction:

1. Find pending invites by normalized verified email.
2. Keep only bookstore organizations.
3. Insert missing membership rows.
4. Mark those invites accepted.

If exactly one bookstore membership remains, the user is sent to that bookstore.
Approved bookstores open at `/orgs/:id/wants`; pending/rejected/suspended
bookstores open at `/orgs/:id/profile`.

If there are multiple bookstore memberships after invite claiming, the user is
sent to the Bookstores root chooser. The chosen bookstore is stored in a
Bookstores app httpOnly session cookie and is still backed by URL-based and API
membership checks.

## Resolver Route

The central resolver is entered through the existing auth-portal OAuth login
handler when no Hydra `login_challenge` is present:

```text
auth/web/src/app/oauth/login/route.ts
auth/web/src/shared/lib/login-destination.ts
```

`/resolve` is kept as a compatibility URL and middleware redirects it to
`/oauth/login` with the same query string. This avoids relying on Next.js dev
server route discovery for a newly added standalone route while still allowing
existing resolver URLs to work.

It returns one of these destination shapes internally:

```ts
type LoginDestination =
  | { kind: "admin" }
  | { kind: "bookstore"; bookstoreId: string; path: string }
  | { kind: "bookstore_choice"; path: string }
  | { kind: "web" };
```

The resolver accepts:

- `source=web|admin|bookstores`
- `returnTo=/relative/path`

`source` tells the resolver whether the current client already has a fresh app
session. If the destination is the same client as the source, the resolver
redirects directly. If the destination is a different client, it redirects to
that client's `/api/auth/login?handoff=1&returnTo=...`.

`handoff=1` tells the target client to start OAuth without `prompt=login` and
`max_age=0`, so the fresh Kratos session from the original login can be reused.
Normal user-clicked logins still force a fresh login screen.

## Client Callback Behavior

Web and Bookstores callbacks create their client session, then redirect to the
auth portal resolver.

Admin callback only creates an Admin session when the resolved token/email has
an Admin role. If not, it clears Admin auth cookies and sends the user to the
resolver so bookstore and web users are not stranded on a forbidden page.

## Required URLs

The auth portal needs browser-reachable URLs for all destinations:

- `BOOKSHARE_APP_PUBLIC_URL`
- `ADMIN_PUBLIC_URL`
- `BOOKSTORES_PUBLIC_URL`

Local defaults are:

- Web: `http://localhost:3334`
- Admin: `http://localhost:3338`
- Bookstores: `http://localhost:3339`

## Authorization Boundary

The resolver improves user experience, but it is not the authorization boundary.
Each client and API still enforces access independently:

- Admin middleware/callback require `platform_admin` or `platform_staff`.
- Bookstores API routes validate organization membership from the database.
- Web API routes validate the OIDC token and member account state.
