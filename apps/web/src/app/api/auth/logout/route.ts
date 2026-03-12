import { NextResponse } from "next/server";
import * as client from "openid-client";
import {
  getOIDCConfig,
} from "@/features/auth/lib/oidc";
import { buildAppPostLogoutUrl } from "@/features/auth/lib/auth-portal";
import { getSession } from "@/features/auth/lib/session";

export async function GET() {
  const postLogoutRedirectUri = buildAppPostLogoutUrl();
  const config = await getOIDCConfig();
  const session = await getSession();

  // Route through the IdP end-session endpoint so the remote SSO
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

  const clientId = process.env.OIDC_CLIENT_ID;
  if (clientId) {
    endSessionParams.client_id = clientId;
  }

  let redirectTarget = postLogoutRedirectUri;
  try {
    const logoutUrl = client.buildEndSessionUrl(config, endSessionParams);
    redirectTarget = logoutUrl.href;
  } catch {
    redirectTarget = postLogoutRedirectUri;
  }
  const response = NextResponse.redirect(redirectTarget);

  response.cookies.delete("bookshare_session");
  response.cookies.delete("bookshare_token");
  response.cookies.set("bookshare_logged_out", "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 30,
  });
  response.cookies.delete("oidc_code_verifier");
  response.cookies.delete("oidc_state");
  response.cookies.delete("oidc_return_to");

  return response;
}
