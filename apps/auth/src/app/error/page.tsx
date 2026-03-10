import Link from "next/link";
import { getFlowErrorById } from "@/lib/kratos";
import { type AuthSearchParams, getSingleParam } from "@/lib/search-params";

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
    <div className="page">
      <div className="card">
        <h1 className="title">Authentication error</h1>
        <p className="subtitle">{errorMessage}</p>
        {flowError?.error ? (
          <pre className="code-block">{JSON.stringify(flowError.error, null, 2)}</pre>
        ) : null}
        <div className="footer-links">
          <Link href="/login">Back to sign in</Link>
          <Link href="/register">Create account</Link>
        </div>
      </div>
    </div>
  );
}
