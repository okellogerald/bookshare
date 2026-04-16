import { NextRequest, NextResponse } from "next/server";
import { getAccessToken, getSession } from "@/domain/auth/lib/session";
import {
  buildProxyBaseUrlCandidates,
  buildProxyRequestUrl,
} from "@/shared/lib/proxy-targets";

const POSTGREST_URL_CANDIDATES = buildProxyBaseUrlCandidates(
  process.env.POSTGREST_INTERNAL_URL,
  process.env.NEXT_PUBLIC_POSTGREST_URL,
  "http://localhost:3336",
  "http://postgrest:3000"
);

const PUBLIC_POSTGREST_PATHS = new Set([
  "books_with_authors",
  "books_with_categories",
  "editions",
  "categories",
]);

function isPublicPostgrestPath(path: string) {
  return PUBLIC_POSTGREST_PATHS.has(path);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const tablePath = path.join("/");
  const isPublicPath = isPublicPostgrestPath(tablePath);
  let token: string | null = null;

  if (!isPublicPath) {
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
  }

  const search = request.nextUrl.searchParams.toString();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const preferHeader = request.headers.get("prefer");

  if (!isPublicPath && token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (preferHeader) {
    headers.Prefer = preferHeader;
  }

  let lastError: unknown = null;
  let lastUrl: string | null = null;

  for (const baseUrl of POSTGREST_URL_CANDIDATES) {
    const url = buildProxyRequestUrl(baseUrl, tablePath, search);
    lastUrl = url;

    try {
      const response = await fetch(url, { headers });

      if (!response.ok) {
        const error = await response.text();
        return NextResponse.json(
          { error: "PostgREST query failed", detail: error },
          { status: response.status }
        );
      }

      const data = await response.json();
      const responseBody: Record<string, unknown> = { data };
      const contentRange = response.headers.get("Content-Range");

      if (contentRange) {
        const total = contentRange.split("/")[1];
        if (total && total !== "*") {
          responseBody.count = parseInt(total, 10);
        }
      }

      if (responseBody.count === undefined && Array.isArray(data)) {
        responseBody.count = data.length;
      }

      return NextResponse.json(responseBody);
    } catch (error) {
      lastError = error;
    }
  }

  const detail =
    lastError instanceof Error
      ? lastError.message
      : "No reachable PostgREST upstream configured.";

  return NextResponse.json(
    { error: "Failed to reach PostgREST", detail, upstream: lastUrl },
    { status: 502 }
  );
}
