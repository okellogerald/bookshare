import { NextRequest, NextResponse } from "next/server";
import { createLogger } from "@bookshare/logger";
import { getAuthPortalPublicUrl } from "@/shared/lib/config";
import { clearHydraLoginChallenge } from "@/shared/lib/hydra-login-context";
import { answerHydraLoginChallenge } from "@/shared/lib/oauth-login-flow";

const logger = createLogger({ service: "auth-web" }).child({
  route: "oauth.login",
});

export async function GET(request: NextRequest) {
  // Hydra calls this route only when it has created a fresh login challenge.
  const challenge = request.nextUrl.searchParams.get("login_challenge")?.trim();

  if (!challenge) {
    logger.warn("Hydra login challenge request was missing login_challenge");
    return NextResponse.json(
      { error: "missing login_challenge" },
      { status: 400 }
    );
  }

  try {
    return await answerHydraLoginChallenge(request, challenge);
  } catch (error) {
    logger.error({ err: error }, "Hydra login challenge failed");

    const response = NextResponse.redirect(`${getAuthPortalPublicUrl()}/error`);
    clearHydraLoginChallenge(response);
    return response;
  }
}
