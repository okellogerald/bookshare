import { redirect } from "next/navigation";
import { sanitizeReturnTo } from "@/domains/auth/lib/auth-portal";

type AuthSearchParams = Record<string, string | string[] | undefined>;

function getParam(params: AuthSearchParams, key: string): string | undefined {
  const value = params[key];
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<AuthSearchParams>;
}) {
  const params = await searchParams;
  const returnTo = sanitizeReturnTo(
    getParam(params, "returnTo") ?? getParam(params, "return_to")
  );

  redirect(`/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
}
