import { NextRequest, NextResponse } from "next/server";
import {
  getOrganizationAccessToken,
  getOrganizationSession,
} from "@/organizations/auth/session";

const AUTH_API_URL =
  process.env.AUTH_API_INTERNAL_URL || "http://localhost:3340/api";

async function proxyRequest(request: NextRequest, path: string[]) {
  const token = await getOrganizationAccessToken();
  const session = await getOrganizationSession();
  if (!token || !session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(path.join("/"), `${AUTH_API_URL.replace(/\/$/, "")}/`);
  url.search = request.nextUrl.search;
  const headers = new Headers();
  headers.set("Authorization", `Bearer ${token}`);

  for (const [source, target] of [
    ["content-type", "Content-Type"],
    ["accept", "Accept"],
  ] as const) {
    const value = request.headers.get(source);
    if (value) headers.set(target, value);
  }

  const options: RequestInit = { method: request.method, headers };
  if (request.method !== "GET" && request.method !== "HEAD") {
    const body = await request.arrayBuffer();
    if (body.byteLength > 0) options.body = body;
  }

  try {
    const response = await fetch(url, options);
    if (response.status === 204) {
      return new NextResponse(null, { status: 204 });
    }

    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      return NextResponse.json(await response.json(), { status: response.status });
    }
    return new NextResponse(await response.text(), { status: response.status });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Auth API unavailable";
    return NextResponse.json(
      { error: "Failed to reach auth API", detail },
      { status: 502 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(request, path);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(request, path);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(request, path);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return proxyRequest(request, path);
}
