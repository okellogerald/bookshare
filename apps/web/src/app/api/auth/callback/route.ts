import { NextRequest, NextResponse } from "next/server";
import {
  clearOIDCClientCookies,
  clearOIDCTransactionCookies,
  readOIDCTransaction,
} from "@bookshare/shared";
import * as client from "openid-client";
import { getOIDCConfig } from "@/features/auth/lib/oidc";
import { setSession } from "@/features/auth/lib/session";
import { decrypt } from "@/features/auth/lib/crypto";
import {
  generateDPoPKeyPair,
  exportPrivateKeyJwk,
  createDPoPProof,
  tokenHasDpopBinding,
} from "@/features/auth/lib/dpop";
import { WEB_OIDC_COOKIE_NAMES } from "@/features/auth/lib/cookie-names";

const API_URL =
  process.env.API_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://api:3333/api";

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

function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return false;
}

export async function GET(request: NextRequest) {
  const config = await getOIDCConfig();
  const transaction = await readOIDCTransaction({
    cookies: request.cookies,
    decrypt,
    cookieNames: WEB_OIDC_COOKIE_NAMES,
    defaultReturnTo: "/browse",
  });

  if (!transaction) {
    return NextResponse.redirect(
      new URL("/api/auth/login", request.url)
    );
  }

  try {
    // Generate DPoP keypair for token binding
    const dpopKeyPair = await generateDPoPKeyPair();
    const dpopHandle = client.getDPoPHandle(config, dpopKeyPair);

    const currentUrl = new URL(request.url);
    const tokens = await client.authorizationCodeGrant(
      config,
      currentUrl,
      {
        pkceCodeVerifier: transaction.codeVerifier,
        expectedState: transaction.expectedState,
        idTokenExpected: true,
      },
      undefined,
      { DPoP: dpopHandle }
    );

    const claims = tokens.claims()!;
    const emailVerified = toBoolean(claims.email_verified);
    const accessTokenIsDpopBound =
      !!tokens.access_token && tokenHasDpopBinding(tokens.access_token);

    if (!emailVerified) {
      const response = NextResponse.redirect(new URL("/auth/verification", request.url));
      clearOIDCClientCookies(response.cookies, WEB_OIDC_COOKIE_NAMES);
      return response;
    }

    // Serialize DPoP private key for session storage
    const dpopJwk = accessTokenIsDpopBound
      ? await exportPrivateKeyJwk(dpopKeyPair)
      : undefined;

    if (tokens.access_token && !accessTokenIsDpopBound) {
      console.warn(
        "OIDC token response did not include cnf.jkt; falling back to Bearer for API requests."
      );
    }

    await setSession({
      idToken: tokens.id_token,
      expiresAt:
        claims.exp ?? Math.floor(Date.now() / 1000) + 3600,
      dpopJwk,
      user: {
        id: claims.sub,
        email: claims.email as string | undefined,
        name: claims.name as string | undefined,
        username: claims.preferred_username as string | undefined,
        emailVerified,
      },
    }, tokens.access_token);

    const apiToken = resolveApiToken(tokens.access_token, tokens.id_token);
    if (apiToken) {
      try {
        const syncUrl = `${API_URL}/profiles/sync`;
        const headers: Record<string, string> = {};

        if (dpopJwk && tokenHasDpopBinding(apiToken)) {
          const dpopProof = await createDPoPProof(dpopJwk, "POST", syncUrl, apiToken);
          headers["Authorization"] = `DPoP ${apiToken}`;
          headers["DPoP"] = dpopProof;
        } else {
          headers["Authorization"] = `Bearer ${apiToken}`;
        }

        if (tokens.access_token) {
          headers["x-auth-access-token"] = tokens.access_token;
        }

        const syncResponse = await fetch(syncUrl, {
          method: "POST",
          headers,
        });
        if (!syncResponse.ok) {
          const syncErrorText = await syncResponse.text();

          if (
            syncResponse.status === 401 &&
            syncErrorText.toLowerCase().includes("deactivated")
          ) {
            const blockedResponse = NextResponse.redirect(
              new URL("/?error=account_deactivated", request.url)
            );
            clearOIDCClientCookies(blockedResponse.cookies, WEB_OIDC_COOKIE_NAMES);
            return blockedResponse;
          }

          console.error(
            `Profile sync on callback failed with status ${syncResponse.status}: ${syncErrorText}`
          );
        }
      } catch (syncError) {
        console.error("Profile sync on callback failed:", syncError);
      }
    }

    // Clean up OIDC cookies and redirect back to requested route
    const response = NextResponse.redirect(new URL(transaction.returnTo, request.url));
    clearOIDCTransactionCookies(response.cookies, WEB_OIDC_COOKIE_NAMES);

    return response;
  } catch (error) {
    console.error("OIDC callback error:", error);
    const response = NextResponse.redirect(
      new URL("/?error=auth_failed", request.url)
    );
    clearOIDCClientCookies(response.cookies, WEB_OIDC_COOKIE_NAMES);
    return response;
  }
}
