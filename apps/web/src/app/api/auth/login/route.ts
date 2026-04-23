import { NextRequest, NextResponse } from "next/server";
import {
  buildScope,
  clearLoggedOutMarker,
  createLoginTransaction,
  persistOIDCTransaction,
} from "@bookshare/shared";
import { createLogger } from "@bookshare/logger";
import * as client from "openid-client";
import { getOIDCConfig, getRedirectUri } from "@/domains/auth/lib/oidc";
import { encrypt } from "@/domains/auth/lib/crypto";
import { WEB_OIDC_COOKIE_NAMES } from "@/domains/auth/lib/cookie-names";

const logger = createLogger({ service: "web-auth" }).child({
  route: "api.auth.login",
});

export async function GET(request: NextRequest) {
  const config = await getOIDCConfig();
  const scope = buildScope(
    ["openid", "profile", "email"],
    process.env.OIDC_ADDITIONAL_SCOPES || "offline_access"
  );
  const transaction = await createLoginTransaction({
    requestedReturnTo: request.nextUrl.searchParams.get("returnTo"),
    defaultReturnTo: "/browse",
  });

  const authorizationUrl = client.buildAuthorizationUrl(config, {
    redirect_uri: getRedirectUri(),
    scope,
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
    cookieNames: WEB_OIDC_COOKIE_NAMES,
    transaction,
  });
  clearLoggedOutMarker(response.cookies, WEB_OIDC_COOKIE_NAMES.loggedOut);

  logger.info(
    {
      returnTo: transaction.returnTo,
      authorizationHost: authorizationUrl.host,
      authorizationPath: authorizationUrl.pathname,
    },
    "Started web OAuth login"
  );

  return response;
}
