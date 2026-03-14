import { redirect } from "next/navigation";
import { KratosFlowForm } from "@/components/kratos-flow-form";
import {
  createBrowserFlowUrl,
  getBrowserFlow,
} from "@/lib/kratos";
import { type AuthSearchParams, getSingleParam } from "@/lib/search-params";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<AuthSearchParams>;
}) {
  const params = await searchParams;
  const flowId = getSingleParam(params, "flow");
  const returnTo = getSingleParam(params, "return_to");

  if (!flowId) {
    redirect(createBrowserFlowUrl("login", returnTo));
  }

  const flow = await getBrowserFlow("login", flowId);
  if (!flow) {
    redirect(createBrowserFlowUrl("login", returnTo));
  }

  return (
    <KratosFlowForm
      flow={flow}
      title="Sign in"
      description="Use your account to continue."
      sectionGroups={["password"]}
      links={[{ href: "/recovery", label: "Forgot password?" }]}
    />
  );
}
