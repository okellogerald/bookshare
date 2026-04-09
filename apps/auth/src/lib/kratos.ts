import { cookies } from "next/headers";
import {
  getKratosBrowserUrl,
  getKratosInternalPublicUrl,
} from "./config";

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

async function createCookieHeader(): Promise<string> {
  const store = await cookies();

  return store
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
}

export function withOptionalReturnTo(url: URL, returnTo?: string): string {
  if (returnTo && returnTo.trim().length > 0) {
    url.searchParams.set("return_to", returnTo);
  }

  return url.toString();
}

export function createBrowserFlowUrl(kind: KratosFlowKind, returnTo?: string): string {
  const baseUrl = new URL(
    `/self-service/${kind}/browser`,
    getKratosBrowserUrl()
  );
  return withOptionalReturnTo(baseUrl, returnTo);
}

function extractFlowIdFromLocation(location: string): string | null {
  if (!location || location.trim().length === 0) return null;

  try {
    const parsed = new URL(location, getKratosBrowserUrl());
    return parsed.searchParams.get("flow");
  } catch {
    return null;
  }
}

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

export function getFlowMessages(flow: KratosBrowserFlow): KratosUiMessage[] {
  return flow.ui.messages ?? [];
}
