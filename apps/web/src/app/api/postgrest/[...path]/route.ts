/**
 * PostgREST proxy route handler.
 *
 * Forwards client-side requests to PostgREST with the auth token attached.
 * This keeps the JWT server-side only (never exposed to the browser).
 *
 * Usage: GET /api/postgrest/{table}?select=*&column=eq.value
 */

import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/features/auth/lib/session";

const POSTGREST_URL =
  process.env.POSTGREST_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_POSTGREST_URL ||
  "http://postgrest:3000";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const token = await getAccessToken();

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Build the PostgREST URL from the path segments and query params
  const tablePath = path.join("/");
  const url = new URL(`/${tablePath}`, POSTGREST_URL);

  // Forward all query params
  request.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  // Forward special PostgREST headers from client
  if (request.headers.get("x-postgrest-single") === "true") {
    headers["Accept"] = "application/vnd.pgrst.object+json";
  }
  if (request.headers.get("x-postgrest-count") === "true") {
    headers["Prefer"] = "count=exact";
  }

  try {
    const response = await fetch(url.toString(), { headers });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: "PostgREST query failed", detail: error },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Extract and forward count
    const responseBody: Record<string, unknown> = { data };
    const contentRange = response.headers.get("Content-Range");
    if (contentRange) {
      const total = contentRange.split("/")[1];
      if (total && total !== "*") {
        responseBody.count = parseInt(total, 10);
      }
    }

    return NextResponse.json(responseBody);
  } catch (error) {
    console.error("PostgREST proxy error:", error);
    return NextResponse.json(
      { error: "Failed to reach PostgREST" },
      { status: 502 }
    );
  }
}
