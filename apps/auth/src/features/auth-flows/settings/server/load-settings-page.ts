import { redirect } from "next/navigation";
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
import {
  buildSettingsModel,
  type SettingsErrorPageModel,
  type SettingsPageModel,
} from "./build-settings-model";

function buildSettingsHref(section: "profile" | "password", flowId?: string): string {
  const query = new URLSearchParams({ section });

  if (flowId) {
    query.set("flow", flowId);
  }

  return `/settings?${query.toString()}`;
}

function getFlowMessagesForRouting(flow: NonNullable<Awaited<ReturnType<typeof getBrowserFlow>>>) {
  return [
    ...(flow.ui.messages || []),
    ...flow.ui.nodes.flatMap((node) => node.messages || []),
  ];
}

// The settings loader owns flow bootstrap, recovery-reset detection, and
// success redirects so the settings UI only renders the active section model.
export async function loadSettingsPageData(
  searchParams: AuthSearchParams
): Promise<SettingsPageModel> {
  const flowId = getSingleParam(searchParams, "flow");
  const sectionParam = getSingleParam(searchParams, "section");
  const requestedSection = sectionParam === "password" ? "password" : "profile";
  const hasPendingHydraLogin = Boolean(await getHydraLoginChallenge());
  const profileHref = new URL("/profile", getBookshareAppPublicUrl()).toString();

  if (!flowId) {
    const newFlowId = await initBrowserFlow("settings");
    if (newFlowId) {
      redirect(buildSettingsHref(requestedSection, newFlowId));
    }

    redirect(createBrowserFlowUrl("settings"));
  }

  const flow = await getBrowserFlow("settings", flowId);
  if (!flow) {
    const newFlowId = await initBrowserFlow("settings");
    if (newFlowId) {
      redirect(buildSettingsHref(requestedSection, newFlowId));
    }

    redirect(createBrowserFlowUrl("settings"));
  }

  const session = await getKratosSession();
  const flowMessages = getFlowMessagesForRouting(flow);
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

  const activeSection = isRecoveryReset ? "password" : requestedSection;
  const retryHref = isRecoveryReset
    ? "/recovery"
    : buildSettingsHref(activeSection);
  const links = {
    retryHref,
    profileSectionHref: buildSettingsHref("profile", flow.id),
    passwordSectionHref: buildSettingsHref("password", flow.id),
    backHref: hasPendingHydraLogin ? "/login" : profileHref,
    backLabel: hasPendingHydraLogin ? "Back to sign in" : "Back to profile",
  };

  try {
    return buildSettingsModel(flow, {
      activeSection,
      mode: isRecoveryReset ? "recovery-reset" : "account",
      links,
    });
  } catch (error) {
    const fallback: SettingsErrorPageModel = {
      variant: "error",
      mode: isRecoveryReset ? "recovery-reset" : "account",
      title: isRecoveryReset ? "Password reset unavailable" : "Settings unavailable",
      description: isRecoveryReset
        ? "This password reset flow cannot continue. Start over to request a fresh recovery flow."
        : "This settings flow cannot continue. Start over to request a fresh settings flow.",
      detail: error instanceof Error ? error.message : "Unknown settings flow error.",
      ...links,
    };

    return fallback;
  }
}
