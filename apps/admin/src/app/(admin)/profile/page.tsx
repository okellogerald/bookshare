import { getSession } from "@/domain/auth/lib/session";
import { PageIntro } from "@/shared/components/page-intro";

export default async function ProfilePage() {
  const session = await getSession();
  const user = session?.user;

  return (
    <section className="space-y-6">
      <PageIntro
        title="Profile"
        description="Basic account details for the staff user currently signed into the admin console."
      />

      <div className="divide-y border-b">
        <div className="grid gap-2 py-4 sm:grid-cols-[180px_minmax(0,1fr)]">
          <p className="text-sm font-medium text-muted-foreground">Name</p>
          <p className="text-sm text-foreground">
            {user?.name || "Not available in the current session"}
          </p>
        </div>
        <div className="grid gap-2 py-4 sm:grid-cols-[180px_minmax(0,1fr)]">
          <p className="text-sm font-medium text-muted-foreground">Email</p>
          <p className="text-sm text-foreground">{user?.email || "No email available"}</p>
        </div>
        <div className="grid gap-2 py-4 sm:grid-cols-[180px_minmax(0,1fr)]">
          <p className="text-sm font-medium text-muted-foreground">Roles</p>
          <p className="text-sm text-foreground">
            {(user?.roles ?? []).length > 0 ? (user?.roles ?? []).join(", ") : "No roles"}
          </p>
        </div>
      </div>
    </section>
  );
}
