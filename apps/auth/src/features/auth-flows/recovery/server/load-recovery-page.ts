import { redirect } from "next/navigation";
import { createBrowserFlowUrl, getBrowserFlow } from "@/lib/kratos";
import { type AuthSearchParams, getSingleParam } from "@/lib/search-params";
import {
  buildRecoveryModel,
  type RecoveryErrorPageModel,
  type RecoveryPageModel,
} from "./build-recovery-model";

// The recovery loader owns flow bootstrap and fallback behavior so the
// recovery forms only receive a ready-to-render model.
export async function loadRecoveryPageData(
  searchParams: AuthSearchParams
): Promise<RecoveryPageModel> {
  const flowId = getSingleParam(searchParams, "flow");

  if (!flowId) {
    redirect(createBrowserFlowUrl("recovery"));
  }

  const flow = await getBrowserFlow("recovery", flowId);
  if (!flow) {
    redirect(createBrowserFlowUrl("recovery"));
  }

  const links = {
    loginHref: "/login",
    retryHref: "/recovery",
  };

  try {
    return buildRecoveryModel(flow, links);
  } catch (error) {
    const fallback: RecoveryErrorPageModel = {
      variant: "error",
      title: "Recovery unavailable",
      description: "This recovery flow cannot continue. Start over to request a fresh flow.",
      detail: error instanceof Error ? error.message : "Unknown recovery flow error.",
      ...links,
    };

    return fallback;
  }
}
