import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/features/auth/lib/session";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333/api";

async function proxyToNestJS(request: NextRequest, path: string[]) {
  const token = await getAccessToken();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiPath = path.join("/");
  const url = `${API_URL}/${apiPath}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const fetchOptions: RequestInit = {
    method: request.method,
    headers,
  };

  // Forward body for POST/PATCH/PUT
  if (request.method !== "GET" && request.method !== "DELETE") {
    const body = await request.text();
    if (body) fetchOptions.body = body;
  }
  // DELETE can also have a body (for collections remove copies)
  if (request.method === "DELETE") {
    const body = await request.text();
    if (body) fetchOptions.body = body;
  }

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
    return NextResponse.json({ error: "Failed to reach API" }, { status: 502 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxyToNestJS(request, path);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxyToNestJS(request, path);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxyToNestJS(request, path);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxyToNestJS(request, path);
}
