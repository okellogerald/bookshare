/**
 * OAuth2 Callback — Admin Client (Authorization Code Exchange)
 *
 * Identical to the Web callback in structure, but with one key difference:
 *
 * **Role gate**: After exchanging the code for tokens, this route checks that
 * the user has an allowed admin-console role (`platform_admin` or
 * `platform_staff`). Users without those roles are rejected with a
 * `?error=forbidden` redirect.
 *
 * @see `apps/web/src/app/api/auth/callback/route.ts` — Web version
 * @see `auth/web/src/app/oauth/consent/route.ts` — where roles are injected
 * @see `auth/web/src/shared/lib/staff-roles.ts` — role resolution logic
 */
import { NextRequest, NextResponse } from "next/server";
import {
  clearOIDCClientCookies,
  clearOIDCTransactionCookies,
  readOIDCTransaction,
} from "@bookshare/shared";
import { createLogger } from "@bookshare/logger";
import * as client from "openid-client";
import { decrypt } from "@/domain/auth/lib/crypto";
import { getOIDCConfig } from "@/domain/auth/lib/oidc";
import { setSession } from "@/domain/auth/lib/session";
import {
  buildAuthPortalVerificationUrl,
} from "@/domain/auth/lib/auth-portal";
import {
  PlatformRole,
  isAdminConsoleRole,
  isAdminEmailAddress,
} from "@bookshare/shared";
import {
  ADMIN_OIDC_COOKIE_NAMES,
} from "@/domain/auth/lib/cookie-names";

const logger = createLogger({ service: "admin-auth" }).child({
  route: "api.auth.callback",
});

/** Normalizes claim values to boolean — Hydra may encode them as strings. */
function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return false;
}

/**
 * Extract platform roles from the ID token claims.
 */
function extractRoles(claims: Record<string, unknown>): string[] {
  const roles = new Set<string>();

  if (Array.isArray(claims.roles)) {
    for (const value of claims.roles) {
      if (typeof value === "string") roles.add(value);
    }
  }

  if (
    isAdminEmailAddress(
      typeof claims.email === "string" ? claims.email : null,
      process.env.ADMIN_EMAIL_DOMAIN
    )
  ) {
    roles.add(PlatformRole.PLATFORM_STAFF);
  }

  return Array.from(roles);
}

export async function GET(request: NextRequest) {
  const config = await getOIDCConfig();
  const transaction = await readOIDCTransaction({
    cookies: request.cookies,
    decrypt,
    cookieNames: ADMIN_OIDC_COOKIE_NAMES,
    defaultReturnTo: "/catalog",
  });

  if (!transaction) {
    logger.warn("Missing admin OIDC transaction; redirecting to login");
    return NextResponse.redirect(new URL("/api/auth/login", request.url));
  }

  try {
    const tokens = await client.authorizationCodeGrant(
      config,
      new URL(request.url),
      {
        pkceCodeVerifier: transaction.codeVerifier,
        expectedState: transaction.expectedState,
        idTokenExpected: true,
      }
    );

    const claims = tokens.claims()!;
    const emailVerified = toBoolean(claims.email_verified);
    const roles = extractRoles(claims as Record<string, unknown>);

    // Gate 1: email must be verified before admin access.
    if (!emailVerified) {
      logger.warn(
        { subject: claims.sub ?? null, roles },
        "Admin OAuth callback rejected because email is not verified"
      );
      const response = NextResponse.redirect(
        buildAuthPortalVerificationUrl(transaction.returnTo)
      );
      clearOIDCClientCookies(response.cookies, ADMIN_OIDC_COOKIE_NAMES);
      return response;
    }

    // Gate 2: user must have an admin-console role.
    if (!roles.some(isAdminConsoleRole)) {
      logger.warn(
        { subject: claims.sub ?? null, roles, returnTo: transaction.returnTo },
        "Admin OAuth callback rejected because user lacks admin role"
      );
      const response = NextResponse.redirect(
        new URL("/?error=forbidden", request.url)
      );
      clearOIDCClientCookies(response.cookies, ADMIN_OIDC_COOKIE_NAMES);
      return response;
    }

    await setSession(
      {
        idToken: tokens.id_token,
        expiresAt: claims.exp ?? Math.floor(Date.now() / 1000) + 3600,
        user: {
          id: claims.sub,
          email: claims.email as string | undefined,
          name: claims.name as string | undefined,
          username: claims.preferred_username as string | undefined,
          emailVerified,
          roles,
        },
      },
      tokens.access_token
    );

    const response = NextResponse.redirect(
      new URL(transaction.returnTo, request.url)
    );
    clearOIDCTransactionCookies(response.cookies, ADMIN_OIDC_COOKIE_NAMES);
    logger.info(
      {
        subject: claims.sub ?? null,
        roles,
        returnTo: transaction.returnTo,
      },
      "Admin OAuth callback completed"
    );
    return response;
  } catch (error) {
    logger.error({ err: error }, "Admin OAuth callback failed");
    const response = NextResponse.redirect(new URL("/?error=auth_failed", request.url));
    clearOIDCClientCookies(response.cookies, ADMIN_OIDC_COOKIE_NAMES);
    return response;
  }
}
