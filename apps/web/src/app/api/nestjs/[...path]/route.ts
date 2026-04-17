import { NextRequest, NextResponse } from "next/server";
import { getAccessToken, getSession } from "@/domains/auth/lib/session";

const API_URL =
  process.env.API_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://api:3333/api";

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
  const url = `${API_URL}/${apiPath}${search ? `?${search}` : ""}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  const fetchOptions: RequestInit = { method: request.method, headers };

  if (request.method !== "GET" && request.method !== "HEAD") {
    const body = await request.text();
    if (body) fetchOptions.body = body;
  }

  try {
    const response = await fetch(url, fetchOptions);

    if (response.status === 204) {
      return new NextResponse(null, { status: 204 });
    }

    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      const data = await response.json();
      return NextResponse.json(data, { status: response.status });
    }

    const text = await response.text();
    return new NextResponse(text, { status: response.status });
  } catch {
    return NextResponse.json({ error: "Failed to reach API" }, { status: 502 });
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxyToNestJS(request, (await params).path);
}
export async function POST(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxyToNestJS(request, (await params).path);
}
export async function PUT(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxyToNestJS(request, (await params).path);
}
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxyToNestJS(request, (await params).path);
}
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxyToNestJS(request, (await params).path);
}
