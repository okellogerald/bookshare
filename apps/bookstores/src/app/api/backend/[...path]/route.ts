import { getAccessToken, getSession } from "@/domain/auth/lib/session";
import {
  AuthorizationSurface,
  isReadGatewayResourceName,
} from "@bookshare/shared";
import { createLogger } from "@bookshare/logger";
import {
  buildProxyBaseUrlCandidates,
  buildProxyRequestUrl,
} from "@/shared/lib/proxy-targets";
import { NextRequest, NextResponse } from "next/server";

const logger = createLogger({ service: "bookstores-auth" }).child({
  route: "api.backend",
});

const API_URL_CANDIDATES = buildProxyBaseUrlCandidates(
  process.env.API_INTERNAL_URL,
  process.env.NEXT_PUBLIC_API_URL,
  "http://localhost:3333/api",
  "http://api:3333/api"
);

async function proxyToNestJS(request: NextRequest, path: string[]) {
  const token = await getAccessToken();
  const session = await getSession();

  if (!session) {
    logger.warn(
      { method: request.method, path: path.join("/") },
      "Rejected authenticated API proxy request without session"
    );
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!token) {
    logger.warn(
      { method: request.method, path: path.join("/"), subject: session.user.id },
      "Rejected API proxy request because the session had no usable token"
    );
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.emailVerified !== true) {
    logger.warn(
      {
        method: request.method,
        path: path.join("/"),
        subject: session.user.id,
      },
      "Rejected authenticated API proxy request for unverified user"
    );
    return NextResponse.json(
      { error: "Email verification required" },
      { status: 403 }
    );
  }

  return proxyRequest(request, path, token);
}

async function proxyRequest(
  request: NextRequest,
  path: string[],
  token: string | null
) {
  const gatewayPath =
    (request.method === "GET" || request.method === "HEAD") &&
    path.length === 1 &&
    isReadGatewayResourceName(path[0])
      ? ["read", AuthorizationSurface.BOOKSTORE_PORTAL, path[0]]
      : path;
  const apiPath = gatewayPath.join("/");
  const search = request.nextUrl.searchParams.toString();
  const headers = new Headers();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
    headers.set("x-auth-access-token", token);
  }

  for (const [source, target] of [
    ["content-type", "Content-Type"],
    ["accept", "Accept"],
    ["prefer", "Prefer"],
    ["range", "Range"],
  ] as const) {
    const value = request.headers.get(source);
    if (value) {
      headers.set(target, value);
    }
  }

  const fetchOptions: RequestInit = { method: request.method, headers };

  if (request.method !== "GET" && request.method !== "HEAD") {
    const body = await request.arrayBuffer();
    if (body.byteLength > 0) {
      fetchOptions.body = body;
    }
  }

  let lastError: unknown = null;
  let lastUrl: string | null = null;

  for (const baseUrl of API_URL_CANDIDATES) {
    const url = buildProxyRequestUrl(baseUrl, apiPath, search);
    lastUrl = url;

    try {
      const response = await fetch(url, fetchOptions);

      if (response.status === 204) {
        return new NextResponse(null, { status: 204 });
      }

      const responseContentType = response.headers.get("content-type");
      if (responseContentType?.includes("application/json")) {
        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
      }

      const text = await response.text();
      return new NextResponse(text, { status: response.status });
    } catch (error) {
      lastError = error;
    }
  }

  const detail =
    lastError instanceof Error
      ? lastError.message
      : "No reachable API upstream configured.";

  logger.error(
    {
      err: lastError,
      method: request.method,
      apiPath,
      upstream: lastUrl,
    },
    "Failed to reach API upstream"
  );

  return NextResponse.json(
    { error: "Failed to reach API", detail, upstream: lastUrl },
    { status: 502 }
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyToNestJS(request, path);
}
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyToNestJS(request, path);
}
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyToNestJS(request, path);
}
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyToNestJS(request, path);
}
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyToNestJS(request, path);
}
