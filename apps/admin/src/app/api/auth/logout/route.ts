import { NextResponse } from "next/server";
import * as client from "openid-client";
import { getOIDCConfig } from "@/features/auth/lib/oidc";
import { buildAppPostLogoutUrl } from "@/features/auth/lib/auth-portal";
import { getSession } from "@/features/auth/lib/session";
import {
  ADMIN_CODE_VERIFIER_COOKIE,
  ADMIN_LOGGED_OUT_COOKIE,
  ADMIN_RETURN_TO_COOKIE,
  ADMIN_SESSION_COOKIE,
  ADMIN_STATE_COOKIE,
  ADMIN_TOKEN_COOKIE,
} from "@/features/auth/lib/cookie-names";

export async function GET() {
  const postLogoutRedirectUri = buildAppPostLogoutUrl();
  const config = await getOIDCConfig();
  const session = await getSession();

  const params: {
    post_logout_redirect_uri: string;
    state: string;
    id_token_hint?: string;
    client_id?: string;
  } = {
    post_logout_redirect_uri: postLogoutRedirectUri,
    state: crypto.randomUUID(),
  };

  if (session?.idToken) {
    params.id_token_hint = session.idToken;
  }

  if (process.env.OIDC_CLIENT_ID) {
    params.client_id = process.env.OIDC_CLIENT_ID;
  }

  let redirectTarget = postLogoutRedirectUri;
  try {
    redirectTarget = client.buildEndSessionUrl(config, params).href;
  } catch {
    redirectTarget = postLogoutRedirectUri;
  }

  const response = NextResponse.redirect(redirectTarget);
  response.cookies.delete(ADMIN_SESSION_COOKIE);
  response.cookies.delete(ADMIN_TOKEN_COOKIE);
  response.cookies.delete(ADMIN_CODE_VERIFIER_COOKIE);
  response.cookies.delete(ADMIN_STATE_COOKIE);
  response.cookies.delete(ADMIN_RETURN_TO_COOKIE);
  response.cookies.set(ADMIN_LOGGED_OUT_COOKIE, "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 30,
  });

  return response;
}
