/**
 * Hydra Logout Challenge Handler — Auth-Portal
 *
 * Phase 2 of the logout flow. Hydra redirects here after the client initiates
 * RP-initiated logout. This handler simply accepts the challenge — there's no
 * user confirmation for first-party apps.
 *
 * After acceptance, Hydra invalidates its OAuth session and redirects to the
 * client's `post_logout_redirect_uri`.
 *
 * @see `apps/web/src/app/api/auth/logout/route.ts` — Phase 1 (client initiates)
 * @see `/logout` (this app) — Phase 3 (Kratos session cleanup)
 */
import { NextRequest, NextResponse } from "next/server";
import { getAuthPortalPublicUrl } from "@/shared/lib/config";
import { hydraAdminRequest } from "@/shared/lib/hydra";

export async function GET(request: NextRequest) {
  const challenge = request.nextUrl.searchParams.get("logout_challenge");

  if (!challenge) {
    return NextResponse.json(
      { error: "missing logout_challenge" },
      { status: 400 }
    );
  }

  try {
    const accepted = await hydraAdminRequest<{ redirect_to: string }>(
      `/admin/oauth2/auth/requests/logout/accept?logout_challenge=${encodeURIComponent(challenge)}`,
      {
        method: "PUT",
        body: JSON.stringify({}),
      }
    );

    return NextResponse.redirect(accepted.redirect_to);
  } catch (error) {
    console.error("OAuth logout challenge handling failed", error);
    return NextResponse.redirect(`${getAuthPortalPublicUrl()}/error`);
  }
}
