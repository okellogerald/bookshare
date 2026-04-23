import { redirect } from "next/navigation";
import { createBrowserFlowUrl, getBrowserFlow } from "@/shared/lib/kratos";
import { type AuthSearchParams, getSingleParam } from "@/shared/lib/search-params";
import {
  getAdminAppPublicUrl,
  getAuthPortalPublicUrl,
  getBookshareAppPublicUrl,
  getBookstoresAppPublicUrl,
} from "@/shared/lib/config";
import {
  buildVerificationModel,
  type VerificationErrorPageModel,
  type VerificationPageModel,
} from "./build-verification-model";

function sanitizeReturnTo(value: string | null | undefined): string | undefined {
  if (!value) return undefined;

  try {
    const parsed = new URL(value, getAuthPortalPublicUrl());
    const allowedOrigins = new Set([
      new URL(getAuthPortalPublicUrl()).origin,
      new URL(getBookshareAppPublicUrl()).origin,
      new URL(getAdminAppPublicUrl()).origin,
      new URL(getBookstoresAppPublicUrl()).origin,
    ]);

    return allowedOrigins.has(parsed.origin) ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

// The verification loader owns flow bootstrap and success transitions so the
// form only needs to render a ready-to-use verification model.
export async function loadVerificationPageData(
  searchParams: AuthSearchParams
): Promise<VerificationPageModel> {
  const flowId = getSingleParam(searchParams, "flow");
  const requestedReturnTo = sanitizeReturnTo(
    getSingleParam(searchParams, "return_to")
  );

  if (!flowId) {
    redirect(createBrowserFlowUrl("verification", requestedReturnTo));
  }

  const flow = await getBrowserFlow("verification", flowId);
  if (!flow) {
    redirect(createBrowserFlowUrl("verification", requestedReturnTo));
  }

  const verificationSucceeded =
    flow.state === "passed_challenge" ||
    (flow.ui.messages || []).some((message) => message.type === "success");

  if (verificationSucceeded) {
    redirect(sanitizeReturnTo(flow.return_to) || "/login");
  }

  const links = {
    loginHref: "/login",
    retryHref: requestedReturnTo
      ? `/verification?return_to=${encodeURIComponent(requestedReturnTo)}`
      : "/verification",
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
