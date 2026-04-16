import { SettingsForm } from "@/flows/settings/components/settings-form";
import { loadSettingsPageData } from "@/flows/settings/server/load-settings-page";
import { type AuthSearchParams } from "@/shared/lib/search-params";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<AuthSearchParams>;
}) {
  const model = await loadSettingsPageData(await searchParams);

  return <SettingsForm model={model} />;
}
