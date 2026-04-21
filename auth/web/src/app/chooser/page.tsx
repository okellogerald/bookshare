/**
 * Account Chooser — Auth-Portal
 *
 * Renders the list of accounts previously used in this browser (from the
 * `bookshare_known_accounts` cookie) so the user can pick which one to use
 * when a client is routed through `prompt=select_account`, or when they
 * click "Switch account" from a client.
 *
 * Picking an account:
 *   → POSTs to `/chooser/select` with the account's `sub`.
 *   → That handler sends the user to `/login?email=<hint>`, which prefills
 *     the identifier field so the user only has to enter their password.
 *   → If the existing Kratos session is already for that account and still
 *     valid, the /oauth/login handler will fast-accept with `skip=true`.
 *
 * Removing an account:
 *   → POSTs to `/chooser/remove` with the account's `sub`.
 *   → That handler deletes the entry from the cookie and returns here.
 *   → It does NOT revoke Kratos or Hydra sessions — those are cleared via
 *     the full logout flow at `/logout`.
 *
 * "Use another account":
 *   → Just navigates to `/login`, letting the user type a fresh email.
 *
 * @see `/oauth/login/route.ts` — routes here on `prompt=select_account`
 * @see `known-accounts-cookie.ts` — read/write logic for the cookie
 */
import Link from "next/link";
import { AuthShell } from "@/shared/components/auth-shell";
import { Button } from "@/shared/components/ui/button";
import { getKnownAccounts } from "@/shared/lib/known-accounts-cookie";

export const dynamic = "force-dynamic";

function getInitials(account: { email: string; name?: string }): string {
  if (account.name) {
    const parts = account.name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    if (parts.length === 1 && parts[0].length > 0) {
      return parts[0].slice(0, 2).toUpperCase();
    }
  }
  return account.email.slice(0, 2).toUpperCase();
}

export default async function ChooserPage() {
  const accounts = await getKnownAccounts();

  if (accounts.length === 0) {
    return (
      <AuthShell
        title="Choose an account"
        description="No accounts are remembered on this device. Sign in to continue."
      >
        <Button asChild className="flow-submit-button">
          <Link href="/login">Sign in</Link>
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Choose an account"
      description="Pick the account you want to use, or sign in with a different one."
    >
      <ul className="flex flex-col gap-2">
        {accounts.map((account) => (
          <li
            key={account.sub}
            className="group flex items-center gap-3 rounded-md border border-border/60 bg-card px-3 py-2 transition hover:bg-muted/60"
          >
            <form
              action="/chooser/select"
              method="post"
              className="flex flex-1 items-center gap-3"
            >
              <input type="hidden" name="sub" value={account.sub} />
              <span
                aria-hidden
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
              >
                {getInitials(account)}
              </span>
              <button
                type="submit"
                className="flex flex-1 flex-col text-left"
              >
                {account.name ? (
                  <span className="text-sm font-medium text-foreground">
                    {account.name}
                  </span>
                ) : null}
                <span className="text-sm text-muted-foreground">
                  {account.email}
                </span>
              </button>
            </form>

            <form action="/chooser/remove" method="post">
              <input type="hidden" name="sub" value={account.sub} />
              <button
                type="submit"
                aria-label={`Remove ${account.email}`}
                className="rounded-md px-2 py-1 text-xs text-muted-foreground opacity-0 transition hover:bg-muted hover:text-foreground focus:opacity-100 group-hover:opacity-100"
              >
                Remove
              </button>
            </form>
          </li>
        ))}
      </ul>

      <div className="pt-2">
        <Button
          asChild
          variant="outline"
          className="w-full justify-start rounded-md"
        >
          <Link href="/login">Use another account</Link>
        </Button>
      </div>
    </AuthShell>
  );
}
