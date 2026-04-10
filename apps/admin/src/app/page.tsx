import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BookCopy, FolderKanban, ShieldCheck } from "lucide-react";
import { getSession } from "@/features/auth/lib/session";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";

const cards = [
  {
    title: "Catalog Workbench",
    description:
      "Search, create, and clean up books, editions, covers, and member-linked listings.",
    icon: BookCopy,
  },
  {
    title: "Batch Ingestion",
    description:
      "Replace CSV-only flows with browser-based validation, preview, and commit batches.",
    icon: FolderKanban,
  },
  {
    title: "Staff Management",
    description:
      "Control who can operate the platform before broader member management arrives.",
    icon: ShieldCheck,
  },
];

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();
  const params = await searchParams;

  if (session?.user.emailVerified && (session.user.roles?.length ?? 0) > 0) {
    redirect("/catalog");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-10 sm:px-10">
      <Card className="rounded-[2rem] border-border/80 bg-card/90 shadow-[0_30px_80px_rgba(48,70,94,0.10)] backdrop-blur">
        <CardHeader className="max-w-3xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.22em] text-primary">
            BookShare Admin
          </p>
          <CardTitle className="text-4xl tracking-tight text-foreground sm:text-5xl">
            Internal control room for catalog quality and staff operations.
          </CardTitle>
          <CardDescription className="mt-3 max-w-2xl text-lg leading-8 text-slate-700">
            This app is the dedicated staff console. It starts with catalog work,
            batch ingestion, and staff administration, while organizations remain
            reserved for the future bookstore app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Button asChild size="lg">
              <Link href="/api/auth/login?returnTo=/catalog">
                Sign In To Admin
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <p className="text-sm text-slate-600">
              First milestone: scaffold, auth wiring, and protected admin routes.
            </p>
          </div>
          {params.error === "forbidden" ? (
            <p className="mt-5 text-sm font-medium text-red-700">
              This account is signed in, but it does not currently have staff access.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <section className="mt-10 grid gap-5 md:grid-cols-3">
        {cards.map((card) => (
          <Card
            key={card.title}
            className="border-border/70 bg-card/85 shadow-[0_16px_44px_rgba(69,75,87,0.08)]"
          >
            <CardContent className="p-6">
              <div className="mb-4 inline-flex rounded-2xl bg-muted p-3 text-primary">
                <card.icon className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-semibold">{card.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {card.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  );
}
