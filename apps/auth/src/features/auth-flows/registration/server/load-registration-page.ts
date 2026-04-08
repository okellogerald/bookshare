import { redirect } from "next/navigation";
import {
  createBrowserFlowUrl,
  getBrowserFlow,
} from "@/lib/kratos";
import { type AuthSearchParams, getSingleParam } from "@/lib/search-params";
import {
  buildRegistrationModel,
  type RegistrationPageModel,
  type RegistrationErrorPageModel,
} from "./build-registration-model";

// The page loader owns redirect/bootstrap concerns so the form only receives a
// ready-to-render registration model.
export async function loadRegistrationPageData(
  searchParams: AuthSearchParams
): Promise<RegistrationPageModel> {
  const flowId = getSingleParam(searchParams, "flow");
  const returnTo = getSingleParam(searchParams, "return_to");

  if (!flowId) {
    redirect(createBrowserFlowUrl("registration", returnTo));
  }

  const flow = await getBrowserFlow("registration", flowId);
  if (!flow) {
    redirect(createBrowserFlowUrl("registration", returnTo));
  }

  const loginHref = flow.return_to
    ? `/login?return_to=${encodeURIComponent(flow.return_to)}`
    : "/login";
  const resetHref = flow.return_to
    ? `/register/reset?return_to=${encodeURIComponent(flow.return_to)}`
    : "/register/reset";

  try {
    return buildRegistrationModel(flow, loginHref, resetHref);
  } catch (error) {
    // Registration mapping failures should degrade into a recoverable screen
    // instead of crashing the whole route, so the user can always request a
    // fresh flow.
    const fallback: RegistrationErrorPageModel = {
      variant: "error",
      title: "Registration unavailable",
      description: "This registration flow cannot continue. Start over to request a fresh flow.",
      detail: error instanceof Error ? error.message : "Unknown registration flow error.",
      loginHref,
      resetHref,
    };

    return fallback;
  }
}
