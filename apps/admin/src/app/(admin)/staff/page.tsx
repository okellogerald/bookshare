import { getSession } from "@/features/auth/lib/session";
import { StaffWorkspace } from "@/features/staff/components/staff-workspace";

export default async function StaffPage() {
  const session = await getSession();
  const actorRoles = session?.user.roles ?? [];

  return <StaffWorkspace actorRoles={actorRoles} />;
}
