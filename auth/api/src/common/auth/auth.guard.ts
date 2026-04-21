import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as jwt from "jsonwebtoken";
import jwksClient, { JwksClient } from "jwks-rsa";

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
  roles?: string[];
}

export interface AuthenticatedUser {
  id: string;
  email?: string;
  emailVerified: boolean;
  name?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  roles: string[];
}

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly jwksClient: JwksClient;

  constructor(private readonly configService: ConfigService) {
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
      cacheMaxAge: 600000,
    });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedException("No authorization token provided");
    }

    try {
      const payload = await this.verifyToken(token);
      request.user = this.mapUser(payload);
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException("Invalid or expired token");
    }
  }

  private extractBearerToken(request: any) {
    const authorization = request.headers?.authorization;
    if (!authorization) return null;
    const [type, token] = authorization.split(" ");
    return type === "Bearer" && token ? token : null;
  }

  private getIssuer() {
    return this.configService.getOrThrow<string>("OIDC_ISSUER");
  }

  private normalizeEmail(value: string | undefined | null) {
    const normalized = value?.trim().toLowerCase();
    return normalized ? normalized : null;
  }

  private parseBootstrapEmails() {
    return new Set(
      (this.configService.get<string>("BOOTSTRAP_ADMIN_EMAILS") ?? "")
        .split(",")
        .map((value) => this.normalizeEmail(value))
        .filter((value): value is string => !!value)
    );
  }

  private mapUser(payload: IdentityJwtPayload): AuthenticatedUser {
    const roles = new Set(
      Array.isArray(payload.roles)
        ? payload.roles.filter((value): value is string => typeof value === "string")
        : []
    );
    const email = this.normalizeEmail(payload.email) ?? undefined;
    if (email && this.parseBootstrapEmails().has(email)) {
      roles.add("platform_admin");
    }

    return {
      id: payload.sub,
      email,
      emailVerified:
        payload.email_verified === true ||
        payload.email_verified === "true",
      name: payload.name,
      username: payload.preferred_username,
      firstName: payload.given_name,
      lastName: payload.family_name,
      roles: Array.from(roles),
    };
  }

  private async verifyToken(token: string): Promise<IdentityJwtPayload> {
    const issuer = this.getIssuer();

    return new Promise((resolve, reject) => {
      jwt.verify(
        token,
        (header, callback) => {
          this.jwksClient.getSigningKey(header.kid, (err, key) => {
            if (err) return callback(err);
            callback(null, key?.getPublicKey());
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
}
