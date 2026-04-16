import { NextResponse } from "next/server";
import { buildAuthPortalLogoutUrl } from "@/domain/auth/lib/auth-portal";

export async function GET() {
  return NextResponse.redirect(buildAuthPortalLogoutUrl());
}
