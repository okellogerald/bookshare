import { NextRequest, NextResponse } from "next/server";
import { getBookshareAppPublicUrl } from "@/shared/lib/config";
import { getHydraLoginChallenge } from "@/shared/lib/hydra-login-context";
import {
  getKratosSession,
  hasKratosAuthenticationMethod,
} from "@/shared/lib/kratos";

export async function GET(request: NextRequest) {
  // Settings completion is an auth-owned decision point. If auth is currently
  // servicing a Hydra login transaction, resume that transaction first.
  const hydraChallenge = await getHydraLoginChallenge();
  if (hydraChallenge) {
    return NextResponse.redirect(new URL("/oauth/resume", request.url));
  }

  const session = await getKratosSession(request.headers.get("cookie") ?? "");
  if (!session || hasKratosAuthenticationMethod(session, "code_recovery")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.redirect(new URL("/profile", getBookshareAppPublicUrl()));
}
