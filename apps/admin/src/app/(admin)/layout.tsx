import { redirect } from "next/navigation";
import { getSession } from "@/domain/auth/lib/session";
import { AdminShellClient } from "@/shared/components/admin-shell-client";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const roles = session?.user.roles ?? [];

  if (!session || roles.length === 0) {
    redirect("/");
  }

  return (
    <AdminShellClient user={session.user}>
      {children}
    </AdminShellClient>
  );
}
