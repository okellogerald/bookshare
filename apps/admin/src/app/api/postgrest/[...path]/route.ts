import { NextRequest, NextResponse } from "next/server";
import { getAccessToken, getSession } from "@/features/auth/lib/session";

const POSTGREST_URL =
  process.env.POSTGREST_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_POSTGREST_URL ||
  "http://postgrest:3000";

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

  const url = new URL(`/${tablePath}`, POSTGREST_URL);
  request.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (!isPublicPath && token) {
    headers.Authorization = `Bearer ${token}`;
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
    return NextResponse.json(
      { error: "Failed to reach PostgREST" },
      { status: 502 }
    );
  }
}
