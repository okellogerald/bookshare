/**
 * Chooser — "remove this account" action
 *
 * Deletes a single known-account entry from the `bookshare_known_accounts`
 * cookie and returns to the chooser. Does NOT revoke the Kratos or Hydra
 * sessions — it only forgets the chip. The user can sign out fully via the
 * regular `/logout` flow.
 *
 * @see `/chooser/page.tsx` — renders the form that POSTs here
 * @see `/logout/route.ts` — full Kratos logout
 */
import { NextRequest, NextResponse } from "next/server";
import { getAuthPortalPublicUrl } from "@/shared/lib/config";
import { removeKnownAccount } from "@/shared/lib/known-accounts-cookie";

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const sub = (form.get("sub") ?? "").toString().trim();

  const response = NextResponse.redirect(
    new URL("/chooser", getAuthPortalPublicUrl())
  );

  if (sub) {
    await removeKnownAccount(response, sub);
  }

  return response;
}
