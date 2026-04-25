import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";
import { getSession } from "@/domain/auth/lib/session";
import { isAdminConsoleRole } from "@bookshare/shared";
import { Button } from "@/shared/components/ui/button";

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();
  const params = await searchParams;

  if (
    session?.user.emailVerified &&
    (session.user.roles ?? []).some(isAdminConsoleRole)
  ) {
    redirect("/catalog");
  }

  return (
    <main className="flex min-h-screen">
      {/* Brand panel */}
      <div className="relative hidden lg:flex lg:w-[58%] flex-col justify-between overflow-hidden p-12 xl:p-16 bg-[hsl(224,20%,12%)] text-white">
        <div className="pointer-events-none absolute left-[12%] top-[18%] h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
        <p className="text-xs font-semibold tracking-[0.18em] uppercase text-white/40">
          BookShare
        </p>

        <div className="relative max-w-md">
          <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/8 ring-1 ring-white/10">
            <LockKeyhole className="h-6 w-6 text-white/70" />
          </div>
          <h1 className="text-5xl xl:text-6xl font-semibold tracking-tight leading-[1.1]">
            Admin
            <br />
            Portal
          </h1>
          <p className="mt-5 text-base text-white/50 max-w-sm leading-relaxed">
            Sign in with an approved BookShare staff account.
          </p>
        </div>

        <p className="text-xs text-white/25">Internal use only</p>
      </div>

      {/* Auth panel */}
      <div className="flex flex-1 flex-col items-center justify-center px-8 py-12 bg-background">
        <div className="w-full max-w-[360px] space-y-8">
          {/* Mobile identity */}
          <div className="lg:hidden">
            <p className="text-xs font-semibold tracking-[0.18em] uppercase text-muted-foreground">
              BookShare
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">
              Admin Portal
            </h1>
          </div>

          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              Sign in to the admin portal
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              For approved BookShare staff accounts only.
            </p>
          </div>

          <div className="space-y-3 rounded-2xl border border-border/75 bg-card px-5 py-4">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4 flex-none text-primary" />
              Verified email required
            </div>
            <div className="h-px bg-border/60" />
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4 flex-none text-primary" />
              Staff role required
            </div>
          </div>

          <Button
            asChild
            size="lg"
            className="w-full justify-between rounded-[1.15rem] px-5"
          >
            <Link href="/api/auth/login?returnTo=/catalog">
              Sign in to admin portal
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>

          {params.error === "forbidden" ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              This account doesn&apos;t have admin-console access.
            </p>
          ) : null}
        </div>
      </div>
    </main>
  );
}
