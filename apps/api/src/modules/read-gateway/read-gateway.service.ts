import {
  BadGatewayException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  createPlatformScope,
  type AuthorizationPermission,
  PlatformRole,
  type ReadGatewayResourceName,
} from "@bookshare/shared";
import { AuthorizationService } from "../../common/authorization/authorization.service";
import type { AuthenticatedUser } from "../../common/guards";
import {
  READ_RESOURCE_CONFIG,
  type ReadAccessLevel,
  type ReadGatewayClientAudience,
} from "./read-resources";

interface ReadGatewayHeaders {
  accept?: string;
  prefer?: string;
  range?: string;
}

@Injectable()
export class ReadGatewayService {
  private readonly postgrestUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly authorizationService: AuthorizationService
  ) {
    this.postgrestUrl =
      this.configService.get<string>("POSTGREST_INTERNAL_URL") ||
      "http://postgrest:3000";
  }

  async read(
    resourceName: ReadGatewayResourceName,
    audience: ReadGatewayClientAudience,
    user: AuthenticatedUser | null,
    searchParams: URLSearchParams,
    headers: ReadGatewayHeaders = {}
  ) {
    const resource = READ_RESOURCE_CONFIG[resourceName];

    this.enforceAudience(audience, resource.docs.callableBy);
    this.enforceAccess(resource.access, user);
    this.enforcePermission(resource.permissionByAudience?.[audience], user);

    const params = new URLSearchParams(searchParams);
    this.applyBlockedParams(params, resource.blockedParams);
    this.applyLimit(params, resource.maxLimit);
    this.applyScope(resourceName, user, params);

    const url = new URL(`/${resource.source}`, this.postgrestUrl);
    url.search = params.toString();

    const requestHeaders: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (headers.prefer) requestHeaders.Prefer = headers.prefer;
    if (headers.range) requestHeaders.Range = headers.range;
    if (headers.accept && headers.accept !== "*/*") {
      requestHeaders.Accept = headers.accept;
    }

    let upstream: Response;
    try {
      upstream = await fetch(url, {
        headers: requestHeaders,
      });
    } catch {
      throw new BadGatewayException("Failed to reach PostgREST upstream");
    }

    if (upstream.status === 204) {
      return { data: null };
    }

    const contentType = upstream.headers.get("content-type") ?? "";
    const contentRange = upstream.headers.get("Content-Range");
    if (!upstream.ok) {
      const detail = contentType.includes("application/json")
        ? JSON.stringify(await upstream.json())
        : await upstream.text();
      throw new BadGatewayException(detail || "PostgREST read failed");
    }

    const data = contentType.includes("application/json")
      ? await upstream.json()
      : await upstream.text();

    const filteredData = this.filterResponse(resourceName, user, data);
    const count = contentRange
      ? (() => {
          const total = contentRange.split("/")[1];
          return total && total !== "*" ? parseInt(total, 10) : undefined;
        })()
      : Array.isArray(filteredData)
        ? filteredData.length
        : undefined;

    return {
      data: filteredData,
      ...(count !== undefined ? { count } : {}),
    };
  }

  private applyBlockedParams(
    params: URLSearchParams,
    blockedParams: string[] | undefined
  ) {
    for (const key of blockedParams ?? []) {
      params.delete(key);
    }
  }

  private applyLimit(params: URLSearchParams, maxLimit: number) {
    const rawLimit = params.get("limit");
    if (!rawLimit) return;

    const parsed = parseInt(rawLimit, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      params.delete("limit");
      return;
    }

    params.set("limit", String(Math.min(parsed, maxLimit)));
  }

  private applyScope(
    resourceName: ReadGatewayResourceName,
    user: AuthenticatedUser | null,
    params: URLSearchParams
  ) {
    const resource = READ_RESOURCE_CONFIG[resourceName];

    if (resource.scopeMode !== "self_unless_elevated") {
      return;
    }

    if (!user) {
      throw new UnauthorizedException("Authentication required");
    }

    if (
      resource.elevatedScopePermission &&
      this.hasRequiredPermission(user, resource.elevatedScopePermission)
    ) {
      return;
    }

    params.set("user_id", `eq.${user.id}`);
  }

  private filterResponse(
    resourceName: ReadGatewayResourceName,
    user: AuthenticatedUser | null,
    data: unknown
  ) {
    const resource = READ_RESOURCE_CONFIG[resourceName];

    if (
      !resource.hideBootstrapAdminsUnlessPermission ||
      (user !== null &&
        this.hasRequiredPermission(
          user,
          resource.hideBootstrapAdminsUnlessPermission
        )) ||
      !Array.isArray(data)
    ) {
      return data;
    }

    const bootstrapEmails = this.parseBootstrapEmails();

    return data.filter((row) => {
      if (!row || typeof row !== "object") {
        return true;
      }

      const email =
        typeof (row as { email?: unknown }).email === "string"
          ? (row as { email: string }).email.trim().toLowerCase()
          : null;

      return !email || !bootstrapEmails.has(email);
    });
  }

  private parseBootstrapEmails() {
    return new Set(
      (this.configService.get<string>("BOOTSTRAP_ADMIN_EMAILS") ?? "")
        .split(",")
        .map((value) => value.trim().toLowerCase())
        .filter((value) => value.length > 0)
    );
  }

  private enforceAccess(
    access: ReadAccessLevel,
    user: AuthenticatedUser | null
  ) {
    if (access === "public") {
      return;
    }

    if (!user) {
      throw new UnauthorizedException("Authentication required");
    }

    if (access === "authenticated") {
      return;
    }

    if (access === "platform_staff" && this.hasPlatformStaffAccess(user)) {
      return;
    }

    if (
      access === "platform_admin" &&
      user.roles.includes(PlatformRole.PLATFORM_ADMIN)
    ) {
      return;
    }

    throw new ForbiddenException("You do not have access to this resource");
  }

  private enforcePermission(
    permission:
      | AuthorizationPermission
      | AuthorizationPermission[]
      | undefined,
    user: AuthenticatedUser | null
  ) {
    if (!permission) {
      return;
    }

    if (!user) {
      throw new UnauthorizedException("Authentication required");
    }

    if (!this.hasRequiredPermission(user, permission)) {
      throw new ForbiddenException("You do not have access to this resource");
    }
  }

  private enforceAudience(
    audience: ReadGatewayClientAudience,
    allowedAudiences: ReadGatewayClientAudience[]
  ) {
    if (!allowedAudiences.includes(audience)) {
      throw new ForbiddenException("That read resource is not available here.");
    }
  }

  private hasPlatformStaffAccess(user: AuthenticatedUser | null) {
    if (!user) return false;

    return (
      user.roles.includes(PlatformRole.PLATFORM_ADMIN) ||
      user.roles.includes(PlatformRole.PLATFORM_STAFF)
    );
  }

  private hasRequiredPermission(
    user: AuthenticatedUser,
    requirement: AuthorizationPermission | AuthorizationPermission[]
  ) {
    const permissions = Array.isArray(requirement)
      ? requirement
      : [requirement];

    return permissions.some((permission) =>
      this.authorizationService.hasPermission(
        user,
        permission,
        createPlatformScope()
      )
    );
  }
}
