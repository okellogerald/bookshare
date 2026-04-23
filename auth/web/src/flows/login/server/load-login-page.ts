import { redirect } from "next/navigation";
import { createBrowserFlowUrl, getBrowserFlow } from "@/shared/lib/kratos";
import { getAuthPortalPublicUrl } from "@/shared/lib/config";
import { type AuthSearchParams, getSingleParam } from "@/shared/lib/search-params";
import {
  buildLoginModel,
  type LoginErrorPageModel,
  type LoginPageModel,
} from "./build-login-model";

function isLikelyEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// The page loader owns flow bootstrap and fallback behavior so the login form
// receives a ready-to-render model instead of raw Kratos flow data.
export async function loadLoginPageData(
  searchParams: AuthSearchParams
): Promise<LoginPageModel> {
  const flowId = getSingleParam(searchParams, "flow");
  const refreshParam = getSingleParam(searchParams, "refresh");
  const forceRefresh = refreshParam === "1" || refreshParam === "true";
  const defaultReturnTo = new URL("/oauth/resume", getAuthPortalPublicUrl()).toString();

  if (!flowId) {
    redirect(createBrowserFlowUrl("login", defaultReturnTo, { refresh: forceRefresh }));
  }

  const flow = await getBrowserFlow("login", flowId);
  if (!flow) {
    redirect(createBrowserFlowUrl("login", defaultReturnTo, { refresh: forceRefresh }));
  }
  const isRefreshFlow = Boolean(flow.refresh || forceRefresh);

  // Optional login-hint prefill. Accepted only when it looks like an email so
  // we never leak a raw query value into the identifier field.
  const rawEmailHint = getSingleParam(searchParams, "email")?.trim() ?? "";
  const emailHint = isLikelyEmail(rawEmailHint) ? rawEmailHint : "";

  const links = {
    registerHref: "/register",
    recoveryHref: "/recovery",
    retryHref: isRefreshFlow ? "/login?refresh=1" : "/login",
  };

  try {
    const model = buildLoginModel(flow, links);
    if (emailHint && !model.identifierField.value) {
      // Only apply the hint when the flow has no stronger signal of its own —
      // e.g. Kratos did not already bind an identifier through CSRF refresh.
      return {
        ...model,
        identifierField: { ...model.identifierField, value: emailHint },
      };
    }
    return model;
  } catch (error) {
    const fallback: LoginErrorPageModel = {
      variant: "error",
      title: "Login unavailable",
      description: "This login flow cannot continue. Start over to request a fresh flow.",
      detail: error instanceof Error ? error.message : "Unknown login flow error.",
      ...links,
    };

    return fallback;
  }
}
