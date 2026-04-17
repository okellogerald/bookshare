/**
 * OAuth2 Callback — Admin Client (Authorization Code Exchange)
 *
 * Identical to the Web callback in structure, but with one key difference:
 *
 * **Role gate**: After exchanging the code for tokens, this route checks that
 * the user has at least one staff role (owner, manager, staff, viewer).
 * Users without roles are rejected with a `?error=forbidden` redirect.
 * Roles are populated during the consent step by Auth-Portal's
 * `resolveStaffRoles()` function.
 *
 * @see `apps/web/src/app/api/auth/callback/route.ts` — Web version
 * @see `apps/auth/src/app/oauth/consent/route.ts` — where roles are injected
 * @see `apps/auth/src/lib/staff-roles.ts` — role resolution logic
 */
import { NextRequest, NextResponse } from "next/server";
import {
  clearOIDCClientCookies,
  clearOIDCTransactionCookies,
  readOIDCTransaction,
} from "@bookshare/shared";
import * as client from "openid-client";
import { decrypt } from "@/domain/auth/lib/crypto";
import { getOIDCConfig } from "@/domain/auth/lib/oidc";
import { setSession } from "@/domain/auth/lib/session";
import { buildAuthPortalVerificationUrl } from "@/domain/auth/lib/auth-portal";
import {
  ADMIN_OIDC_COOKIE_NAMES,
} from "@/domain/auth/lib/cookie-names";

/** Normalizes claim values to boolean — Hydra may encode them as strings. */
function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return false;
}

/**
 * Extract staff roles from the ID token claims.
 * Tries `claims.roles` first (direct array), then falls back to
 * `claims.realm_access.roles` (Keycloak-compatible nested format).
 * These roles were injected by Auth-Portal during the consent step.
 */
function extractRoles(claims: Record<string, unknown>): string[] {
  if (Array.isArray(claims.roles)) {
    return claims.roles.filter((value): value is string => typeof value === "string");
  }

  const realmAccess =
    typeof claims.realm_access === "object" && claims.realm_access !== null
      ? (claims.realm_access as { roles?: unknown })
      : null;

  if (Array.isArray(realmAccess?.roles)) {
    return realmAccess.roles.filter((value): value is string => typeof value === "string");
  }

  return [];
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
      const response = NextResponse.redirect(buildAuthPortalVerificationUrl());
      clearOIDCClientCookies(response.cookies, ADMIN_OIDC_COOKIE_NAMES);
      return response;
    }

    // Gate 2: user must have at least one staff role. Regular users
    // who somehow reach the admin login are rejected here.
    if (roles.length === 0) {
      const response = NextResponse.redirect(new URL("/?error=forbidden", request.url));
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
    return response;
  } catch (error) {
    const response = NextResponse.redirect(new URL("/?error=auth_failed", request.url));
    clearOIDCClientCookies(response.cookies, ADMIN_OIDC_COOKIE_NAMES);
    return response;
  }
}
