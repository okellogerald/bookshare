import { redirect } from "next/navigation";
import { createBrowserFlowUrl, getBrowserFlow } from "@/shared/lib/kratos";
import { type AuthSearchParams, getSingleParam } from "@/shared/lib/search-params";
import {
  buildLoginModel,
  type LoginErrorPageModel,
  type LoginPageModel,
} from "./build-login-model";

// The page loader owns flow bootstrap and fallback behavior so the login form
// receives a ready-to-render model instead of raw Kratos flow data.
export async function loadLoginPageData(
  searchParams: AuthSearchParams
): Promise<LoginPageModel> {
  const flowId = getSingleParam(searchParams, "flow");

  if (!flowId) {
    redirect(createBrowserFlowUrl("login"));
  }

  const flow = await getBrowserFlow("login", flowId);
  if (!flow) {
    redirect(createBrowserFlowUrl("login"));
  }

  const links = {
    registerHref: "/register",
    recoveryHref: "/recovery",
    retryHref: "/login",
  };

  try {
    return buildLoginModel(flow, links);
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
