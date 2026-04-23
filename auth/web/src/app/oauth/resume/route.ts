import { NextRequest, NextResponse } from "next/server";
import { createLogger } from "@bookshare/logger";
import { getBookshareAppPublicUrl } from "@/shared/lib/config";
import {
  clearHydraLoginChallenge,
  getHydraLoginChallenge,
} from "@/shared/lib/hydra-login-context";
import { resumeHydraLoginChallenge } from "@/shared/lib/oauth-login-flow";

const logger = createLogger({ service: "auth-web" }).child({
  route: "oauth.resume",
});

export async function GET(request: NextRequest) {
  // Kratos returns here after login, verification, or profile completion.
  const challenge = await getHydraLoginChallenge();

  if (!challenge) {
    logger.info("No pending Hydra login challenge; returning to BookShare");
    return NextResponse.redirect(getBookshareAppPublicUrl());
  }

  try {
    return await resumeHydraLoginChallenge(request, challenge);
  } catch (error) {
    logger.warn({ err: error }, "Pending Hydra login challenge could not resume");

    const response = NextResponse.redirect(getBookshareAppPublicUrl());
    clearHydraLoginChallenge(response);
    return response;
  }
}
