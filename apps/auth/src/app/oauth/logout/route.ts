import { NextRequest, NextResponse } from "next/server";
import { getAuthPortalPublicUrl } from "@/lib/config";
import { hydraAdminRequest } from "@/lib/hydra";

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
