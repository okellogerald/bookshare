/**
 * PostgREST proxy — routes through NestJS (which handles auth + PostgREST forwarding).
 */
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

const PUBLIC_PATHS = new Set([
  "books_with_authors",
  "books_with_categories",
  "editions",
  "categories",
]);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const tablePath = path.join("/");
  const isPublic = PUBLIC_PATHS.has(tablePath);

  let token: string | null = null;

  if (!isPublic) {
    token = await getAccessToken();
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
  } else {
    token = await getAccessToken();
  }

  const search = request.nextUrl.searchParams.toString();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) headers["Authorization"] = `Bearer ${token}`;

  const preferHeader = request.headers.get("prefer");
  if (preferHeader) headers["Prefer"] = preferHeader;

  let lastError: unknown = null;
  let lastUrl: string | null = null;

  for (const baseUrl of API_URL_CANDIDATES) {
    const url = buildProxyRequestUrl(baseUrl, tablePath, search);
    lastUrl = url;

    try {
      const response = await fetch(url, { headers });

      if (!response.ok) {
        const detail = await response.text();
        return NextResponse.json(
          { error: "Query failed", detail },
          { status: response.status }
        );
      }

      // NestJS proxy returns { data, count }
      const body = await response.json() as { data: unknown; count?: number };
      return NextResponse.json(body);
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
