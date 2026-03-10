import { redirect } from "next/navigation";
import { KratosFlowForm } from "@/components/kratos-flow-form";
import {
  createBrowserFlowUrl,
  getBrowserFlow,
} from "@/lib/kratos";
import { type AuthSearchParams, getSingleParam } from "@/lib/search-params";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<AuthSearchParams>;
}) {
  const params = await searchParams;
  const flowId = getSingleParam(params, "flow");
  const returnTo = getSingleParam(params, "return_to");

  if (!flowId) {
    redirect(createBrowserFlowUrl("settings", returnTo));
  }

  const flow = await getBrowserFlow("settings", flowId);
  if (!flow) {
    redirect(createBrowserFlowUrl("settings", returnTo));
  }

  return (
    <KratosFlowForm
      flow={flow}
      title="Account settings"
      description="Manage profile, password, recovery email and two-factor auth."
      links={[{ href: "/login", label: "Back to sign in" }]}
    />
  );
}
