import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CheckCircle2, LockKeyhole, ShieldCheck } from "lucide-react";
import { getSession } from "@/domain/auth/lib/session";
import { isAdminConsoleRole } from "@bookshare/shared";
import { adminNavItems } from "@/shared/lib/admin-shell";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";

const landingStats = [
  { label: "Primary workspace", value: "Catalog operations" },
  { label: "Batch flow", value: "Validate before commit" },
  { label: "People ops", value: "Members + team" },
];

const promises = [
  "Launch focused catalog flows before creating new records.",
  "Validate importer ZIPs in the browser and keep recent runs visible.",
  "Work through member and team operations from dedicated admin surfaces.",
];

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
    <main className="mx-auto flex min-h-screen max-w-[1480px] flex-col px-4 py-6 sm:px-6 lg:px-8">
      <section className="grid flex-1 gap-4 xl:grid-cols-[minmax(0,1.15fr)_400px]">
        <Card className="relative overflow-hidden border-border/75 bg-card/[0.88]">
          <CardContent className="relative flex h-full flex-col justify-between p-8 sm:p-10">
            <div className="max-w-4xl">
              <Badge
                variant="secondary"
                className="border border-white/70 bg-white/75 px-3 py-1 text-secondary-foreground"
              >
                BookShare Admin
              </Badge>
              <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                Professional tooling for the people who keep BookShare clean.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">
                The admin console is the internal operating surface for catalog quality,
                browser-based ingestion, member operations, and team access control. It
                borrows the same warm BookShare visual language, but tightens it for
                operational work.
              </p>
            </div>

            <div className="mt-10 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)]">
              <div className="grid gap-4 sm:grid-cols-3">
                {landingStats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-[1.5rem] border border-border/75 bg-background/70 p-5"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      {stat.label}
                    </p>
                    <p className="mt-3 text-lg font-semibold text-foreground">
                      {stat.value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="rounded-[1.75rem] border border-border/75 bg-background/75 p-6">
                <p className="text-sm font-semibold text-foreground">
                  What this console should feel like
                </p>
                <div className="mt-4 space-y-4 text-sm leading-6 text-muted-foreground">
                  {promises.map((item) => (
                    <div key={item} className="flex gap-3">
                      <CheckCircle2 className="mt-1 h-4 w-4 flex-none text-primary" />
                      <p>{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/75 bg-card/[0.92]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <LockKeyhole className="h-5 w-5 text-primary" />
              Platform access
            </CardTitle>
            <CardDescription className="text-base leading-7">
              Sign in with a verified account that already has a BookShare platform role.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-[1.5rem] border border-border/75 bg-background/75 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Current gates
              </p>
              <div className="mt-4 space-y-4">
                <div className="flex gap-3">
                  <ShieldCheck className="mt-1 h-4 w-4 flex-none text-primary" />
                  <p className="text-sm leading-6 text-muted-foreground">
                    Verified identity through the shared authentication stack.
                  </p>
                </div>
                <div className="flex gap-3">
                  <ShieldCheck className="mt-1 h-4 w-4 flex-none text-primary" />
                  <p className="text-sm leading-6 text-muted-foreground">
                    Assigned platform role before any protected route opens.
                  </p>
                </div>
              </div>
            </div>

            <Button asChild size="lg" className="w-full justify-between rounded-[1.15rem] px-5">
              <Link href="/api/auth/login?returnTo=/catalog">
                Sign In To Admin
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>

            {params.error === "forbidden" ? (
              <p className="rounded-[1.25rem] border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                This account is signed in, but it does not currently have admin-console access.
              </p>
            ) : (
              <p className="text-sm leading-6 text-muted-foreground">
                First release scope: catalog, imports, members, and team management.
                Broader organization tooling stays out of this console for now.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-3">
        {adminNavItems.map((item) => (
          <Card key={item.href} className="border-border/75 bg-card/[0.88]">
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="rounded-[1.1rem] border border-border/75 bg-background/80 p-3 text-primary">
                  <item.icon className="h-5 w-5" />
                </div>
                <Badge
                  variant="secondary"
                  className="border border-border/75 bg-background/75 text-muted-foreground"
                >
                  Included
                </Badge>
              </div>
              <h2 className="mt-5 text-xl font-semibold tracking-tight text-foreground">
                {item.label}
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {item.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  );
}
