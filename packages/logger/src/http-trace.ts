/**
 * HTTP request/response trace helpers.
 *
 * Logs requests and responses in a shape that mirrors the native `Request`
 * / `Response` objects (method, url, headers, status, statusText, ok) so
 * the output reads like something the browser devtools would show. App-
 * specific metadata (traceId, scenario, durationMs) lives under `context`.
 *
 * Redaction policy:
 *   - Real secrets are masked (`authorization` / `proxy-authorization`
 *     headers, `id_token_hint` query param — it's a full JWT).
 *   - Cookie values on the REQUEST side are masked (our own encrypted
 *     session blobs, plus code_verifier during the OAuth flow).
 *   - Response cookies (`set-cookie`) are logged unredacted — they're
 *     already encrypted at rest and must round-trip to the browser.
 *   - One-time-use public values (`state`, `code`, `code_challenge`) are
 *     logged unredacted. They're visible to the browser anyway and make
 *     trace correlation much easier.
 */
import { STATUS_CODES } from "node:http";
import type { Logger } from "pino";
import { redactValue } from "./index";

// ───────────────────────────────────────────────────────────────────────────
// Redaction config
// ───────────────────────────────────────────────────────────────────────────

/** Query params whose raw value is a real secret (JWT, long-lived token). */
const SECRET_QUERY_PARAMS = new Set(["id_token_hint"]);

/** Request headers that carry credentials — never log in full. */
const SECRET_REQUEST_HEADERS = new Set([
  "authorization",
  "proxy-authorization",
]);

/** Request headers to surface in the log. Everything else is dropped. */
const REQUEST_HEADER_ALLOWLIST = new Set([
  "cookie",
  "user-agent",
  "referer",
  "host",
  "x-forwarded-for",
  "x-forwarded-proto",
  "x-request-id",
]);

/** Response headers to surface in the log (set-cookie handled separately). */
const RESPONSE_HEADER_ALLOWLIST = new Set([
  "location",
  "cache-control",
  "content-type",
  "x-request-id",
]);

// ───────────────────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────────────────

export type HttpTraceOptions = {
  /** Merged into the root of the log line (alongside level/time/traceId). */
  root?: Record<string, unknown>;
  /** Nested under `context` — app-specific metadata for this request. */
  context?: Record<string, unknown>;
};

/**
 * Log an incoming request. Output shape:
 *   { method, url, headers: { cookie?, user-agent?, referer?, ... },
 *     context: { path, query, ...caller-extras } }
 */
export function logHttpRequest(
  logger: Logger,
  request: Request,
  options: HttpTraceOptions = {}
): void {
  const url = safeParseUrl(request.url);
  logger.info(
    {
      ...(options.root ?? {}),
      method: request.method,
      url: request.url,
      headers: extractRequestHeaders(request.headers),
      context: {
        path: url?.pathname ?? null,
        query: url ? redactQueryParams(url.searchParams) : {},
        ...(options.context ?? {}),
      },
    },
    "REQUEST"
  );
}

/**
 * Log an outgoing response. Output shape:
 *   { status, statusText, ok, url, headers: { location?, set-cookie?, ... },
 *     context: { durationMs, ...caller-extras } }
 *
 * `url` is the redirect destination (origin + pathname) when a Location
 * header is present; otherwise it falls back to `response.url`.
 */
export function logHttpResponse(
  logger: Logger,
  response: Response,
  options: HttpTraceOptions & { startedAt: number }
): void {
  const { startedAt, root, context } = options;
  const location = response.headers.get("location");
  logger.info(
    {
      ...(root ?? {}),
      status: response.status,
      statusText: STATUS_CODES[response.status] ?? "",
      ok: response.status >= 200 && response.status < 300,
      url: deriveDestination(location, response.url),
      headers: extractResponseHeaders(response.headers),
      context: {
        durationMs: Date.now() - startedAt,
        ...(context ?? {}),
      },
    },
    "RESPONSE"
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Internals
// ───────────────────────────────────────────────────────────────────────────

function safeParseUrl(raw: string): URL | null {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

function extractRequestHeaders(headers: Headers): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of headers.entries()) {
    const lower = key.toLowerCase();
    if (SECRET_REQUEST_HEADERS.has(lower)) {
      out[lower] = "[REDACTED]";
      continue;
    }
    if (!REQUEST_HEADER_ALLOWLIST.has(lower)) continue;
    if (lower === "cookie") {
      out.cookie = redactCookieHeader(value);
    } else {
      out[lower] = value;
    }
  }
  return out;
}

function extractResponseHeaders(headers: Headers): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of headers.entries()) {
    const lower = key.toLowerCase();
    if (lower === "set-cookie") continue;
    if (!RESPONSE_HEADER_ALLOWLIST.has(lower)) continue;
    if (lower === "location") {
      out.location = redactLocation(value);
    } else {
      out[lower] = value;
    }
  }
  const setCookies = extractSetCookies(headers);
  if (setCookies.length > 0) {
    out["set-cookie"] = setCookies;
  }
  return out;
}

/**
 * Produce a clean `Set-Cookie` array from a Response's headers, coping with
 * two different serialization shapes:
 *
 *   1. `Headers#getSetCookie()` — the standard Node/fetch API. Already an
 *      array, one entry per cookie. Works for production responses.
 *
 *   2. `x-middleware-set-cookie` — Next.js dev middleware stashes every
 *      Set-Cookie into a single comma-joined header. `getSetCookie()`
 *      returns `[]` in that case, so we parse the stash by splitting on
 *      commas that precede a new `name=` token. (Simple `split(',')` fails
 *      because cookies carry `Expires=Wed, 22 Apr …` dates containing
 *      commas.)
 */
function extractSetCookies(headers: Headers): string[] {
  const native =
    typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [];
  if (native.length > 0) return native;

  const stashed = headers.get("x-middleware-set-cookie");
  if (!stashed) return [];

  // Match a comma followed by any allowed cookie-name token + "=".
  // RFC 6265 cookie-name chars: !#$%&'*+-.^_`|~ plus alphanumerics.
  return stashed
    .split(/,(?=\s*[\w!#$%&'*+.\-^`|~]+=)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Mask every cookie value in a raw `Cookie:` header. Names stay intact
 * so you can see which cookies were actually sent.
 *
 *   "bookshare_session=<blob>; oidc_state=<blob>"
 *     →
 *   "bookshare_session=<masked>; oidc_state=<masked>"
 */
function redactCookieHeader(raw: string): string {
  return raw
    .split(/;\s*/)
    .filter(Boolean)
    .map((pair) => {
      const eq = pair.indexOf("=");
      if (eq === -1) return pair;
      const name = pair.slice(0, eq);
      const value = pair.slice(eq + 1);
      return `${name}=${redactValue(value) ?? "***"}`;
    })
    .join("; ");
}

function redactQueryParams(params: URLSearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    if (SECRET_QUERY_PARAMS.has(key)) {
      out[key] = redactValue(value) ?? "***";
    } else {
      out[key] = value;
    }
  }
  return out;
}

/**
 * Redact `id_token_hint` (a full JWT) inside a Location URL while leaving
 * the rest of the URL intact. Everything else in the query string (state,
 * code, code_challenge, prompt, etc.) is preserved on purpose.
 */
function redactLocation(raw: string): string {
  const url = safeParseUrl(raw);
  if (!url) return raw;
  let changed = false;
  for (const key of SECRET_QUERY_PARAMS) {
    const value = url.searchParams.get(key);
    if (value != null) {
      url.searchParams.set(key, redactValue(value) ?? "***");
      changed = true;
    }
  }
  return changed ? url.toString() : raw;
}

/**
 * On the server side, `response.url` is typically empty (it's populated
 * by `fetch` on the client). For our redirects the useful "destination"
 * is the origin + pathname of the Location header.
 */
function deriveDestination(
  location: string | null,
  responseUrl?: string
): string | null {
  if (location) {
    const url = safeParseUrl(location);
    if (url) return `${url.origin}${url.pathname}`;
    return location;
  }
  if (responseUrl) return responseUrl;
  return null;
}
