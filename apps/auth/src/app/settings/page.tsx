import { redirect } from "next/navigation";
import { KratosFlowForm } from "@/components/kratos-flow-form";
import {
  createBrowserFlowUrl,
  getBrowserFlow,
  getKratosSession,
  hasKratosAuthenticationMethod,
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

  const session = await getKratosSession();
  const flowMessages = [
    ...(flow.ui.messages || []),
    ...flow.ui.nodes.flatMap((node) => node.messages || []),
  ];
  const hasSuccessMessage = flowMessages.some((message) => message.type === "success");
  const isRecoveryReset =
    hasKratosAuthenticationMethod(session, "code_recovery") ||
    flowMessages.some((message) => message.id === 1060001);

  if (isRecoveryReset && hasSuccessMessage) {
    redirect("/login");
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

  const title = isRecoveryReset ? "Reset password" : "Account settings";
  const description = isRecoveryReset
    ? accountEmail
      ? `Set a new password for ${accountEmail}.`
      : "Set a new password for your account."
    : accountEmail
      ? `Manage profile details for ${accountEmail}.`
      : "Manage your profile details.";
  const sectionGroups = isRecoveryReset ? ["password"] : ["profile"];
  const fieldAllowlist = isRecoveryReset
    ? ["password"]
    : [
      "traits.email",
      "traits.name.first",
      "traits.name.last",
      "traits.gender",
    ];

  return (
    <KratosFlowForm
      flow={flow}
      title={title}
      description={description}
      sectionGroups={sectionGroups}
      fieldAllowlist={fieldAllowlist}
      submitAllowlist={["method"]}
      hideBackOnlySections
      links={[{ href: "/login", label: "Back to sign in" }]}
      enablePasswordConfirmation={isRecoveryReset}
    />
  );
}
