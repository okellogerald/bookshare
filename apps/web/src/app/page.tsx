import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowRight, BookOpen, Building2, ShieldCheck } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { sanitizeReturnTo } from "@/domains/auth/lib/auth-portal";

type LandingSearchParams = Record<string, string | string[] | undefined>;

const DEFAULT_ADMIN_PORTAL_URL = "http://localhost:3338";
const DEFAULT_BOOKSTORES_PORTAL_URL = "http://localhost:3339";

function getPortalUrl(value: string | undefined, fallback: string): string {
  return value?.trim() || fallback;
}

function getParam(params: LandingSearchParams, key: string): string | undefined {
  const value = params[key];
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<LandingSearchParams>;
}) {
  const cookieStore = await cookies();
  const params = await searchParams;
  const returnTo = sanitizeReturnTo(getParam(params, "returnTo"));
  const loggedOut =
    getParam(params, "logged_out") === "1" ||
    cookieStore.get("bookshare_logged_out")?.value === "1";
  const signInHref =
    returnTo === "/browse"
      ? "/api/auth/login"
      : `/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`;
  const adminPortalHref = getPortalUrl(
    process.env.ADMIN_PUBLIC_URL || process.env.NEXT_PUBLIC_ADMIN_URL,
    DEFAULT_ADMIN_PORTAL_URL
  );
  const bookstorePortalHref = getPortalUrl(
    process.env.BOOKSTORES_PUBLIC_URL || process.env.NEXT_PUBLIC_BOOKSTORES_URL,
    DEFAULT_BOOKSTORES_PORTAL_URL
  );

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-5xl overflow-hidden rounded-[2rem] border border-border/70 bg-card/85 shadow-[0_24px_80px_rgba(25,45,35,0.12)] backdrop-blur">
        <div className="grid lg:grid-cols-[1.08fr_0.92fr]">
          <section className="relative flex min-h-[360px] flex-col justify-between overflow-hidden bg-[hsl(161,44%,18%)] p-8 text-primary-foreground sm:min-h-[430px] sm:p-10 lg:min-h-[520px] lg:p-12">
            <div className="pointer-events-none absolute -right-20 top-12 h-64 w-64 rounded-full bg-[hsl(42,70%,72%)]/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 left-12 h-56 w-56 rounded-full bg-white/10 blur-2xl" />

            <div className="relative flex items-center gap-3 text-sm font-semibold tracking-[0.18em] uppercase text-white/65">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
                <BookOpen className="h-5 w-5" />
              </span>
              BookShare
            </div>

            <div className="relative max-w-xl space-y-6">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[hsl(42,70%,78%)]">
                Member access
              </p>
              <h1 className="text-5xl font-semibold leading-[1.02] tracking-tight sm:text-6xl">
                Share books with your community.
              </h1>
              <p className="max-w-lg text-base leading-relaxed text-white/70 sm:text-lg">
                Sign in as a BookShare member to browse available books, list
                copies you can share, and keep track of books you are looking
                for.
              </p>
            </div>

            <p className="relative text-xs text-white/35">
              Community book sharing
            </p>
          </section>

          <section className="flex items-center justify-center px-6 py-10 sm:px-10 lg:px-12">
            <div className="w-full max-w-[400px] space-y-8">
              <div className="space-y-3">
                <h2 className="text-2xl font-semibold tracking-tight">
                  Sign in to BookShare
                </h2>
                <p className="text-sm text-muted-foreground">
                  Choose member access unless you have been directed to a
                  bookstore or staff portal.
                </p>
              </div>

              {loggedOut ? (
                <p className="rounded-2xl border border-border bg-background/70 px-4 py-3 text-sm text-muted-foreground">
                  You have been logged out. Sign in again when you want to
                  continue.
                </p>
              ) : null}

              <Button
                size="lg"
                asChild
                className="h-12 w-full justify-between gap-3 rounded-[1rem] px-5"
              >
                <Link href={signInHref}>
                  Sign in as a BookShare member
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Other portals
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Button
                    variant="outline"
                    asChild
                    className="h-auto min-h-14 justify-start gap-3 rounded-2xl px-4 py-3 text-left"
                  >
                    <a href={bookstorePortalHref}>
                      <Building2 className="h-4 w-4 flex-none" />
                      <span>
                        <span className="block">Bookstore sign in</span>
                        <span className="block text-xs font-normal text-muted-foreground">
                          Invited bookstore teams
                        </span>
                      </span>
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    asChild
                    className="h-auto min-h-14 justify-start gap-3 rounded-2xl px-4 py-3 text-left"
                  >
                    <a href={adminPortalHref}>
                      <ShieldCheck className="h-4 w-4 flex-none" />
                      <span>
                        <span className="block">Admin portal sign in</span>
                        <span className="block text-xs font-normal text-muted-foreground">
                          BookShare staff only
                        </span>
                      </span>
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
