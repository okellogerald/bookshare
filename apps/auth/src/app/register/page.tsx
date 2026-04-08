import { RegistrationForm } from "@/features/auth-flows/registration/components/registration-form";
import { loadRegistrationPageData } from "@/features/auth-flows/registration/server/load-registration-page";
import { type AuthSearchParams } from "@/lib/search-params";

export const dynamic = "force-dynamic";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<AuthSearchParams>;
}) {
  const model = await loadRegistrationPageData(await searchParams);

  return <RegistrationForm model={model} />;
}
