import { LoginForm } from "@/features/auth-flows/login/components/login-form";
import { loadLoginPageData } from "@/features/auth-flows/login/server/load-login-page";
import { type AuthSearchParams } from "@/lib/search-params";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<AuthSearchParams>;
}) {
  const model = await loadLoginPageData(await searchParams);

  return <LoginForm model={model} />;
}
