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

  if (!flowId) {
    redirect(createBrowserFlowUrl("registration"));
  }

  const flow = await getBrowserFlow("registration", flowId);
  if (!flow) {
    redirect(createBrowserFlowUrl("registration"));
  }

  const loginHref = "/login";
  const resetHref = "/register/reset";

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
