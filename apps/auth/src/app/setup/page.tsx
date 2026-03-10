import { redirect } from "next/navigation";
import { KratosFlowForm } from "@/components/kratos-flow-form";
import {
  createBrowserFlowUrl,
  getBrowserFlow,
  initBrowserFlow,
} from "@/lib/kratos";
import { type AuthSearchParams, getSingleParam } from "@/lib/search-params";

export const dynamic = "force-dynamic";

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<AuthSearchParams>;
}) {
  const params = await searchParams;
  const flowId = getSingleParam(params, "flow");
  const returnTo = getSingleParam(params, "return_to");

  if (!flowId) {
    const newFlowId = await initBrowserFlow("settings", returnTo);
    if (newFlowId) {
      const query = new URLSearchParams({ flow: newFlowId });
      if (returnTo) query.set("return_to", returnTo);
      redirect(`/setup?${query.toString()}`);
    }

    redirect(createBrowserFlowUrl("settings", returnTo));
  }

  const flow = await getBrowserFlow("settings", flowId);
  if (!flow) {
    const newFlowId = await initBrowserFlow("settings", returnTo);
    if (newFlowId) {
      const query = new URLSearchParams({ flow: newFlowId });
      if (returnTo) query.set("return_to", returnTo);
      redirect(`/setup?${query.toString()}`);
    }

    redirect(createBrowserFlowUrl("settings", returnTo));
  }

  return (
    <KratosFlowForm
      flow={flow}
      title="Finish account setup"
      description="Save your profile details and set your password to complete the account."
      sectionGroups={["profile", "password"]}
      fieldAllowlist={["traits.name.first", "traits.name.last", "traits.gender", "password"]}
      hideBackOnlySections
      links={[{ href: "/login", label: "Back to sign in" }]}
    />
  );
}
