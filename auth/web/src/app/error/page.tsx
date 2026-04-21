import NextLink from "next/link";
import { AuthShell } from "@/shared/components/auth-shell";
import { getFlowErrorById } from "@/shared/lib/kratos";
import { type AuthSearchParams, getSingleParam } from "@/shared/lib/search-params";

export const dynamic = "force-dynamic";

export default async function ErrorPage({
  searchParams,
}: {
  searchParams: Promise<AuthSearchParams>;
}) {
  const params = await searchParams;
  const errorId = getSingleParam(params, "id");
  const hydraError = getSingleParam(params, "error");
  const hydraDescription = getSingleParam(params, "error_description");

  const flowError = errorId ? await getFlowErrorById(errorId) : null;
  const errorMessage =
    hydraDescription ||
    hydraError ||
    flowError?.error?.reason ||
    flowError?.error?.message ||
    "Authentication flow failed. Please retry.";

  return (
    <AuthShell title="Authentication error" description={errorMessage}>
      {flowError?.error ? (
        <pre className="flow-error-block flow-error-code">
          {JSON.stringify(flowError.error, null, 2)}
        </pre>
      ) : null}
      <div className="flow-footer-links">
        <NextLink href="/login" className="auth-home-link">
          Back to sign in
        </NextLink>
      </div>
    </AuthShell>
  );
}
