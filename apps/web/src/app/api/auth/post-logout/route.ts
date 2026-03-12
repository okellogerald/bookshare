import { NextResponse } from "next/server";
import { buildAuthPortalLogoutUrl } from "@/features/auth/lib/auth-portal";

export async function GET() {
  return NextResponse.redirect(buildAuthPortalLogoutUrl());
}
