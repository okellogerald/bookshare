import { redirect } from "next/navigation";
import { getSession } from "@/domain/auth/lib/session";
import { AdminShellClient } from "@/shared/components/admin-shell-client";
import { isAdminConsoleRole } from "@bookshare/shared";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const roles = session?.user.roles ?? [];

  if (!session || !roles.some(isAdminConsoleRole)) {
    redirect("/");
  }

  return (
    <AdminShellClient user={session.user}>
      {children}
    </AdminShellClient>
  );
}
