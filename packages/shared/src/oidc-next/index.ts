export interface OIDCTransactionCookieNames {
  codeVerifier: string;
  state: string;
  returnTo: string;
}

export interface OIDCClientCookieNames extends OIDCTransactionCookieNames {
  session?: string;
  token?: string;
  loggedOut?: string;
}

interface CreateOIDCEnvHelpersOptions {
  defaultAppUrl: string;
  runtimeName: string;
  defaultPublicIssuerUrl?: string;
}

interface CookieStoreLike {
  set(
    name: string,
    value: string,
    options?: {
      httpOnly?: boolean;
      secure?: boolean;
      sameSite?: "lax" | "strict" | "none";
      path?: string;
      maxAge?: number;
    }
  ): unknown;
  delete(name: string): unknown;
}

interface RequestCookieStoreLike {
  get(name: string): { value: string } | undefined;
}

export interface OIDCCallbackTransaction {
  codeVerifier: string;
  expectedState: string;
  returnTo: string;
}

type JSONPrimitive = string | number | boolean | null;
type JSONValue =
  | JSONPrimitive
  | { [key: string]: JSONValue | undefined }
  | JSONValue[];

export interface OIDCServerMetadataShape {
  [key: string]: JSONValue | undefined;
  issuer: string;
  authorization_endpoint: string;
  end_session_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  userinfo_endpoint: string;
}

export interface OIDCEnvironment {
  clientId: string;
  customFetchHost: string | null;
  allowInsecureRequests: boolean;
  serverMetadata: OIDCServerMetadataShape;
}

interface CreateLoginTransactionOptions {
  requestedReturnTo: string | null;
  defaultReturnTo: string;
}

interface PersistOIDCTransactionOptions {
  cookies: CookieStoreLike;
  encrypt: (value: string) => Promise<string>;
  cookieNames: OIDCTransactionCookieNames;
  transaction: {
    codeVerifier: string;
    state: string;
    returnTo: string;
  };
}

interface ReadOIDCTransactionOptions {
  cookies: RequestCookieStoreLike;
  decrypt: (value: string) => Promise<string>;
  cookieNames: OIDCTransactionCookieNames;
  defaultReturnTo: string;
}

const DEFAULT_PUBLIC_ISSUER_URL = "http://localhost:4444";
const OIDC_TRANSACTION_COOKIE_MAX_AGE_SECONDS = 10 * 60;
const LOGGED_OUT_MARKER_MAX_AGE_SECONDS = 30 * 60;

function resolveUrl(
  value: string | undefined,
  base: URL,
  defaultPath: string
): string {
  if (!value || value.trim().length === 0) {
    return new URL(defaultPath, base).toString();
  }

  return new URL(value, base).toString();
}

function getCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

function parseScopes(value: string | string[] | undefined): string[] {
  if (!value) return [];

  const rawValues = Array.isArray(value) ? value : [value];
  return rawValues
    .flatMap((item) => item.split(" "))
    .map((scope) => scope.trim())
    .filter(Boolean);
}

function toBase64Url(buffer: ArrayBuffer | ArrayBufferView): string {
  const bytes =
    buffer instanceof ArrayBuffer
      ? new Uint8Array(buffer)
      : new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let binary = "";

  for (let index = 0; index < bytes.length; index++) {
    binary += String.fromCharCode(bytes[index]);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomBase64Url(byteLength: number): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

async function calculatePKCECodeChallenge(codeVerifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(codeVerifier)
  );

  return toBase64Url(digest);
}

export function createOIDCEnvHelpers(options: CreateOIDCEnvHelpersOptions) {
  function getAppBaseUrl(): string {
    return process.env.NEXT_PUBLIC_APP_URL || options.defaultAppUrl;
  }

  function getOIDCEnvironment(): OIDCEnvironment {
    const publicIssuer = new URL(
      process.env.OIDC_ISSUER_URL ||
        process.env.NEXT_PUBLIC_OIDC_ISSUER_URL ||
        options.defaultPublicIssuerUrl ||
        DEFAULT_PUBLIC_ISSUER_URL
    );
    const internalIssuer = new URL(
      process.env.OIDC_INTERNAL_URL || publicIssuer.href
    );
    const clientId = process.env.OIDC_CLIENT_ID;

    if (!clientId) {
      throw new Error(
        `OIDC_CLIENT_ID is not configured. Set it in .env and restart the ${options.runtimeName}.`
      );
    }

    return {
      clientId,
      customFetchHost:
        internalIssuer.host !== publicIssuer.host ? publicIssuer.host : null,
      allowInsecureRequests: process.env.NODE_ENV !== "production",
      serverMetadata: {
        issuer: publicIssuer.origin,
        authorization_endpoint: resolveUrl(
          process.env.OIDC_AUTHORIZATION_ENDPOINT,
          publicIssuer,
          "/oauth2/auth"
        ),
        end_session_endpoint: resolveUrl(
          process.env.OIDC_END_SESSION_ENDPOINT,
          publicIssuer,
          "/oauth2/sessions/logout"
        ),
        token_endpoint: resolveUrl(
          process.env.OIDC_TOKEN_ENDPOINT,
          internalIssuer,
          "/oauth2/token"
        ),
        jwks_uri: resolveUrl(
          process.env.OIDC_JWKS_URI,
          internalIssuer,
          "/.well-known/jwks.json"
        ),
        userinfo_endpoint: resolveUrl(
          process.env.OIDC_USERINFO_ENDPOINT,
          internalIssuer,
          "/userinfo"
        ),
      },
    };
  }

  function getRedirectUri(): string {
    return `${getAppBaseUrl()}/api/auth/callback`;
  }

  function getPostLogoutRedirectUri(): string {
    return getAppBaseUrl();
  }

  return {
    getOIDCEnvironment,
    getRedirectUri,
    getPostLogoutRedirectUri,
  };
}

export function sanitizeRelativeReturnTo(
  value: string | null | undefined,
  fallback: string
): string {
  if (!value) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//")) return fallback;
  if (value.startsWith("/api/auth")) return fallback;
  return value;
}

export function buildScope(
  baseScopes: string[],
  additionalScopes?: string | string[]
): string {
  return Array.from(
    new Set([...parseScopes(baseScopes), ...parseScopes(additionalScopes)])
  ).join(" ");
}

export async function createLoginTransaction(
  options: CreateLoginTransactionOptions
): Promise<{
  codeVerifier: string;
  codeChallenge: string;
  state: string;
  returnTo: string;
}> {
  const codeVerifier = randomBase64Url(32);

  return {
    codeVerifier,
    codeChallenge: await calculatePKCECodeChallenge(codeVerifier),
    state: randomBase64Url(32),
    returnTo: sanitizeRelativeReturnTo(
      options.requestedReturnTo,
      options.defaultReturnTo
    ),
  };
}

export async function persistOIDCTransaction(
  options: PersistOIDCTransactionOptions
): Promise<void> {
  const cookieOptions = getCookieOptions(OIDC_TRANSACTION_COOKIE_MAX_AGE_SECONDS);

  options.cookies.set(
    options.cookieNames.codeVerifier,
    await options.encrypt(options.transaction.codeVerifier),
    cookieOptions
  );
  options.cookies.set(
    options.cookieNames.state,
    await options.encrypt(options.transaction.state),
    cookieOptions
  );
  options.cookies.set(
    options.cookieNames.returnTo,
    await options.encrypt(options.transaction.returnTo),
    cookieOptions
  );
}

export async function readOIDCTransaction(
  options: ReadOIDCTransactionOptions
): Promise<OIDCCallbackTransaction | null> {
  const verifierCookie = options.cookies.get(options.cookieNames.codeVerifier)?.value;
  const stateCookie = options.cookies.get(options.cookieNames.state)?.value;

  if (!verifierCookie || !stateCookie) {
    return null;
  }

  const codeVerifier = await options.decrypt(verifierCookie);
  const expectedState = await options.decrypt(stateCookie);
  const encryptedReturnTo = options.cookies.get(options.cookieNames.returnTo)?.value;

  let returnToRaw: string | null = null;
  if (encryptedReturnTo) {
    try {
      returnToRaw = await options.decrypt(encryptedReturnTo);
    } catch {
      returnToRaw = null;
    }
  }

  return {
    codeVerifier,
    expectedState,
    returnTo: sanitizeRelativeReturnTo(returnToRaw, options.defaultReturnTo),
  };
}

export function clearOIDCTransactionCookies(
  cookies: CookieStoreLike,
  cookieNames: OIDCTransactionCookieNames
): void {
  cookies.delete(cookieNames.codeVerifier);
  cookies.delete(cookieNames.state);
  cookies.delete(cookieNames.returnTo);
}

export function clearOIDCClientCookies(
  cookies: CookieStoreLike,
  cookieNames: OIDCClientCookieNames
): void {
  if (cookieNames.session) {
    cookies.delete(cookieNames.session);
  }

  if (cookieNames.token) {
    cookies.delete(cookieNames.token);
  }

  clearOIDCTransactionCookies(cookies, cookieNames);
}

export function clearLoggedOutMarker(
  cookies: CookieStoreLike,
  cookieName: string | undefined
): void {
  if (cookieName) {
    cookies.delete(cookieName);
  }
}

export function setLoggedOutMarker(
  cookies: CookieStoreLike,
  cookieName: string | undefined
): void {
  if (!cookieName) return;

  cookies.set(
    cookieName,
    "1",
    getCookieOptions(LOGGED_OUT_MARKER_MAX_AGE_SECONDS)
  );
}

export function buildEndSessionParams(options: {
  postLogoutRedirectUri: string;
  clientId?: string;
  idTokenHint?: string;
}): {
  post_logout_redirect_uri: string;
  state: string;
  id_token_hint?: string;
  client_id?: string;
} {
  return {
    post_logout_redirect_uri: options.postLogoutRedirectUri,
    state: crypto.randomUUID(),
    ...(options.idTokenHint ? { id_token_hint: options.idTokenHint } : {}),
    ...(options.clientId ? { client_id: options.clientId } : {}),
  };
}
