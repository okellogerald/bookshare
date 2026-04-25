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
        <section className="relative hidden overflow-hidden lg:flex lg:w-[56%] flex-col justify-between bg-[hsl(210,35%,12%)] px-12 py-16 text-white">
          <div className="pointer-events-none absolute right-[12%] top-[18%] h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 left-12 h-64 w-64 rounded-full bg-white/8 blur-2xl" />
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
            BookShare
          </p>
          <div className="relative max-w-md space-y-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/8 ring-1 ring-white/10">
              <Building2 className="h-6 w-6 text-white/70" />
            </div>
            <h1 className="text-5xl font-semibold leading-[1.05] tracking-tight">
              Bookstore
              <br />
              Portal
            </h1>
            <p className="max-w-md text-base leading-relaxed text-white/60">
              Sign in with the BookShare account connected to your bookstore
              invitation.
            </p>
          </div>
          <p className="text-xs text-white/30">Invite-based bookstore access</p>
        </section>

        <section className="flex flex-1 items-center justify-center bg-background px-8 py-12">
          <div className="w-full max-w-[360px] space-y-8">
            <div className="lg:hidden">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                BookShare
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight">
                Bookstore Portal
              </h1>
            </div>

            <div>
              <h2 className="text-2xl font-semibold tracking-tight">
                Sign in to the bookstore portal
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Use your invited BookShare account.
              </p>
            </div>

            <div className="space-y-3 rounded-2xl border border-border/75 bg-card px-5 py-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-3">
                <Building2 className="h-4 w-4 text-primary" />
                Bookstore invitation required
              </div>
              <div className="h-px bg-border/60" />
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-primary" />
                Verified email required for invites
              </div>
            </div>

            <Button asChild size="lg" className="w-full justify-between rounded-[1.15rem] px-5">
              <Link href="/api/auth/login?returnTo=/">
                Sign in to bookstore portal
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
