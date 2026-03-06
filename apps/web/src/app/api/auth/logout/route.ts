import { NextResponse } from "next/server";
import * as client from "openid-client";
import {
  getOIDCConfig,
  getPostLogoutRedirectUri,
} from "@/features/auth/lib/oidc";
import { getSession } from "@/features/auth/lib/session";

const FORCE_LOGIN_COOKIE = "bookshare_force_login";

export async function GET() {
  const postLogoutRedirectUri = getPostLogoutRedirectUri();
  const config = await getOIDCConfig();
  const session = await getSession();

  // Always route through the IdP end-session endpoint so Zitadel's SSO
  // user-agent session is terminated as well (not just local cookies).
  const endSessionParams: {
    post_logout_redirect_uri: string;
    state: string;
    id_token_hint?: string;
    client_id?: string;
  } = {
    post_logout_redirect_uri: postLogoutRedirectUri,
    state: crypto.randomUUID(),
  };

  if (session?.idToken) {
    endSessionParams.id_token_hint = session.idToken;
  }

  if (process.env.ZITADEL_CLIENT_ID) {
    endSessionParams.client_id = process.env.ZITADEL_CLIENT_ID;
  }

  const logoutUrl = client.buildEndSessionUrl(config, endSessionParams);
  const response = NextResponse.redirect(logoutUrl.href);

  response.cookies.delete("bookshare_session");
  response.cookies.delete("bookshare_token");
  response.cookies.delete("oidc_code_verifier");
  response.cookies.delete("oidc_state");
  response.cookies.set(FORCE_LOGIN_COOKIE, "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 300,
  });

  return response;
}
