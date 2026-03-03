import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import * as jwt from "jsonwebtoken";
import jwksClient, { JwksClient } from "jwks-rsa";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

interface ZitadelJwtPayload {
  sub: string;
  iss: string;
  aud: string[];
  exp: number;
  iat: number;
  email?: string;
  name?: string;
  "urn:zitadel:iam:org:id"?: string;
  "urn:zitadel:iam:user:resourceowner:id"?: string;
  "urn:zitadel:iam:org:project:roles"?: Record<
    string,
    Record<string, string>
  >;
}

export interface AuthenticatedUser {
  id: string;
  email?: string;
  name?: string;
  roles: string[];
}

@Injectable()
export class AuthGuard implements CanActivate {
  private jwksClient: JwksClient;

  constructor(
    private readonly configService: ConfigService,
    private readonly reflector: Reflector
  ) {
    const issuer = this.configService.getOrThrow<string>("ZITADEL_ISSUER");
    const issuerInternal =
      this.configService.get<string>("ZITADEL_ISSUER_INTERNAL") || issuer;
    const issuerHost = new URL(issuer).host;

    this.jwksClient = jwksClient({
      jwksUri: `${issuerInternal}/oauth/v2/keys`,
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
      request.user = this.mapToAuthenticatedUser(payload);
      return true;
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }
  }

  private extractTokenFromHeader(request: any): string | null {
    const authorization = request.headers?.authorization;
    if (!authorization) return null;

    const [type, token] = authorization.split(" ");
    return type === "Bearer" ? token : null;
  }

  private async verifyToken(token: string): Promise<ZitadelJwtPayload> {
    const issuer = this.configService.getOrThrow<string>("ZITADEL_ISSUER");

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
          resolve(decoded as ZitadelJwtPayload);
        }
      );
    });
  }

  private mapToAuthenticatedUser(
    payload: ZitadelJwtPayload
  ): AuthenticatedUser {
    const roles = payload["urn:zitadel:iam:org:project:roles"]
      ? Object.keys(payload["urn:zitadel:iam:org:project:roles"])
      : [];

    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      roles,
    };
  }
}
