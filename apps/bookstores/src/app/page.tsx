import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Building2, Mail } from "lucide-react";
import { getSession } from "@/domain/auth/lib/session";
import { buildAuthPortalVerificationUrl } from "@/domain/auth/lib/auth-portal";
import { Button } from "@/shared/components/ui/button";
import { BookstoresHomeClient } from "./home-client";

export default async function LandingPage() {
  const session = await getSession();

  if (!session) {
    return (
      <main className="flex min-h-screen">
        <section className="hidden lg:flex lg:w-[56%] flex-col justify-between bg-[hsl(210,35%,12%)] px-12 py-16 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
            BookShare
          </p>
          <div className="space-y-6">
            <h1 className="text-5xl font-semibold leading-[1.05] tracking-tight">
              Bookstores
            </h1>
            <p className="max-w-md text-base leading-relaxed text-white/60">
              Review active requests from the community, manage your bookstore
              organization, and send proposals that route readers back to your
              public contact card.
            </p>
            <div className="grid max-w-xl gap-4 sm:grid-cols-2">
              {[
                "Browse active wants",
                "Manage bookstore members",
                "Keep one public contact card",
                "Send proposal notifications",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/75"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-white/30">Bookstore organization access</p>
        </section>

        <section className="flex flex-1 items-center justify-center bg-background px-8 py-12">
          <div className="w-full max-w-[360px] space-y-8">
            <div className="lg:hidden">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                BookShare
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight">
                Bookstores
              </h1>
            </div>

            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Use your BookShare account to create or join a bookstore
                organization.
              </p>
            </div>

            <div className="space-y-3 rounded-2xl border border-border/75 bg-card px-5 py-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-3">
                <Building2 className="h-4 w-4 text-primary" />
                Bookstore organizations
              </div>
              <div className="h-px bg-border/60" />
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-primary" />
                Verified email required for invites
              </div>
            </div>

            <Button asChild size="lg" className="w-full justify-between rounded-[1.15rem] px-5">
              <Link href="/api/auth/login?returnTo=/">
                Continue with SSO
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>
    );
  }

  if (session.user.emailVerified !== true) {
    redirect(buildAuthPortalVerificationUrl());
  }

  return <BookstoresHomeClient />;
}
