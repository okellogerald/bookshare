# Client-Owned Login Returns

BookShare has three first-party clients that share the same Ory-backed Auth
Portal:

- Web: reader/member experience.
- Admin: platform staff dashboard.
- Bookstores: bookstore organization workspaces.

The client that starts OAuth owns the post-login destination. Each client
passes a relative `returnTo` value to its own `/api/auth/login` route, stores
that value in the encrypted OIDC transaction cookie, and redirects directly to
that path from its `/api/auth/callback`.

The Auth Portal no longer resolves a user into another client after login, and
there is no `handoff=1` path. Client logins always request fresh authentication
with `prompt=login` and `max_age=0`; the Auth Portal starts a Kratos login flow
and uses a Kratos refresh login flow when a browser session already exists.

## Defaults

If a client login starts without `returnTo`, the client uses its local default:

- Web: `/browse`
- Admin: `/catalog`
- Bookstores: `/`

The Hydra client registration also stores the same default in client metadata
as `default_return_to` so the registered client configuration documents the
expected fallback for each client.

## Authorization Boundary

Each client still enforces its own access after token exchange:

- Admin middleware/callback require `platform_admin` or `platform_staff`.
- Bookstores API routes validate organization membership from the database.
- Web API routes validate the OIDC token and member account state.
