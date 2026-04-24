import { NextRequest, NextResponse } from "next/server";
import {
  clearOIDCClientCookies,
  clearOIDCTransactionCookies,
  readOIDCTransaction,
  type OIDCCallbackTransaction,
} from "@bookshare/shared";
import { createLogger, truncateForLog } from "@bookshare/logger";
import * as client from "openid-client";
import { getOIDCConfig } from "@/domains/auth/lib/oidc";
import { setSession } from "@/domains/auth/lib/session";
import { decrypt } from "@/domains/auth/lib/crypto";
import { WEB_OIDC_COOKIE_NAMES } from "@/domains/auth/lib/cookie-names";
import { buildAuthPortalVerificationUrl } from "@/domains/auth/lib/auth-portal";

const API_URL =
  process.env.API_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://api:3333/api";

const logger = createLogger({ service: "web-auth" }).child({
  route: "api.auth.callback",
});

type SyncResult =
  | { kind: "ok" }
  | { kind: "deactivated" }
  | { kind: "failed" }
  | { kind: "skipped" };

export async function GET(request: NextRequest) {
  const config = await getOIDCConfig();
  const transaction = await readOIDCTransaction({
    cookies: request.cookies,
    decrypt,
    cookieNames: WEB_OIDC_COOKIE_NAMES,
    defaultReturnTo: "/browse",
  });

  if (!transaction) {
    logger.warn("Missing web OIDC transaction; redirecting to login");
    return NextResponse.redirect(new URL("/api/auth/login", request.url));
  }

  return completeOAuthCallback(request, config, transaction);
}

async function completeOAuthCallback(
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
    const subject = claims.sub ?? null;
    const emailVerified = toBoolean(claims.email_verified);

    if (!emailVerified) {
      logger.warn(
        { subject },
        "Web OAuth callback rejected because email is not verified"
      );
      const response = NextResponse.redirect(
        buildAuthPortalVerificationUrl(transaction.returnTo)
      );
      clearOIDCClientCookies(response.cookies, WEB_OIDC_COOKIE_NAMES);
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

    const syncResult = await syncProfile(
      resolveApiToken(tokens.access_token, tokens.id_token),
      subject
    );

    if (syncResult.kind === "deactivated") {
      logger.warn({ subject }, "Web OAuth callback rejected deactivated account");
      const response = NextResponse.redirect(
        new URL("/?error=account_deactivated", request.url)
      );
      clearOIDCClientCookies(response.cookies, WEB_OIDC_COOKIE_NAMES);
      return response;
    }

    const response = NextResponse.redirect(
      new URL(transaction.returnTo, request.url)
    );
    clearOIDCTransactionCookies(response.cookies, WEB_OIDC_COOKIE_NAMES);

    logger.info(
      { subject, returnTo: transaction.returnTo, syncResult: syncResult.kind },
      "Web OAuth callback completed"
    );
    return response;
  } catch (error) {
    logger.error({ err: error }, "Web OAuth callback failed");
    const response = NextResponse.redirect(
      new URL("/?error=auth_failed", request.url)
    );
    clearOIDCClientCookies(response.cookies, WEB_OIDC_COOKIE_NAMES);
    return response;
  }
}

async function syncProfile(
  apiToken: string | null,
  subject: string | null
): Promise<SyncResult> {
  if (!apiToken) return { kind: "skipped" };

  try {
    const syncResponse = await fetch(`${API_URL}/profiles/sync`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiToken}` },
    });

    if (syncResponse.ok) return { kind: "ok" };

    const body = await syncResponse.text();
    if (
      syncResponse.status === 401 &&
      body.toLowerCase().includes("deactivated")
    ) {
      return { kind: "deactivated" };
    }

    logger.warn(
      {
        subject,
        status: syncResponse.status,
        body: truncateForLog(body),
      },
      "Web profile sync failed during OAuth callback"
    );
    return { kind: "failed" };
  } catch (error) {
    logger.warn(
      { err: error, subject },
      "Web profile sync request failed during OAuth callback"
    );
    return { kind: "failed" };
  }
}

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
): string | null {
  if (isJwtLike(idToken)) return idToken;
  if (isJwtLike(accessToken)) return accessToken;
  return accessToken ?? idToken ?? null;
}
