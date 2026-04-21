import { NextResponse } from "next/server";
import { clearOrganizationSession } from "@/organizations/auth/session";

export async function GET(request: Request) {
  await clearOrganizationSession();
  return NextResponse.redirect(new URL("/", request.url));
}
