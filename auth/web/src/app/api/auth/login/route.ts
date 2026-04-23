import { NextRequest, NextResponse } from "next/server";
import {
  buildScope,
  clearLoggedOutMarker,
  createLoginTransaction,
  persistOIDCTransaction,
} from "@bookshare/shared";
import { createLogger } from "@bookshare/logger";
import * as client from "openid-client";
import { encrypt } from "@/organizations/auth/crypto";
import {
  AUTH_ORG_OIDC_COOKIE_NAMES,
} from "@/organizations/auth/cookie-names";
import { getOIDCConfig, getRedirectUri } from "@/organizations/auth/oidc";

const logger = createLogger({ service: "auth-web" }).child({
  route: "api.auth.login",
});

export async function GET(request: NextRequest) {
  const config = await getOIDCConfig();
  const transaction = await createLoginTransaction({
    requestedReturnTo: request.nextUrl.searchParams.get("returnTo"),
    defaultReturnTo: "/organizations",
  });

  const authorizationUrl = client.buildAuthorizationUrl(config, {
    redirect_uri: getRedirectUri(),
    scope: buildScope(
      ["openid", "profile", "email"],
      process.env.OIDC_ADDITIONAL_SCOPES || "offline_access"
    ),
    code_challenge: transaction.codeChallenge,
    code_challenge_method: "S256",
    state: transaction.state,
    prompt: "login",
    max_age: "0",
  });

  const response = NextResponse.redirect(authorizationUrl.href);
  await persistOIDCTransaction({
    cookies: response.cookies,
    encrypt,
    cookieNames: AUTH_ORG_OIDC_COOKIE_NAMES,
    transaction,
  });
  clearLoggedOutMarker(response.cookies, AUTH_ORG_OIDC_COOKIE_NAMES.loggedOut);

  logger.info(
    {
      returnTo: transaction.returnTo,
      authorizationHost: authorizationUrl.host,
      authorizationPath: authorizationUrl.pathname,
    },
    "Started organizations OAuth login"
  );

  return response;
}
