import { getSession } from "@/features/auth/lib/session";
import { StaffManagement } from "@/features/staff/components/staff-management";
import { PageIntro } from "@/shared/components/page-intro";

export default async function StaffPage() {
  const session = await getSession();
  const actorRoles = session?.user.roles ?? [];

  return (
    <section className="space-y-6">
      <PageIntro
        eyebrow="Staff"
        title="Staff management"
        description="Keep access narrow and explicit. Search existing staff assignments, then grant the smallest useful role to the right identity."
      />

      <StaffManagement actorRoles={actorRoles} />
    </section>
  );
}
