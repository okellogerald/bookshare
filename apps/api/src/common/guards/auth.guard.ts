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
import {
  jwtVerify,
  importJWK,
  calculateJwkThumbprint,
  type JWK,
} from "jose";
import { createHash } from "crypto";
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
  cnf?: {
    jkt?: string;
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

/** Maximum allowed clock skew for DPoP proof iat (seconds). */
const DPOP_IAT_TOLERANCE = 60;

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
    const { scheme, token } = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException("No authorization token provided");
    }

    try {
      const payload = await this.verifyToken(token);

      // Validate DPoP proof when using DPoP auth scheme
      if (scheme === "DPoP") {
        await this.validateDPoP(request, token, payload);
      }

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

  private extractTokenFromHeader(request: any): {
    scheme: "Bearer" | "DPoP";
    token: string | null;
  } {
    const authorization = request.headers?.authorization;
    if (!authorization) return { scheme: "Bearer", token: null };

    const [type, token] = authorization.split(" ");
    if (type === "Bearer") return { scheme: "Bearer", token };
    if (type === "DPoP") return { scheme: "DPoP", token };
    return { scheme: "Bearer", token: null };
  }

  /**
   * Validate DPoP proof JWT per RFC 9449.
   *
   * 1. Verify the proof JWT signature using the embedded JWK public key.
   * 2. Check typ, htm, htu, iat, ath claims.
   * 3. Verify the access token's cnf.jkt matches the proof key's thumbprint.
   */
  private async validateDPoP(
    request: any,
    accessToken: string,
    tokenPayload: IdentityJwtPayload
  ): Promise<void> {
    const dpopHeader = request.headers?.dpop;
    if (!dpopHeader) {
      throw new UnauthorizedException("Missing DPoP proof header");
    }

    // Decode DPoP proof header to get the embedded JWK
    const parts = dpopHeader.split(".");
    if (parts.length !== 3) {
      throw new UnauthorizedException("Invalid DPoP proof format");
    }

    const headerJson = Buffer.from(parts[0], "base64url").toString("utf8");
    const proofHeader = JSON.parse(headerJson);

    if (proofHeader.typ !== "dpop+jwt") {
      throw new UnauthorizedException("DPoP proof typ must be dpop+jwt");
    }

    if (!proofHeader.jwk) {
      throw new UnauthorizedException("DPoP proof must contain jwk header");
    }

    // Import the public key from the proof and verify the signature
    const publicKey = await importJWK(proofHeader.jwk as JWK, proofHeader.alg);
    const { payload: proofPayload } = await jwtVerify(dpopHeader, publicKey, {
      typ: "dpop+jwt",
    });

    // Validate htm (HTTP method)
    const httpMethod = (
      request.method ??
      request.raw?.method ??
      "GET"
    ).toUpperCase();
    if (proofPayload.htm !== httpMethod) {
      throw new UnauthorizedException("DPoP proof htm mismatch");
    }

    // Validate htu (HTTP URI — scheme + host + path, no query)
    const requestUrl = this.buildRequestUrl(request);
    if (proofPayload.htu !== requestUrl) {
      throw new UnauthorizedException("DPoP proof htu mismatch");
    }

    // Validate iat (issued-at within tolerance)
    const now = Math.floor(Date.now() / 1000);
    const iat = proofPayload.iat;
    if (!iat || Math.abs(now - iat) > DPOP_IAT_TOLERANCE) {
      throw new UnauthorizedException("DPoP proof iat out of range");
    }

    // Validate jti (present)
    if (!proofPayload.jti) {
      throw new UnauthorizedException("DPoP proof missing jti");
    }

    // Validate ath (access token hash)
    const expectedAth = createHash("sha256")
      .update(accessToken)
      .digest("base64url");
    if (proofPayload.ath !== expectedAth) {
      throw new UnauthorizedException("DPoP proof ath mismatch");
    }

    // Verify cnf.jkt binding: the access token's cnf.jkt must match
    // the SHA-256 thumbprint of the proof's public key (RFC 7638)
    const proofKeyThumbprint = await calculateJwkThumbprint(
      proofHeader.jwk as JWK,
      "sha-256"
    );

    if (!tokenPayload.cnf?.jkt) {
      throw new UnauthorizedException(
        "Access token missing cnf.jkt claim for DPoP binding"
      );
    }

    if (tokenPayload.cnf.jkt !== proofKeyThumbprint) {
      throw new UnauthorizedException(
        "DPoP proof key thumbprint does not match access token cnf.jkt"
      );
    }
  }

  private buildRequestUrl(request: any): string {
    const protocol = request.protocol || "http";
    const host =
      request.get?.("host") || request.headers?.host || "localhost";
    const path =
      request.originalUrl?.split("?")[0] ||
      request.url?.split("?")[0] ||
      "/";
    return `${protocol}://${host}${path}`;
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
