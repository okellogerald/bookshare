/**
 * Chooser — "use this account" action
 *
 * The chooser page POSTs here when the user picks an account chip. To keep
 * the security model simple we ALWAYS force re-authentication: we route
 * through `/logout` (which terminates the Kratos session on this browser)
 * with a `return_to` of `/login?email=<hint>`. That lands the user on the
 * login form with their email prefilled so they only need to type the
 * password.
 *
 * The Hydra login-challenge cookie (`bookshare_hydra_login_challenge`) is
 * not touched by this handler, so it survives the round-trip and `/oauth/login`
 * can pick the challenge back up once Kratos authenticates the user again.
 *
 * Safety:
 * - The email hint is sourced from the known-accounts cookie (not the form
 *   body), so the chooser cannot be abused as an open-redirect into /login
 *   with an attacker-controlled prefill.
 * - Forcing re-auth defends against shared-browser misuse: picking a chip
 *   never bypasses the password check.
 *
 * @see `/chooser/page.tsx` — renders the form that POSTs here
 * @see `/logout/route.ts` — terminates Kratos session; returns to `return_to`
 * @see `/oauth/login/route.ts` — re-entered once the user logs back in
 */
import { NextRequest, NextResponse } from "next/server";
import { getAuthPortalPublicUrl } from "@/shared/lib/config";
import { getKnownAccounts } from "@/shared/lib/known-accounts-cookie";

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const sub = (form.get("sub") ?? "").toString().trim();

  const authBase = getAuthPortalPublicUrl();
  const accounts = await getKnownAccounts();
  const match = sub ? accounts.find((account) => account.sub === sub) : null;

  if (!match) {
    // Stale chip — cookie cleared or entry removed elsewhere. Fall through
    // to a normal login. The chooser cookie will re-populate on success.
    return NextResponse.redirect(new URL("/login", authBase));
  }

  // Build the eventual destination: the login page with email prefilled.
  const loginUrl = new URL("/login", authBase);
  loginUrl.searchParams.set("email", match.email);

  // Route via /logout so any existing Kratos session is terminated first.
  // /logout preserves the Hydra login-challenge cookie, so /oauth/login can
  // resume the challenge after the user re-enters their password.
  const logoutUrl = new URL("/logout", authBase);
  logoutUrl.searchParams.set("return_to", loginUrl.toString());

  return NextResponse.redirect(logoutUrl);
}
