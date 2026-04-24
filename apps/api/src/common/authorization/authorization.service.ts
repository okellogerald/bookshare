import {
  ForbiddenException,
  Inject,
  Injectable,
} from "@nestjs/common";
import {
  type Database,
  organizationMemberships,
  permissionGrants,
} from "@bookshare/db";
import {
  type AuthorizationPermission,
  type AuthorizationScopeType,
  PLATFORM_SCOPE_ID,
  createPlatformScope,
  getBookstoreRolePermissionBundle,
  getPlatformRolePermissionBundle,
  isAuthorizationPermission,
  isPlatformAuthorizationRole,
  mapBookstoreMembershipRoleToAuthorizationRole,
  type EffectiveAuthorizationGrant,
} from "@bookshare/shared";
import { and, eq } from "drizzle-orm";
import { DRIZZLE } from "../../drizzle/drizzle.service";
import type { AuthenticatedUser } from "../guards";

interface PermissionScopeInput {
  scopeType: AuthorizationScopeType;
  scopeId: string;
}

@Injectable()
export class AuthorizationService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async resolveEffectivePermissions(
    user: Pick<AuthenticatedUser, "id" | "roles">
  ): Promise<EffectiveAuthorizationGrant[]> {
    const grants: EffectiveAuthorizationGrant[] = [];

    for (const role of user.roles) {
      if (!isPlatformAuthorizationRole(role)) continue;

      for (const permission of getPlatformRolePermissionBundle(role)) {
        grants.push({
          permission,
          ...createPlatformScope(),
          source: "role",
          role,
        });
      }
    }

    const [memberships, directGrants] = await Promise.all([
      this.db.query.organizationMemberships.findMany({
        columns: {
          organizationId: true,
          role: true,
        },
        where: and(
          eq(organizationMemberships.userId, user.id),
          eq(organizationMemberships.status, "active")
        ),
      }),
      this.db.query.permissionGrants.findMany({
        where: eq(permissionGrants.userId, user.id),
      }),
    ]);

    for (const membership of memberships) {
      const role = mapBookstoreMembershipRoleToAuthorizationRole(
        membership.role
      );
      if (!role) continue;

      for (const permission of getBookstoreRolePermissionBundle(role)) {
        grants.push({
          permission,
          scopeType: "bookstore",
          scopeId: membership.organizationId,
          source: "role",
          role,
        });
      }
    }

    for (const grant of directGrants) {
      if (!isAuthorizationPermission(grant.permission)) {
        continue;
      }

      grants.push({
        permission: grant.permission,
        scopeType: grant.scopeType,
        scopeId: grant.scopeId,
        source: "direct",
      });
    }

    return this.dedupeGrants(grants);
  }

  hasPermission(
    user: Pick<AuthenticatedUser, "permissionGrants">,
    permission: AuthorizationPermission,
    scope: PermissionScopeInput = createPlatformScope()
  ) {
    return user.permissionGrants.some((grant) => {
      if (grant.permission !== permission) {
        return false;
      }

      if (scope.scopeType === "platform") {
        return (
          grant.scopeType === "platform" && grant.scopeId === PLATFORM_SCOPE_ID
        );
      }

      return (
        (grant.scopeType === "platform" &&
          grant.scopeId === PLATFORM_SCOPE_ID) ||
        (grant.scopeType === scope.scopeType &&
          grant.scopeId === scope.scopeId)
      );
    });
  }

  hasPlatformPermission(
    user: Pick<AuthenticatedUser, "permissionGrants">,
    permission: AuthorizationPermission
  ) {
    return user.permissionGrants.some(
      (grant) =>
        grant.permission === permission &&
        grant.scopeType === "platform" &&
        grant.scopeId === PLATFORM_SCOPE_ID
    );
  }

  assertPermission(
    user: Pick<AuthenticatedUser, "permissionGrants">,
    permission: AuthorizationPermission,
    scope: PermissionScopeInput = createPlatformScope()
  ) {
    if (!this.hasPermission(user, permission, scope)) {
      throw new ForbiddenException("You do not have permission for this action.");
    }
  }

  private dedupeGrants(grants: EffectiveAuthorizationGrant[]) {
    const deduped = new Map<string, EffectiveAuthorizationGrant>();

    for (const grant of grants) {
      const key = `${grant.permission}:${grant.scopeType}:${grant.scopeId}`;
      if (!deduped.has(key)) {
        deduped.set(key, grant);
      }
    }

    return Array.from(deduped.values());
  }
}
