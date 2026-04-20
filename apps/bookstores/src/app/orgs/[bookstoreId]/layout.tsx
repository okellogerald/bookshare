import { redirect } from "next/navigation";
import { getSession } from "@/domain/auth/lib/session";
import { buildAuthPortalVerificationUrl } from "@/domain/auth/lib/auth-portal";
import { BookstoresShellClient } from "@/shared/components/bookstores-shell-client";

export default async function BookstoreOrgLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/");
  }

  if (session.user.emailVerified !== true) {
    redirect(buildAuthPortalVerificationUrl());
  }

  return <BookstoresShellClient user={session.user}>{children}</BookstoresShellClient>;
}
