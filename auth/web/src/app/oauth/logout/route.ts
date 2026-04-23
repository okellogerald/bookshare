import { NextRequest, NextResponse } from "next/server";
import { createLogger } from "@bookshare/logger";
import { getAuthPortalPublicUrl } from "@/shared/lib/config";
import { hydraAdminRequest } from "@/shared/lib/hydra";

const logger = createLogger({ service: "auth-web" }).child({
  route: "oauth.logout",
});

export async function GET(request: NextRequest) {
  const challenge = request.nextUrl.searchParams.get("logout_challenge")?.trim();

  if (!challenge) {
    logger.warn("Hydra logout request was missing logout_challenge");
    return NextResponse.json(
      { error: "missing logout_challenge" },
      { status: 400 }
    );
  }

  try {
    const accepted = await hydraAdminRequest<{ redirect_to: string }>(
      `/admin/oauth2/auth/requests/logout/accept?logout_challenge=${encodeURIComponent(challenge)}`,
      { method: "PUT", body: JSON.stringify({}) }
    );

    logger.info("Hydra logout challenge accepted");
    return NextResponse.redirect(accepted.redirect_to);
  } catch (error) {
    logger.error({ err: error }, "Hydra logout challenge failed");
    return NextResponse.redirect(`${getAuthPortalPublicUrl()}/error`);
  }
}
