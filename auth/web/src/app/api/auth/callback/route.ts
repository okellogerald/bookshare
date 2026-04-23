import { NextRequest, NextResponse } from "next/server";
import {
  clearOIDCClientCookies,
  clearOIDCTransactionCookies,
  readOIDCTransaction,
  type OIDCCallbackTransaction,
} from "@bookshare/shared";
import { createLogger } from "@bookshare/logger";
import * as client from "openid-client";
import { decrypt } from "@/organizations/auth/crypto";
import { AUTH_ORG_OIDC_COOKIE_NAMES } from "@/organizations/auth/cookie-names";
import { getOIDCConfig } from "@/organizations/auth/oidc";
import { setOrganizationSession } from "@/organizations/auth/session";

const logger = createLogger({ service: "auth-web" }).child({
  route: "api.auth.callback",
});

export async function GET(request: NextRequest) {
  const config = await getOIDCConfig();
  const transaction = await readOIDCTransaction({
    cookies: request.cookies,
    decrypt,
    cookieNames: AUTH_ORG_OIDC_COOKIE_NAMES,
    defaultReturnTo: "/organizations",
  });

  if (!transaction) {
    logger.warn("Missing organizations OIDC transaction; redirecting to login");
    return NextResponse.redirect(new URL("/api/auth/login", request.url));
  }

  return completeOrganizationsCallback(request, config, transaction);
}

async function completeOrganizationsCallback(
  request: NextRequest,
  config: client.Configuration,
  transaction: OIDCCallbackTransaction
): Promise<NextResponse> {
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

    if (!emailVerified) {
      logger.warn(
        { subject: claims.sub ?? null, roles },
        "Organizations OAuth callback rejected because email is not verified"
      );
      const response = NextResponse.redirect(
        new URL("/verification", request.url)
      );
      clearOIDCClientCookies(response.cookies, AUTH_ORG_OIDC_COOKIE_NAMES);
      return response;
    }

    await setOrganizationSession(
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
    clearOIDCTransactionCookies(response.cookies, AUTH_ORG_OIDC_COOKIE_NAMES);

    logger.info(
      { subject: claims.sub ?? null, roles, returnTo: transaction.returnTo },
      "Organizations OAuth callback completed"
    );
    return response;
  } catch (error) {
    logger.error({ err: error }, "Organizations OAuth callback failed");
    const response = NextResponse.redirect(
      new URL("/organizations?error=auth_failed", request.url)
    );
    clearOIDCClientCookies(response.cookies, AUTH_ORG_OIDC_COOKIE_NAMES);
    return response;
  }
}

function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return false;
}

function extractRoles(claims: Record<string, unknown>): string[] {
  if (!Array.isArray(claims.roles)) return [];
  return claims.roles.filter(
    (value): value is string => typeof value === "string"
  );
}
