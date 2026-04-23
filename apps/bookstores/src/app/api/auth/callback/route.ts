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
  BOOKSTORES_OIDC_COOKIE_NAMES,
} from "@/domain/auth/lib/cookie-names";

const API_URL =
  process.env.API_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://api:3333/api";

const logger = createLogger({ service: "bookstores-auth" }).child({
  route: "api.auth.callback",
});

/** Normalizes claim values to boolean — Hydra may encode them as strings. */
function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return false;
}

function isJwtLike(token?: string | null): token is string {
  return !!token && token.split(".").length === 3;
}

function resolveApiToken(
  accessToken?: string | null,
  idToken?: string | null
) {
  if (isJwtLike(accessToken)) return accessToken;
  if (isJwtLike(idToken)) return idToken;
  return accessToken ?? idToken ?? null;
}

export async function GET(request: NextRequest) {
  const config = await getOIDCConfig();
  const transaction = await readOIDCTransaction({
    cookies: request.cookies,
    decrypt,
    cookieNames: BOOKSTORES_OIDC_COOKIE_NAMES,
    defaultReturnTo: "/",
  });

  if (!transaction) {
    logger.warn("Missing bookstores OIDC transaction; redirecting to login");
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
      logger.warn(
        { subject: claims.sub ?? null },
        "Bookstores OAuth callback rejected because email is not verified"
      );
      const response = NextResponse.redirect(
        buildAuthPortalVerificationUrl(transaction.returnTo)
      );
      clearOIDCClientCookies(response.cookies, BOOKSTORES_OIDC_COOKIE_NAMES);
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
        },
      },
      tokens.access_token
    );

    const apiToken = resolveApiToken(tokens.access_token, tokens.id_token);
    if (apiToken) {
      try {
        await fetch(`${API_URL}/profiles/sync`, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiToken}` },
        });
      } catch (error) {
        logger.warn(
          { err: error, subject: claims.sub ?? null },
          "Bookstores profile sync failed during OAuth callback"
        );
      }
    }

    const response = NextResponse.redirect(
      new URL(transaction.returnTo, request.url)
    );
    clearOIDCTransactionCookies(response.cookies, BOOKSTORES_OIDC_COOKIE_NAMES);
    logger.info(
      {
        subject: claims.sub ?? null,
        returnTo: transaction.returnTo,
      },
      "Bookstores OAuth callback completed"
    );
    return response;
  } catch (error) {
    logger.error({ err: error }, "Bookstores OAuth callback failed");
    const response = NextResponse.redirect(new URL("/?error=auth_failed", request.url));
    clearOIDCClientCookies(response.cookies, BOOKSTORES_OIDC_COOKIE_NAMES);
    return response;
  }
}
