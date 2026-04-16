import { TeamWorkspace } from "@/app/(admin)/team/_components/team-workspace";
import { getSession } from "@/domain/auth/lib/session";

export default async function TeamPage() {
  const session = await getSession();
  const actorRoles = session?.user.roles ?? [];

  return <TeamWorkspace actorRoles={actorRoles} />;
}
