import Link from "next/link";
import { redirect } from "next/navigation";
import { BookCopy, FolderKanban, ShieldCheck } from "lucide-react";
import { getSession } from "@/features/auth/lib/session";

const navItems = [
  {
    href: "/catalog",
    label: "Catalog",
    description: "Workbench for books, editions, and listings",
    icon: BookCopy,
  },
  {
    href: "/batches",
    label: "Batches",
    description: "Batch validation and import replacement",
    icon: FolderKanban,
  },
  {
    href: "/staff",
    label: "Staff",
    description: "Platform staff access and role management",
    icon: ShieldCheck,
  },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/");
  }

  return (
    <div className="min-h-screen px-4 py-4 sm:px-6">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-7xl gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="rounded-[1.75rem] border border-border/80 bg-card/90 p-6 shadow-[0_20px_55px_rgba(52,63,79,0.10)]">
          <div className="border-b border-border/80 pb-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
              BookShare
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">
              Admin Console
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Signed in as {session.user.email || session.user.name || session.user.id}
            </p>
          </div>

          <nav className="mt-5 space-y-3">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-[1.25rem] border border-border/70 bg-background/70 p-4 transition hover:border-primary/40 hover:bg-white"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-muted p-2 text-primary">
                    <item.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-semibold">{item.label}</p>
                    <p className="text-xs leading-5 text-slate-600">
                      {item.description}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </nav>

          <div className="mt-6 rounded-[1.25rem] border border-dashed border-border/90 bg-muted/55 p-4">
            <p className="text-sm font-semibold">Implementation tracker</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Progress is tracked in
              {" "}
              <code>docs/admin-dashboard-implementation.md</code>.
            </p>
          </div>

          <div className="mt-6">
            <a
              href="/api/auth/logout"
              className="inline-flex rounded-full border border-border px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-muted"
            >
              Sign Out
            </a>
          </div>
        </aside>

        <main className="rounded-[1.75rem] border border-border/80 bg-card/90 p-6 shadow-[0_20px_55px_rgba(52,63,79,0.10)] sm:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
