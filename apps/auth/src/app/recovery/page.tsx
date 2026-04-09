import { RecoveryForm } from "@/features/auth-flows/recovery/components/recovery-form";
import { loadRecoveryPageData } from "@/features/auth-flows/recovery/server/load-recovery-page";
import { type AuthSearchParams } from "@/lib/search-params";

export const dynamic = "force-dynamic";

export default async function RecoveryPage({
  searchParams,
}: {
  searchParams: Promise<AuthSearchParams>;
}) {
  const model = await loadRecoveryPageData(await searchParams);

  return <RecoveryForm model={model} />;
}
