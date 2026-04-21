import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { AuthenticatedUser } from "./auth.guard";
import { REQUIRED_ROLES_KEY } from "./roles.decorator";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_ROLES_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (!required?.length) {
      return true;
    }

    const user = context.switchToHttp().getRequest().user as
      | AuthenticatedUser
      | undefined;
    const roles = new Set(user?.roles ?? []);

    if (required.some((role) => roles.has(role))) {
      return true;
    }

    throw new ForbiddenException("You do not have permission for that action.");
  }
}
