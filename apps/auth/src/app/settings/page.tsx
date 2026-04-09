import { redirect } from "next/navigation";
import { KratosFlowForm } from "@/components/kratos-flow-form";
import { getBookshareAppPublicUrl } from "@/lib/config";
import { getHydraLoginChallenge } from "@/lib/hydra-login-context";
import {
  createBrowserFlowUrl,
  getBrowserFlow,
  getKratosSession,
  hasKratosAuthenticationMethod,
  initBrowserFlow,
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
  const sectionParam = getSingleParam(params, "section");
  const requestedSection = sectionParam === "password" ? "password" : "profile";
  const hasPendingHydraLogin = Boolean(await getHydraLoginChallenge());
  const profileHref = new URL("/profile", getBookshareAppPublicUrl()).toString();

  if (!flowId) {
    const newFlowId = await initBrowserFlow("settings");
    if (newFlowId) {
      const query = new URLSearchParams({
        flow: newFlowId,
        section: requestedSection,
      });
      redirect(`/settings?${query.toString()}`);
    }

    redirect(createBrowserFlowUrl("settings"));
  }

  const flow = await getBrowserFlow("settings", flowId);
  if (!flow) {
    const newFlowId = await initBrowserFlow("settings");
    if (newFlowId) {
      const query = new URLSearchParams({
        flow: newFlowId,
        section: requestedSection,
      });
      redirect(`/settings?${query.toString()}`);
    }

    redirect(createBrowserFlowUrl("settings"));
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

  if (!isRecoveryReset && hasSuccessMessage) {
    redirect(hasPendingHydraLogin ? "/oauth/login" : profileHref);
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

  const activeSection = isRecoveryReset ? "password" : requestedSection;
  const title = isRecoveryReset
    ? "Reset password"
    : activeSection === "password"
      ? "Password changes"
      : "Profile settings";
  const description = isRecoveryReset
    ? accountEmail
      ? `Set a new password for ${accountEmail}.`
      : "Set a new password for your account."
    : activeSection === "password"
      ? accountEmail
        ? `Choose a new password for ${accountEmail}.`
        : "Choose a new password for your account."
      : accountEmail
        ? `Manage profile details for ${accountEmail}.`
        : "Manage your profile details.";
  const sectionGroups = [activeSection];
  const fieldAllowlist =
    activeSection === "password"
      ? ["password"]
      : [
        "traits.email",
        "traits.name.first",
        "traits.name.last",
        "traits.gender",
      ];
  const switchSection = activeSection === "password" ? "profile" : "password";
  const switchLabel =
    activeSection === "password" ? "Profile settings" : "Password changes";
  const switchParams = new URLSearchParams({
    flow: flow.id,
    section: switchSection,
  });
  const backHref = hasPendingHydraLogin ? "/login" : profileHref;
  const backLabel = hasPendingHydraLogin ? "Back to sign in" : "Back to profile";

  return (
    <KratosFlowForm
      flow={flow}
      title={title}
      description={description}
      sectionGroups={sectionGroups}
      fieldAllowlist={fieldAllowlist}
      submitAllowlist={["method"]}
      hideBackOnlySections
      links={
        isRecoveryReset
          ? [{ href: "/login", label: "Back to sign in" }]
          : [
            { href: `/settings?${switchParams.toString()}`, label: switchLabel },
            { href: backHref, label: backLabel },
          ]
      }
      enablePasswordConfirmation={activeSection === "password"}
    />
  );
}
