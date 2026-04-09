import { VerificationForm } from "@/features/auth-flows/verification/components/verification-form";
import { loadVerificationPageData } from "@/features/auth-flows/verification/server/load-verification-page";
import { type AuthSearchParams } from "@/lib/search-params";

export const dynamic = "force-dynamic";

export default async function VerificationPage({
  searchParams,
}: {
  searchParams: Promise<AuthSearchParams>;
}) {
  const model = await loadVerificationPageData(await searchParams);

  return <VerificationForm model={model} />;
}
