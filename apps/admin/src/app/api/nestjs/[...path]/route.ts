import { NextRequest, NextResponse } from "next/server";
import { getAccessToken, getSession } from "@/domain/auth/lib/session";
import {
  buildProxyBaseUrlCandidates,
  buildProxyRequestUrl,
} from "@/shared/lib/proxy-targets";

const API_URL_CANDIDATES = buildProxyBaseUrlCandidates(
  process.env.API_INTERNAL_URL,
  process.env.NEXT_PUBLIC_API_URL,
  "http://localhost:3333/api",
  "http://api:3333/api"
);

async function proxyToNestJS(request: NextRequest, path: string[]) {
  const token = await getAccessToken();
  const session = await getSession();

  if (!token || !session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.emailVerified !== true) {
    return NextResponse.json(
      { error: "Email verification required" },
      { status: 403 }
    );
  }

  const apiPath = path.join("/");
  const search = request.nextUrl.searchParams.toString();
  const headers = new Headers();
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("x-auth-access-token", token);

  const contentType = request.headers.get("content-type");
  if (contentType) {
    headers.set("Content-Type", contentType);
  }

  const fetchOptions: RequestInit = {
    method: request.method,
    headers,
  };

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
      const contentType = response.headers.get("content-type");

      if (response.status === 204) {
        return new NextResponse(null, { status: 204 });
      }

      if (contentType?.includes("application/json")) {
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
