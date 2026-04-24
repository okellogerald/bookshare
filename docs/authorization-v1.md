# Authorization V1

This document defines the central authorization model used across BookShare.

It is intentionally centered on domain permissions, shared scopes, and shared evaluation rules. It is not split into separate "admin permissions", "web permissions", or "bookstore permissions" systems.

## Core Model

- Roles are permission bundles.
- Users can receive direct permission grants in addition to their roles.
- Effective access is additive:
  `effective_permissions = role_bundle_permissions + direct_permission_grants`
- Authorization is enforced on the backend.
- UI visibility should follow the same effective-permission result, but UI checks are never the source of truth.

## Scopes

Assignments always carry a scope.

- `platform`
  Meaning: the grant is not tied to one bookstore. It applies across the BookShare platform.
- `bookstore:{id}`
  Meaning: the grant only applies inside one bookstore workspace.

Examples:

- `identity.password.reset @ platform`
- `catalog.read @ platform`
- `bookstore.member.suspend @ bookstore:abc123`

## Surfaces

Surface is separate from scope.

- Scope answers: "what data boundary does this apply to?"
- Surface answers: "through which app or interface may this be exercised?"

Current surfaces:

- `web_public`
- `web_member`
- `admin_console`
- `bookstore_portal`

We do not use `console` as a scope. Console is an interface, not a tenant boundary.

## Permission Domains

Current permission catalog:

- `console.access`
- `member.directory.read`
- `identity.password.reset`
- `identity.sessions.revoke`
- `identity.verification.require`
- `identity.account.deactivate`
- `identity.account.reactivate`
- `staff.directory.read`
- `staff.role.manage`
- `staff.permission.manage`
- `catalog.read`
- `catalog.write`
- `catalog.archive`
- `submission.read`
- `submission.review`
- `import.read`
- `import.validate`
- `import.commit`
- `bookstore.directory.read`
- `bookstore.status.manage`
- `bookstore.owner.manage`
- `bookstore.read`
- `bookstore.update`
- `bookstore.want.read`
- `bookstore.proposal.create`
- `bookstore.proposal.withdraw`
- `bookstore.member.read`
- `bookstore.invite.manage`
- `bookstore.member.role.manage`
- `bookstore.member.suspend`
- `bookstore.member.restore`
- `bookstore.member.remove`
- `bookstore.security.escalate`

## Default Role Bundles

### `platform_admin @ platform`

- All current platform permissions
- All current bookstore permissions, usable through platform-scoped evaluation

### `platform_staff @ platform`

- `console.access`
- `member.directory.read`
- `staff.directory.read`
- `catalog.read`
- `catalog.write`
- `submission.read`
- `submission.review`
- `import.read`
- `import.validate`
- `bookstore.directory.read`
- `bookstore.read`
- `bookstore.update`
- `bookstore.member.read`
- `bookstore.status.manage`

### `bookstore_admin @ bookstore:{id}`

- `bookstore.read`
- `bookstore.update`
- `bookstore.want.read`
- `bookstore.proposal.create`
- `bookstore.proposal.withdraw`
- `bookstore.member.read`
- `bookstore.invite.manage`
- `bookstore.member.role.manage`
- `bookstore.member.suspend`
- `bookstore.member.restore`
- `bookstore.member.remove`
- `bookstore.security.escalate`

### `bookstore_member @ bookstore:{id}`

- `bookstore.read`
- `bookstore.want.read`
- `bookstore.proposal.create`
- `bookstore.proposal.withdraw`

## Direct Grants

Direct grants are additive exceptions for specific users.

Examples:

- `platform_staff @ platform` plus `identity.password.reset @ platform`
- `platform_staff @ platform` plus `import.commit @ platform`
- `bookstore_member @ bookstore:abc123` plus `bookstore.member.read @ bookstore:abc123`

Operational rule:

- If one user needs an exception, use a direct grant.
- If the same exception set becomes common, promote it into a real role bundle.

## Bookstore Membership Suspension

Bookstores are allowed to protect their own workspace, but they are not allowed to control a user's global BookShare identity.

For that reason:

- Bookstores can suspend a membership.
- Bookstores cannot reset the BookShare password for all products.
- Bookstores cannot revoke all global sessions.
- Bookstores cannot globally deactivate a user.

Membership state:

- `active`
- `suspended`

When a membership is suspended:

- the user loses bookstore-scoped access for that bookstore
- the relationship remains on record
- the membership can be restored later

This is distinct from removing the membership entirely.

## Global Identity Boundary

Identity actions are platform-only because they affect the shared BookShare account.

Platform-only identity actions:

- `identity.password.reset`
- `identity.sessions.revoke`
- `identity.verification.require`
- `identity.account.deactivate`
- `identity.account.reactivate`

Bookstore admins should use bookstore membership suspension to protect their workspace. If the issue is broader, they should escalate to BookShare staff.

## Read Gateway

The read gateway is a policy-managed convenience layer for frontend-facing reads, especially PostgREST-backed views and queryable relations.

Important boundary:

- Not every GET endpoint must live in the read gateway.
- Use the read gateway when flexible client-side filtering is useful and we still want one backend-enforced policy point through the Next.js BFF layer.

Current read-gateway policy model:

- `callableBy`
- `access`
- `permissionByAudience`
- `scopeMode`
- `elevatedScopePermission`
- `blockedParams`
- `maxLimit`
- `hideBootstrapAdminsUnlessPermission`

The read-gateway resource manifest lives in:

- [apps/api/src/modules/read-gateway/read-resources.ts](/Users/mac/Desktop/Projects/bookshare/apps/api/src/modules/read-gateway/read-resources.ts)

### Current audience rules

- `web_public` is for anonymous public reads.
- `web_member` is for authenticated member reads in the main web app.
- `admin_console` is for reads routed through the admin Next.js BFF.
- `bookstore_portal` is for reads routed through the bookstore Next.js BFF.

The BFF is responsible for choosing the audience. Clients do not self-declare it.

In practice, permissions and scopes remain the primary gate. Surface exists to preserve product context and to support the few cases where one surface needs extra requirements or response shaping.

### Current elevated reads

`copies` and `wishes` are user-scoped by default.

Regular members are hard-scoped to their own `user_id`.

For `admin_console`, wider reads are currently allowed when the caller has either:

- `member.directory.read`
- `catalog.read`

That supports both:

- member-operations screens
- catalog-operation screens that work with member copies and wishes

## What Is Not Permission-Driven

Not all access rules should be modeled as assignable permissions.

Examples:

- a signed-in user editing their own profile through `/me`
- a signed-in user managing their own library or wishlist through their own endpoints
- a product decision not to expose self-delete at all

Those remain endpoint design and ownership rules, not permission grants.

## Implementation Notes

- Shared authorization constants live in `packages/shared`.
- Stored role assignments and direct grants live in the database.
- Effective permissions are resolved server-side on each request.
- Read-gateway resources should rely on the same central permission resolver as the rest of the API.
- Admin app entry is still coarse-role gated today; fine-grained console section gating can be layered on top of effective permissions without changing the central model.
