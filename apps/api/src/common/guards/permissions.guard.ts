import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { createPlatformScope, type AuthorizationPermission } from "@bookshare/shared";
import { AuthorizationService } from "../authorization/authorization.service";
import { PERMISSIONS_KEY } from "../decorators/permissions.decorator";
import type { AuthenticatedUser } from "./auth.guard";

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authorizationService: AuthorizationService
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions =
      this.reflector.getAllAndOverride<AuthorizationPermission[]>(
        PERMISSIONS_KEY,
        [context.getHandler(), context.getClass()]
      );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;

    if (!user) return false;

    return requiredPermissions.every((permission) =>
      this.authorizationService.hasPermission(
        user,
        permission,
        createPlatformScope()
      )
    );
  }
}
