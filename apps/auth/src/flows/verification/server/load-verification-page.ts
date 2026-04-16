import { redirect } from "next/navigation";
import { createBrowserFlowUrl, getBrowserFlow } from "@/shared/lib/kratos";
import { type AuthSearchParams, getSingleParam } from "@/shared/lib/search-params";
import {
  buildVerificationModel,
  type VerificationErrorPageModel,
  type VerificationPageModel,
} from "./build-verification-model";

// The verification loader owns flow bootstrap and success transitions so the
// form only needs to render a ready-to-use verification model.
export async function loadVerificationPageData(
  searchParams: AuthSearchParams
): Promise<VerificationPageModel> {
  const flowId = getSingleParam(searchParams, "flow");

  if (!flowId) {
    redirect(createBrowserFlowUrl("verification"));
  }

  const flow = await getBrowserFlow("verification", flowId);
  if (!flow) {
    redirect(createBrowserFlowUrl("verification"));
  }

  const verificationSucceeded =
    flow.state === "passed_challenge" ||
    (flow.ui.messages || []).some((message) => message.type === "success");

  if (verificationSucceeded) {
    redirect("/login");
  }

  const links = {
    loginHref: "/login",
    retryHref: "/verification",
  };

  try {
    return buildVerificationModel(flow, links);
  } catch (error) {
    const fallback: VerificationErrorPageModel = {
      variant: "error",
      title: "Verification unavailable",
      description: "This verification flow cannot continue. Start over to request a fresh flow.",
      detail: error instanceof Error ? error.message : "Unknown verification flow error.",
      ...links,
    };

    return fallback;
  }
}
