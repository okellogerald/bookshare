import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { getSession } from "@/domain/auth/lib/session";
import { isAdminConsoleRole } from "@bookshare/shared";
import { adminNavItems } from "@/shared/lib/admin-shell";
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
      <div className="hidden lg:flex lg:w-[58%] flex-col justify-between p-12 xl:p-16 bg-[hsl(224,20%,12%)] text-white">
        <p className="text-xs font-semibold tracking-[0.18em] uppercase text-white/40">
          BookShare
        </p>

        <div>
          <h1 className="text-5xl xl:text-6xl font-semibold tracking-tight leading-[1.1]">
            Admin
            <br />
            Console
          </h1>
          <p className="mt-5 text-base text-white/50 max-w-xs leading-relaxed">
            Internal tooling for catalog quality, ingestion, and member
            operations.
          </p>

          <div className="mt-14 space-y-4">
            {adminNavItems.map((item) => (
              <div key={item.href} className="flex items-start gap-4">
                <div className="mt-0.5 rounded-xl bg-white/8 p-2.5 ring-1 ring-white/10">
                  <item.icon className="h-4 w-4 text-white/70" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white/90">
                    {item.label}
                  </p>
                  <p className="mt-0.5 text-sm text-white/40 leading-snug">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
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
              Admin Console
            </h1>
          </div>

          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Staff access — verified account and platform role required.
            </p>
          </div>

          <div className="space-y-3 rounded-2xl border border-border/75 bg-card px-5 py-4">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4 flex-none text-primary" />
              Verified identity
            </div>
            <div className="h-px bg-border/60" />
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4 flex-none text-primary" />
              Admin console role
            </div>
          </div>

          <Button
            asChild
            size="lg"
            className="w-full justify-between rounded-[1.15rem] px-5"
          >
            <Link href="/api/auth/login?returnTo=/catalog">
              Continue with SSO
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
