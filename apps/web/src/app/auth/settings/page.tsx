import { redirect } from "next/navigation";
import { buildAuthPortalSettingsUrl } from "@/domains/auth/lib/auth-portal";

type AuthSearchParams = Record<string, string | string[] | undefined>;

function getParam(params: AuthSearchParams, key: string): string | undefined {
  const value = params[key];
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export default async function SettingsRedirectPage({
  searchParams,
}: {
  searchParams: Promise<AuthSearchParams>;
}) {
  const params = await searchParams;
  const sectionParam = getParam(params, "section");
  const section =
    sectionParam === "password" || sectionParam === "profile"
      ? sectionParam
      : undefined;

  redirect(buildAuthPortalSettingsUrl(section));
}
