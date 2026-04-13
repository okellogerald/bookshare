/**
 * Kratos Identity API Client — Auth-Portal
 *
 * Provides the Auth-Portal's interface to Ory Kratos (the identity provider).
 * Handles two main concerns:
 *
 * 1. **Session validation**: `getKratosSession()` calls Kratos's `/sessions/whoami`
 *    to check if the browser has a valid `ory_kratos_session` cookie and returns
 *    the identity (id, traits, verifiable_addresses). This is how the login
 *    challenge handler knows WHO the user is.
 *
 * 2. **Flow management**: `initBrowserFlow()` and `getBrowserFlow()` create and
 *    retrieve Kratos self-service flows (login, registration, verification,
 *    recovery, settings). These flows are rendered by Auth-Portal's UI pages.
 *
 * Auth policy helpers:
 * - `isKratosEmailVerified()`: checks verifiable_addresses for a verified entry
 * - `isKratosProfileComplete()`: checks traits.name.first and traits.name.last
 *
 * Network note: all calls go to `KRATOS_PUBLIC_INTERNAL_URL` (internal Docker
 * address like http://kratos:4433), while browser-facing URLs use
 * `KRATOS_BROWSER_URL` (like http://localhost:4433).
 *
 * @see `/oauth/login/route.ts` — uses getKratosSession and policy helpers
 * @see `/oauth/consent/route.ts` — uses getKratosSession for fresh traits
 */
import { cookies } from "next/headers";
import {
  getKratosBrowserUrl,
  getKratosInternalPublicUrl,
} from "./config";

/** The self-service flow types supported by Kratos. */
export type KratosFlowKind =
  | "login"
  | "registration"
  | "recovery"
  | "verification"
  | "settings";

export interface KratosUiMessage {
  id?: number;
  text: string;
  type: "error" | "info" | "success" | "warning";
}

export interface KratosUiNode {
  type: "input";
  group: string;
  messages: KratosUiMessage[];
  meta?: {
    label?: {
      id?: number;
      text?: string;
      type?: string;
      context?: Record<string, unknown>;
    };
  };
  attributes: {
    name?: string;
    type?: string;
    value?: string;
    required?: boolean;
    disabled?: boolean;
    autocomplete?: string;
  };
}

export interface KratosBrowserFlow {
  id: string;
  state?: string;
  active?: string;
  return_to?: string;
  identity?: {
    id?: string;
    traits?: Record<string, unknown>;
  };
  ui: {
    action: string;
    method: string;
    messages?: KratosUiMessage[];
    nodes: KratosUiNode[];
  };
}

export interface KratosFlowError {
  error?: {
    id?: string;
    code?: number;
    reason?: string;
    status?: string;
    message?: string;
    details?: unknown;
  };
}

export interface KratosSession {
  id: string;
  authentication_methods?: Array<{
    method?: string;
    aal?: string;
    completed_at?: string;
  }>;
  identity?: {
    id: string;
    traits?: Record<string, unknown>;
    verifiable_addresses?: Array<{
      value?: string;
      verified?: boolean;
      via?: string;
    }>;
  };
}

/**
 * Forward all browser cookies to Kratos for session validation.
 * Kratos uses the `ory_kratos_session` cookie to identify the user.
 * We forward ALL cookies because Kratos may also use CSRF cookies.
 */
async function createCookieHeader(): Promise<string> {
  const store = await cookies();

  return store
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
}

/** Append a return_to param to a Kratos flow URL so the user comes back here. */
export function withOptionalReturnTo(url: URL, returnTo?: string): string {
  if (returnTo && returnTo.trim().length > 0) {
    url.searchParams.set("return_to", returnTo);
  }

  return url.toString();
}

/** Build the public-facing URL that the browser uses to start a Kratos flow. */
export function createBrowserFlowUrl(kind: KratosFlowKind, returnTo?: string): string {
  const baseUrl = new URL(
    `/self-service/${kind}/browser`,
    getKratosBrowserUrl()
  );
  return withOptionalReturnTo(baseUrl, returnTo);
}

/** Extract the flow ID from a Kratos redirect Location header. */
function extractFlowIdFromLocation(location: string): string | null {
  if (!location || location.trim().length === 0) return null;

  try {
    const parsed = new URL(location, getKratosBrowserUrl());
    return parsed.searchParams.get("flow");
  } catch {
    return null;
  }
}

/**
 * Initialize a Kratos self-service browser flow (server-side).
 *
 * Calls Kratos's internal URL with `redirect: "manual"` to capture the
 * redirect Location header, which contains the flow ID. This avoids a
 * full browser redirect cycle — the Auth-Portal can render the flow's UI
 * directly using the flow ID.
 *
 * @returns The flow ID, or null if initialization failed.
 */
export async function initBrowserFlow(
  kind: KratosFlowKind,
  returnTo?: string
): Promise<string | null> {
  const url = new URL(
    `/self-service/${kind}/browser`,
    getKratosInternalPublicUrl()
  );

  if (returnTo && returnTo.trim().length > 0) {
    url.searchParams.set("return_to", returnTo);
  }

  const cookieHeader = await createCookieHeader();
  const headers: HeadersInit = {
    Accept: "application/json",
  };

  if (cookieHeader) {
    headers.Cookie = cookieHeader;
  }

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers,
      cache: "no-store",
      redirect: "manual",
    });

    const location = response.headers.get("location");
    if (location) {
      return extractFlowIdFromLocation(location);
    }

    if (!response.ok) return null;

    try {
      const body = (await response.json()) as { id?: unknown };
      return typeof body.id === "string" && body.id.trim().length > 0
        ? body.id
        : null;
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

/**
 * Fetch the state of an existing Kratos flow by ID.
 * Returns the flow's UI metadata: form fields (nodes), action URL, method,
 * validation messages, and current state. Used to render Auth-Portal pages.
 */
export async function getBrowserFlow(
  kind: KratosFlowKind,
  flowId: string
): Promise<KratosBrowserFlow | null> {
  const url = new URL(`/self-service/${kind}/flows`, getKratosInternalPublicUrl());
  url.searchParams.set("id", flowId);

  const cookieHeader = await createCookieHeader();
  const headers: HeadersInit = {
    Accept: "application/json",
  };

  if (cookieHeader) {
    headers.Cookie = cookieHeader;
  }

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as KratosBrowserFlow;
  } catch {
    return null;
  }
}

/** Fetch a Kratos flow error by ID — used to display error details to the user. */
export async function getFlowErrorById(
  errorId: string
): Promise<KratosFlowError | null> {
  const url = new URL("/self-service/errors", getKratosInternalPublicUrl());
  url.searchParams.set("id", errorId);

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!response.ok) return null;
    return (await response.json()) as KratosFlowError;
  } catch {
    return null;
  }
}

/**
 * Check if the browser has a valid Kratos session.
 *
 * Calls `/sessions/whoami` on Kratos's internal URL, forwarding the browser's
 * cookies (specifically `ory_kratos_session`). If valid, returns the full
 * session with identity traits and verifiable addresses.
 *
 * Used by:
 * - Login challenge handler: to decide if the user needs to authenticate
 * - Consent handler: to get fresh traits for building token claims
 *
 * @param cookieHeader - Raw Cookie header from the browser request.
 *   Falls back to Next.js `cookies()` if not provided.
 */
export async function getKratosSession(
  cookieHeader?: string
): Promise<KratosSession | null> {
  const resolvedCookieHeader =
    cookieHeader && cookieHeader.trim().length > 0
      ? cookieHeader
      : await createCookieHeader();

  if (!resolvedCookieHeader) {
    return null;
  }

  const response = await fetch(
    `${getKratosInternalPublicUrl()}/sessions/whoami`,
    {
      method: "GET",
      headers: {
        accept: "application/json",
        cookie: resolvedCookieHeader,
      },
      cache: "no-store",
    }
  );

  if (!response.ok) return null;
  return (await response.json()) as KratosSession;
}

function normalizeEmail(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
}

function normalizeText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

/**
 * Auth policy step 2: Is the user's email verified?
 *
 * Checks Kratos's verifiable_addresses for a verified entry matching the
 * identity's email trait. If no email trait exists, any verified address counts.
 *
 * This is one of three gates in the login challenge handler's authorization
 * policy. Unverified users are redirected to the verification page.
 */
export function isKratosEmailVerified(
  session: KratosSession | null
): boolean {
  if (!session?.identity?.verifiable_addresses?.length) {
    return false;
  }

  const traitEmail = normalizeEmail(
    (session.identity.traits as { email?: unknown } | undefined)?.email
  );

  if (!traitEmail) {
    return session.identity.verifiable_addresses.some(
      (address) => address.verified === true
    );
  }

  return session.identity.verifiable_addresses.some((address) => {
    if (address.verified !== true) return false;
    return normalizeEmail(address.value) === traitEmail;
  });
}

/**
 * Auth policy step 3: Is the user's profile complete?
 *
 * Checks that `traits.name.first` and `traits.name.last` are both non-empty.
 * This ensures the user has provided their real name, which is required for
 * the BookShare community features.
 *
 * Incomplete profiles are redirected to the settings page.
 */
export function isKratosProfileComplete(
  session: KratosSession | null
): boolean {
  if (!session?.identity?.traits || typeof session.identity.traits !== "object") {
    return false;
  }

  const traits = session.identity.traits as Record<string, unknown>;
  const nameObj =
    typeof traits.name === "object" && traits.name !== null
      ? (traits.name as Record<string, unknown>)
      : {};

  const firstName = normalizeText(nameObj.first);
  const lastName = normalizeText(nameObj.last);

  return firstName.length > 0 && lastName.length > 0;
}

/** Check if the session was authenticated via a specific method (e.g., "password"). */
export function hasKratosAuthenticationMethod(
  session: KratosSession | null,
  method: string
): boolean {
  if (!session?.authentication_methods?.length) {
    return false;
  }

  return session.authentication_methods.some(
    (entry) => entry.method?.trim() === method
  );
}

/** Extract top-level UI messages from a flow (errors, success notifications). */
export function getFlowMessages(flow: KratosBrowserFlow): KratosUiMessage[] {
  return flow.ui.messages ?? [];
}
