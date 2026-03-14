import Link from "next/link";
import { cookies } from "next/headers";
import { BookOpen } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { sanitizeReturnTo } from "@/features/auth/lib/auth-portal";

type LandingSearchParams = Record<string, string | string[] | undefined>;

function getParam(params: LandingSearchParams, key: string): string | undefined {
  const value = params[key];
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<LandingSearchParams>;
}) {
  const cookieStore = await cookies();
  const params = await searchParams;
  const returnTo = sanitizeReturnTo(getParam(params, "returnTo"));
  const loggedOut =
    getParam(params, "logged_out") === "1" ||
    cookieStore.get("bookshare_logged_out")?.value === "1";
  const signInHref =
    returnTo === "/browse"
      ? "/api/auth/login"
      : `/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <BookOpen className="h-12 w-12" />
        <h1 className="text-4xl font-bold tracking-tight">BookShare</h1>
        <p className="max-w-md text-lg text-muted-foreground">
          A private community book-sharing directory. Browse books available
          from fellow members, and list your own for lending, selling, or
          giving away.
        </p>
        {loggedOut ? (
          <p className="max-w-md rounded-md border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
            You have been logged out. Sign in again when you want to continue.
          </p>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        <Button size="lg" asChild>
          <Link href={signInHref}>Sign In</Link>
        </Button>
      </div>
    </div>
  );
}
