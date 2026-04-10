import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BookCopy, FolderKanban, ShieldCheck } from "lucide-react";
import { getSession } from "@/features/auth/lib/session";

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

export default async function LandingPage() {
  const session = await getSession();

  if (session?.user.emailVerified) {
    redirect("/catalog");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-10 sm:px-10">
      <div className="rounded-[2rem] border border-border/80 bg-card/90 p-8 shadow-[0_30px_80px_rgba(48,70,94,0.10)] backdrop-blur">
        <div className="max-w-3xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.22em] text-primary">
            BookShare Admin
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Internal control room for catalog quality and staff operations.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-700">
            This app is the dedicated staff console. It starts with catalog work,
            batch ingestion, and staff administration, while organizations remain
            reserved for the future bookstore app.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="/api/auth/login?returnTo=/catalog"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:brightness-110"
            >
              Sign In To Admin
              <ArrowRight className="h-4 w-4" />
            </Link>
            <p className="text-sm text-slate-600">
              First milestone: scaffold, auth wiring, and protected admin routes.
            </p>
          </div>
        </div>
      </div>

      <section className="mt-10 grid gap-5 md:grid-cols-3">
        {cards.map((card) => (
          <article
            key={card.title}
            className="rounded-[1.5rem] border border-border/70 bg-card/85 p-6 shadow-[0_16px_44px_rgba(69,75,87,0.08)]"
          >
            <div className="mb-4 inline-flex rounded-2xl bg-muted p-3 text-primary">
              <card.icon className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-semibold">{card.title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {card.description}
            </p>
          </article>
        ))}
      </section>
    </main>
  );
}
