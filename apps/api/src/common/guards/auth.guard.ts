import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { PinoLogger } from "nestjs-pino";
import * as jwt from "jsonwebtoken";
import jwksClient, { JwksClient } from "jwks-rsa";
import { type Database, memberProfiles, staffRoles } from "@bookshare/db";
import {
  type EffectiveAuthorizationGrant,
  PlatformRole,
  isAdminEmailAddress,
} from "@bookshare/shared";
import { eq } from "drizzle-orm";
import { DRIZZLE } from "../../drizzle/drizzle.service";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { IS_OPTIONAL_AUTH_KEY } from "../decorators/optional-auth.decorator";
import { AuthorizationService } from "../authorization/authorization.service";

interface IdentityJwtPayload {
  sub: string;
  iss: string;
  aud: string[] | string;
  exp: number;
  iat: number;
  email_verified?: boolean | string;
  email?: string;
  name?: string;
  preferred_username?: string;
  given_name?: string;
  family_name?: string;
  nickname?: string;
  gender?: string;
  roles?: string[];
}

export interface AuthenticatedUser {
  id: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  nickname?: string;
  gender?: string;
  tokenIssuedAt?: number;
  roles: string[];
  permissionGrants: EffectiveAuthorizationGrant[];
}

@Injectable()
export class AuthGuard implements CanActivate {
  private jwksClient: JwksClient;

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly configService: ConfigService,
    private readonly reflector: Reflector,
    private readonly logger: PinoLogger,
    private readonly authorizationService: AuthorizationService
  ) {
    this.logger.setContext(AuthGuard.name);
    const issuer = this.getIssuer();
    const issuerInternal =
      this.configService.get<string>("OIDC_ISSUER_INTERNAL") || issuer;
    const issuerHost = new URL(issuer).host;
    const jwksUri =
      this.configService.get<string>("OIDC_JWKS_URI") ||
      new URL("/.well-known/jwks.json", issuerInternal).toString();

    this.jwksClient = jwksClient({
      jwksUri,
      requestHeaders:
        issuerInternal === issuer ? undefined : { host: issuerHost },
      cache: true,
      cacheMaxEntries: 5,
      cacheMaxAge: 600000, // 10 minutes
    });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const isOptionalAuth = this.reflector.getAllAndOverride<boolean>(
      IS_OPTIONAL_AUTH_KEY,
      [context.getHandler(), context.getClass()]
    );

    const request = context.switchToHttp().getRequest();
    await this.authenticateRequest(request, { optional: isOptionalAuth });
    return true;
  }

  async authenticateRequest(
    request: any,
    options: { optional?: boolean } = {}
  ): Promise<AuthenticatedUser | null> {
    const optional = options.optional ?? false;
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      request.user = null;
      if (optional) return null;
      this.logger.warn(
        { method: request.method, path: request.url },
        "Missing authorization token"
      );
      throw new UnauthorizedException("No authorization token provided");
    }

    try {
      const payload = await this.verifyToken(token);
      const mappedUser = this.mapToAuthenticatedUser(payload);
      mappedUser.roles = await this.resolveAuthorizedRoles(mappedUser);
      mappedUser.permissionGrants =
        await this.authorizationService.resolveEffectivePermissions(mappedUser);
      await this.ensureActiveAccount(mappedUser.id);
      request.user = mappedUser;
      this.logger.debug(
        {
          method: request.method,
          path: request.url,
          userId: mappedUser.id,
          roles: mappedUser.roles,
          permissionCount: mappedUser.permissionGrants.length,
          optional,
        },
        "Authenticated request"
      );
      return mappedUser;
    } catch (error) {
      request.user = null;
      if (error instanceof UnauthorizedException) {
        if (!optional) {
          this.logger.warn(
            { err: error, method: request.method, path: request.url },
            "Authentication rejected"
          );
        }
        throw error;
      }
      if (optional) return null;
      this.logger.warn(
        { err: error, method: request.method, path: request.url },
        "Authorization token verification failed"
      );
      throw new UnauthorizedException("Invalid or expired token");
    }
  }

  private async ensureActiveAccount(userId: string) {
    const profile = await this.db.query.memberProfiles.findFirst({
      columns: { deactivatedAt: true },
      where: eq(memberProfiles.userId, userId),
    });

    if (profile?.deactivatedAt) {
      throw new UnauthorizedException("Account is deactivated");
    }
  }

  private extractTokenFromHeader(request: any): string | null {
    const authorization = request.headers?.authorization;
    if (!authorization) return null;
    const [type, token] = authorization.split(" ");
    return type === "Bearer" ? token : null;
  }

  private getIssuer(): string {
    return this.configService.getOrThrow<string>("OIDC_ISSUER");
  }

  private normalizeEmail(value: string | undefined) {
    if (!value) return null;
    const normalized = value.trim().toLowerCase();
    return normalized.length > 0 ? normalized : null;
  }

  private parseBootstrapEmails() {
    return new Set(
      (this.configService.get<string>("BOOTSTRAP_ADMIN_EMAILS") ?? "")
        .split(",")
        .map((value) => this.normalizeEmail(value))
        .filter((value): value is string => !!value)
    );
  }

  private getAdminEmailDomain() {
    return this.configService.get<string>("ADMIN_EMAIL_DOMAIN");
  }

  private async resolveAuthorizedRoles(
    user: Pick<AuthenticatedUser, "id" | "email" | "emailVerified" | "roles">
  ) {
    const roles = new Set<string>([PlatformRole.USER]);
    const email = this.normalizeEmail(user.email);

    for (const role of user.roles) {
      const normalized = this.normalizeRole(role);
      if (normalized) {
        roles.add(normalized);
      }
    }

    if (email && this.parseBootstrapEmails().has(email)) {
      roles.add(PlatformRole.PLATFORM_ADMIN);
    }

    if (
      user.emailVerified === true &&
      email &&
      isAdminEmailAddress(email, this.getAdminEmailDomain())
    ) {
      roles.add(PlatformRole.PLATFORM_STAFF);
    }

    const persistedRoles = await this.db
      .select({ role: staffRoles.role })
      .from(staffRoles)
      .where(eq(staffRoles.userId, user.id));

    for (const entry of persistedRoles) {
      const normalized = this.normalizeRole(entry.role);
      if (normalized) {
        roles.add(normalized);
      }
    }

    return Array.from(roles);
  }

  private normalizeRole(role: string | undefined) {
    if (!role) return null;
    return Object.values(PlatformRole).includes(
      role as (typeof PlatformRole)[keyof typeof PlatformRole]
    )
      ? role
      : null;
  }

  private async verifyToken(token: string): Promise<IdentityJwtPayload> {
    const issuer = this.getIssuer();

    return new Promise((resolve, reject) => {
      jwt.verify(
        token,
        (header, callback) => {
          this.jwksClient.getSigningKey(header.kid, (err, key) => {
            if (err) return callback(err);
            const signingKey = key?.getPublicKey();
            callback(null, signingKey);
          });
        },
        {
          issuer,
          algorithms: ["RS256"],
        },
        (err, decoded) => {
          if (err) return reject(err);
          resolve(decoded as IdentityJwtPayload);
        }
      );
    });
  }

  private mapToAuthenticatedUser(
    payload: IdentityJwtPayload
  ): AuthenticatedUser {
    const roles = Array.isArray(payload.roles)
      ? payload.roles.filter((value): value is string => typeof value === "string")
      : [];

    return {
      id: payload.sub,
      email: payload.email,
      emailVerified:
        payload.email_verified === true ||
        payload.email_verified === "true",
      name: payload.name,
      username: payload.preferred_username,
      firstName: payload.given_name,
      lastName: payload.family_name,
      nickname: payload.nickname,
      gender: payload.gender,
      tokenIssuedAt: payload.iat,
      roles,
      permissionGrants: [],
    };
  }
}
