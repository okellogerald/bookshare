import { getSession } from "@/features/auth/lib/session";
import { AppShellClient } from "./app-shell-client";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const user = session?.user ?? null;

  return <AppShellClient user={user}>{children}</AppShellClient>;
}
