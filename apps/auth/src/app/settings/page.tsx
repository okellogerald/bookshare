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

  const accountEmail = (() => {
    const identityEmail = flow.identity?.traits;
    if (
      identityEmail &&
      typeof identityEmail === "object" &&
      typeof (identityEmail as { email?: unknown }).email === "string"
    ) {
      const value = (identityEmail as { email?: string }).email?.trim();
      if (value) return value;
    }

    const emailNode = flow.ui.nodes.find(
      (node) => node.type === "input" && node.attributes.name === "traits.email"
    );
    return typeof emailNode?.attributes.value === "string"
      ? emailNode.attributes.value.trim()
      : "";
  })();

  const description = accountEmail
    ? `Manage profile details for ${accountEmail}.`
    : "Manage your profile details.";

  return (
    <KratosFlowForm
      flow={flow}
      title="Account settings"
      description={description}
      sectionGroups={["profile"]}
      fieldAllowlist={[
        "traits.email",
        "traits.name.first",
        "traits.name.last",
        "traits.gender",
      ]}
      readonlyFieldNames={["traits.email"]}
      submitAllowlist={["method"]}
      hideBackOnlySections
      links={[{ href: "/login", label: "Back to sign in" }]}
    />
  );
}
