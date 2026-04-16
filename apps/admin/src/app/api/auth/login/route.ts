import { NextRequest, NextResponse } from "next/server";
import {
  buildScope,
  clearLoggedOutMarker,
  createLoginTransaction,
  persistOIDCTransaction,
} from "@bookshare/shared";
import * as client from "openid-client";
import { encrypt } from "@/domain/auth/lib/crypto";
import { getOIDCConfig, getRedirectUri } from "@/domain/auth/lib/oidc";
import {
  ADMIN_OIDC_COOKIE_NAMES,
} from "@/domain/auth/lib/cookie-names";

export async function GET(request: NextRequest) {
  const config = await getOIDCConfig();
  const redirectUri = getRedirectUri();
  const scope = buildScope(
    ["openid", "profile", "email"],
    process.env.OIDC_ADDITIONAL_SCOPES || "offline_access"
  );
  const transaction = await createLoginTransaction({
    requestedReturnTo: request.nextUrl.searchParams.get("returnTo"),
    defaultReturnTo: "/catalog",
  });
  const authorizationUrl = client.buildAuthorizationUrl(config, {
    redirect_uri: redirectUri,
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
    cookieNames: ADMIN_OIDC_COOKIE_NAMES,
    transaction,
  });
  clearLoggedOutMarker(response.cookies, ADMIN_OIDC_COOKIE_NAMES.loggedOut);

  return response;
}
