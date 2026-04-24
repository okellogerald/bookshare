import { redirect } from "next/navigation";
import { getBookshareAppPublicUrl } from "@/shared/lib/config";
import { getHydraLoginChallenge } from "@/shared/lib/hydra-login-context";
import {
  createBrowserFlowUrl,
  getBrowserFlow,
  getKratosSession,
  hasKratosAuthenticationMethod,
  initBrowserFlow,
  type KratosBrowserFlow,
  type KratosSession,
} from "@/shared/lib/kratos";
import { type AuthSearchParams, getSingleParam } from "@/shared/lib/search-params";
import {
  buildSettingsModel,
  type SettingsErrorPageModel,
  type SettingsPageModel,
} from "./build-settings-model";

type SettingsSection = "profile" | "password";
type SettingsMode = "account" | "recovery-reset";

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

function buildSettingsHref(section: SettingsSection, flowId?: string): string {
  const params = new URLSearchParams({ section });
  if (flowId) params.set("flow", flowId);
  return `/settings?${params.toString()}`;
}

function getBookshareProfileUrl(): string {
  return new URL("/profile", getBookshareAppPublicUrl()).toString();
}

// ---------------------------------------------------------------------------
// Flow state derivation
// ---------------------------------------------------------------------------

// Kratos marks a settings flow as `state: "success"` once the user has
// submitted a change that validated. Any other state (`show_form` or
// undefined) means the form still needs input — so we must render it.
//
// IMPORTANT: do NOT treat individual `type: "success"` messages as completion.
// Kratos attaches informational success messages to the *initial* settings
// flow produced after a recovery code submission (e.g. "You successfully
// recovered your account, please change your password") — reading those as
// "flow finished" short-circuits the password form and bounces the user away
// before they can type a new password.
function isFlowComplete(flow: KratosBrowserFlow): boolean {
  return flow.state === "success";
}

// Recovery-reset mode: the user authenticated with a recovery code and is
// now required to set a new password. Kratos signals this via the session's
// `authentication_methods` — the only method present will be `code_recovery`
// until the password is reset.
function isRecoveryResetSession(session: KratosSession | null): boolean {
  return hasKratosAuthenticationMethod(session, "code_recovery");
}

// ---------------------------------------------------------------------------
// Redirect helpers (each one ends the request)
// ---------------------------------------------------------------------------

// Resolve the URL to use when bootstrapping a fresh Kratos settings flow.
// Prefers server-side init (gives a direct `/settings?flow=<id>` URL) and
// falls back to a full browser-side Kratos bootstrap when that fails (e.g.
// the session is missing — Kratos will then redirect the browser to /login).
//
// The caller is expected to hand the result straight to `redirect()` so the
// current request terminates.
async function resolveFreshSettingsFlowUrl(section: SettingsSection): Promise<string> {
  const newFlowId = await initBrowserFlow("settings");
  return newFlowId
    ? buildSettingsHref(section, newFlowId)
    : createBrowserFlowUrl("settings");
}

// Decide where to send the user once their settings flow has completed.
//   - Recovery reset → /login: the code_recovery session is short-lived and
//     not trusted for the rest of the app; the user signs in with the new
//     password.
//   - Pending OAuth challenge → /oauth/resume: finish the Hydra handshake.
//   - Otherwise → BookShare profile: normal account management landing.
function redirectAfterSuccess(
  isRecoveryReset: boolean,
  hasPendingHydraLogin: boolean
): never {
  if (isRecoveryReset) {
    redirect("/login");
  }
  if (hasPendingHydraLogin) {
    redirect("/oauth/resume");
  }
  redirect(getBookshareProfileUrl());
}

// ---------------------------------------------------------------------------
// Main loader
// ---------------------------------------------------------------------------

// Entry point for the /settings page. The loader owns three decisions so the
// UI component only has to render a ready-to-use model:
//
//   1. Flow bootstrap — if the URL has no flow, or the referenced flow is
//      stale/invalid, mint a fresh Kratos settings flow and redirect to it.
//   2. Post-completion routing — if Kratos says the flow has already been
//      saved successfully, route the user to the correct next destination
//      (login / oauth resume / app profile) instead of re-rendering.
//   3. Render-time model — otherwise, build the section model the form
//      component needs (profile vs password, account vs recovery-reset).
//
// The /settings route is used for two purposes:
//   (a) Account management — profile + password edits for logged-in users.
//   (b) Required password reset triggered by the recovery code flow.
// Case (b) is detected from the Kratos session (`code_recovery` method) and
// forces the password section with reset-specific copy and redirect targets.
export async function loadSettingsPageData(
  searchParams: AuthSearchParams
): Promise<SettingsPageModel> {
  const flowId = getSingleParam(searchParams, "flow");
  const sectionParam = getSingleParam(searchParams, "section");
  const requestedSection: SettingsSection =
    sectionParam === "password" ? "password" : "profile";

  // Step 1: ensure we have a Kratos flow to render. A missing flow ID or a
  // flow Kratos no longer recognises both lead to a fresh bootstrap.
  if (!flowId) {
    redirect(await resolveFreshSettingsFlowUrl(requestedSection));
  }

  const flow = await getBrowserFlow("settings", flowId);
  if (!flow) {
    redirect(await resolveFreshSettingsFlowUrl(requestedSection));
  }

  // Step 2: gather context used by every branch below. Session tells us
  // whether this is recovery-reset vs account management. The Hydra cookie
  // tells us whether an OAuth transaction is waiting for us to finish.
  const session = await getKratosSession();
  const isRecoveryReset = isRecoveryResetSession(session);
  const hasPendingHydraLogin = Boolean(await getHydraLoginChallenge());

  // Step 3: a completed flow has no form to render — send the user onward.
  // NOTE: the recovery flow's initial settings redirect has state=`show_form`
  // (not `success`), so this branch does NOT fire until the user actually
  // submits a new password.
  if (isFlowComplete(flow)) {
    redirectAfterSuccess(isRecoveryReset, hasPendingHydraLogin);
  }

  // Step 4: build the render model for the form.
  //   - Recovery-reset users are locked to the password section regardless
  //     of the `section` query param, and see reset-specific copy / links.
  //   - Account users see the section they requested (profile by default).
  const activeSection: SettingsSection = isRecoveryReset ? "password" : requestedSection;
  const mode: SettingsMode = isRecoveryReset ? "recovery-reset" : "account";
  const profileUrl = getBookshareProfileUrl();
  const links = {
    retryHref: isRecoveryReset ? "/recovery" : buildSettingsHref(activeSection),
    profileSectionHref: buildSettingsHref("profile", flow.id),
    passwordSectionHref: buildSettingsHref("password", flow.id),
    backHref: hasPendingHydraLogin ? "/login" : profileUrl,
    backLabel: hasPendingHydraLogin ? "Back to sign in" : "Back to profile",
  };

  try {
    return buildSettingsModel(flow, { activeSection, mode, links });
  } catch (error) {
    // Kratos returned a flow whose nodes do not match what the UI expects
    // (e.g. required submit button missing). Fall back to a recoverable
    // error page that offers a "start over" link instead of crashing.
    const fallback: SettingsErrorPageModel = {
      variant: "error",
      mode,
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
