import { redirect } from "next/navigation";
import { KratosFlowForm } from "@/components/kratos-flow-form";
import {
  createBrowserFlowUrl,
  getBrowserFlow,
} from "@/lib/kratos";
import { type AuthSearchParams, getSingleParam } from "@/lib/search-params";

export const dynamic = "force-dynamic";

export default async function RecoveryPage({
  searchParams,
}: {
  searchParams: Promise<AuthSearchParams>;
}) {
  const params = await searchParams;
  const flowId = getSingleParam(params, "flow");

  if (!flowId) {
    redirect(createBrowserFlowUrl("recovery"));
  }

  const flow = await getBrowserFlow("recovery", flowId);
  if (!flow) {
    redirect(createBrowserFlowUrl("recovery"));
  }

  return (
    <KratosFlowForm
      flow={flow}
      title="Recover account"
      description="Reset your password via email code."
      links={[{ href: "/login", label: "Back to sign in" }]}
    />
  );
}
