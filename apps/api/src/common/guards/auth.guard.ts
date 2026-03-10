import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import * as jwt from "jsonwebtoken";
import jwksClient, { JwksClient } from "jwks-rsa";
import { type Database, memberProfiles } from "@bookshare/db";
import { eq } from "drizzle-orm";
import { DRIZZLE } from "../../drizzle/drizzle.service";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

interface IdentityJwtPayload {
  sub: string;
  iss: string;
  aud: string[] | string;
  exp: number;
  iat: number;
  email?: string;
  name?: string;
  preferred_username?: string;
  given_name?: string;
  family_name?: string;
  nickname?: string;
  gender?: string;
  roles?: string[];
  realm_access?: {
    roles?: string[];
  };
}

export interface AuthenticatedUser {
  id: string;
  email?: string;
  name?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  nickname?: string;
  gender?: string;
  tokenIssuedAt?: number;
  roles: string[];
}

@Injectable()
export class AuthGuard implements CanActivate {
  private jwksClient: JwksClient;

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly configService: ConfigService,
    private readonly reflector: Reflector
  ) {
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

    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException("No authorization token provided");
    }

    try {
      const payload = await this.verifyToken(token);
      const mappedUser = this.mapToAuthenticatedUser(payload);
      await this.ensureActiveAccount(mappedUser.id);
      request.user = mappedUser;
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
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
      ? payload.roles
      : Array.isArray(payload.realm_access?.roles)
        ? payload.realm_access.roles
        : [];

    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      username: payload.preferred_username,
      firstName: payload.given_name,
      lastName: payload.family_name,
      nickname: payload.nickname,
      gender: payload.gender,
      tokenIssuedAt: payload.iat,
      roles,
    };
  }
}
