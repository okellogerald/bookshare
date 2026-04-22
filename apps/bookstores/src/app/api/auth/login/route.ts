import { NextRequest, NextResponse } from "next/server";
import {
  buildScope,
  clearLoggedOutMarker,
  createLoginTransaction,
  persistOIDCTransaction,
} from "@bookshare/shared";
import { createLogger } from "@bookshare/logger";
import * as client from "openid-client";
import { encrypt } from "@/domain/auth/lib/crypto";
import { getOIDCConfig, getRedirectUri } from "@/domain/auth/lib/oidc";
import {
  BOOKSTORES_OIDC_COOKIE_NAMES,
} from "@/domain/auth/lib/cookie-names";

const logger = createLogger({ service: "bookstores-auth" }).child({
  route: "api.auth.login",
});

export async function GET(request: NextRequest) {
  const config = await getOIDCConfig();
  const redirectUri = getRedirectUri();
  const scope = buildScope(
    ["openid", "profile", "email"],
    process.env.OIDC_ADDITIONAL_SCOPES || "offline_access"
  );
  const transaction = await createLoginTransaction({
    requestedReturnTo: request.nextUrl.searchParams.get("returnTo"),
    defaultReturnTo: "/",
  });
  const authorizationParams: Record<string, string> = {
    redirect_uri: redirectUri,
    scope,
    code_challenge: transaction.codeChallenge,
    code_challenge_method: "S256",
    state: transaction.state,
  };

  if (request.nextUrl.searchParams.get("handoff") !== "1") {
    authorizationParams.prompt = "login";
    authorizationParams.max_age = "0";
  }

  const authorizationUrl = client.buildAuthorizationUrl(config, authorizationParams);
  const response = NextResponse.redirect(authorizationUrl.href);

  await persistOIDCTransaction({
    cookies: response.cookies,
    encrypt,
    cookieNames: BOOKSTORES_OIDC_COOKIE_NAMES,
    transaction,
  });
  clearLoggedOutMarker(response.cookies, BOOKSTORES_OIDC_COOKIE_NAMES.loggedOut);
  logger.info(
    {
      returnTo: transaction.returnTo,
      resolverHandoff: request.nextUrl.searchParams.get("handoff") === "1",
      authorizationHost: authorizationUrl.host,
      authorizationPath: authorizationUrl.pathname,
    },
    "Started bookstores OAuth login"
  );

  return response;
}
