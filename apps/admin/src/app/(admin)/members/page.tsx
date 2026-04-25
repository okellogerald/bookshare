import { getSession } from "@/domain/auth/lib/session";
import { MembersWorkspace } from "@/app/(admin)/members/_components/members-workspace";

export default async function MembersPage() {
  const session = await getSession();

  return (
    <MembersWorkspace
      actorRoles={session?.user.roles ?? []}
      actorUserId={session?.user.id ?? null}
    />
  );
}
