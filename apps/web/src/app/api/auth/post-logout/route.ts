/**
 * Post-Logout Redirect — Web Client
 *
 * Hydra redirects the browser here after invalidating the OAuth2 session
 * (Phase 2 of logout). This route simply bounces the browser to Auth-Portal's
 * `/logout` endpoint, which handles Phase 3 — clearing the Kratos session
 * cookie so the identity provider forgets the user.
 *
 * This intermediate hop exists because Hydra's `post_logout_redirect_uri`
 * must be a registered URL on the client, but the actual Kratos cleanup
 * lives on the Auth-Portal domain.
 *
 * @see `/api/auth/logout` — where the logout flow starts (Phase 1)
 * @see `apps/auth/src/app/logout/route.ts` — Kratos session cleanup (Phase 3)
 */
import { NextResponse } from "next/server";
import { buildAuthPortalLogoutUrl } from "@/features/auth/lib/auth-portal";

export async function GET() {
  return NextResponse.redirect(buildAuthPortalLogoutUrl());
}
