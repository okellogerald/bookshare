import { NextRequest, NextResponse } from "next/server";
import {
  clearOIDCClientCookies,
  clearOIDCTransactionCookies,
  readOIDCTransaction,
} from "@bookshare/shared";
import * as client from "openid-client";
import { decrypt } from "@/organizations/auth/crypto";
import { AUTH_ORG_OIDC_COOKIE_NAMES } from "@/organizations/auth/cookie-names";
import { getOIDCConfig } from "@/organizations/auth/oidc";
import { setOrganizationSession } from "@/organizations/auth/session";

function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return false;
}

function extractRoles(claims: Record<string, unknown>): string[] {
  if (!Array.isArray(claims.roles)) return [];
  return claims.roles.filter((value): value is string => typeof value === "string");
}

export async function GET(request: NextRequest) {
  const config = await getOIDCConfig();
  const transaction = await readOIDCTransaction({
    cookies: request.cookies,
    decrypt,
    cookieNames: AUTH_ORG_OIDC_COOKIE_NAMES,
    defaultReturnTo: "/organizations",
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
    if (!emailVerified) {
      const response = NextResponse.redirect(new URL("/verification", request.url));
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
          roles: extractRoles(claims as Record<string, unknown>),
        },
      },
      tokens.access_token
    );

    const response = NextResponse.redirect(
      new URL(transaction.returnTo, request.url)
    );
    clearOIDCTransactionCookies(response.cookies, AUTH_ORG_OIDC_COOKIE_NAMES);
    return response;
  } catch {
    const response = NextResponse.redirect(
      new URL("/organizations?error=auth_failed", request.url)
    );
    clearOIDCClientCookies(response.cookies, AUTH_ORG_OIDC_COOKIE_NAMES);
    return response;
  }
}
