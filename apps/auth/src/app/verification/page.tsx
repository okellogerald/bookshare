import { redirect } from "next/navigation";
import { KratosFlowForm } from "@/components/kratos-flow-form";
import {
  createBrowserFlowUrl,
  getBrowserFlow,
} from "@/lib/kratos";
import { type AuthSearchParams, getSingleParam } from "@/lib/search-params";

export const dynamic = "force-dynamic";

export default async function VerificationPage({
  searchParams,
}: {
  searchParams: Promise<AuthSearchParams>;
}) {
  const params = await searchParams;
  const flowId = getSingleParam(params, "flow");
  const returnTo = getSingleParam(params, "return_to");

  if (!flowId) {
    redirect(createBrowserFlowUrl("verification", returnTo));
  }

  const flow = await getBrowserFlow("verification", flowId);
  if (!flow) {
    redirect(createBrowserFlowUrl("verification", returnTo));
  }

  return (
    <KratosFlowForm
      flow={flow}
      title="Verify email"
      description="Enter the code sent to your email."
      links={[{ href: "/login", label: "Sign in" }]}
    />
  );
}
