import { NextResponse } from "next/server";
import { createLogger } from "@bookshare/logger";
import { buildAuthPortalLogoutUrl } from "@/domain/auth/lib/auth-portal";

const logger = createLogger({ service: "bookstores-auth" }).child({
  route: "api.auth.post-logout",
});

export async function GET() {
  const redirectTo = buildAuthPortalLogoutUrl();
  logger.info({ redirectTo }, "Continuing bookstores logout through auth portal");
  return NextResponse.redirect(redirectTo);
}
