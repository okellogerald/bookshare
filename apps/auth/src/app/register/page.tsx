import { redirect } from "next/navigation";
import { KratosFlowForm } from "@/components/kratos-flow-form";
import {
  createBrowserFlowUrl,
  getBrowserFlow,
} from "@/lib/kratos";
import { type AuthSearchParams, getSingleParam } from "@/lib/search-params";

export const dynamic = "force-dynamic";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<AuthSearchParams>;
}) {
  const params = await searchParams;
  const flowId = getSingleParam(params, "flow");
  const returnTo = getSingleParam(params, "return_to");

  if (!flowId) {
    redirect(createBrowserFlowUrl("registration", returnTo));
  }

  const flow = await getBrowserFlow("registration", flowId);
  if (!flow) {
    redirect(createBrowserFlowUrl("registration", returnTo));
  }

  const loginHref = flow.return_to
    ? `/login?return_to=${encodeURIComponent(flow.return_to)}`
    : "/login";

  return (
    <KratosFlowForm
      flow={flow}
      title="Create your account"
      description="Enter your details, choose a password, then verify your email."
      sectionGroups={["password"]}
      fieldAllowlist={[
        "traits.name.first",
        "traits.name.last",
        "traits.gender",
        "traits.email",
        "password",
      ]}
      submitAllowlist={["method"]}
      hideBackOnlySections
      links={[{ href: loginHref, label: "Back to sign in" }]}
      enablePasswordConfirmation
    />
  );
}
