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

const DEFAULT_HIDDEN_USERNAMES = ["admin", "admin_booktrack_local"];

function normalizeUsername(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function getHiddenUsernames(): Set<string> {
  const configured = (
    process.env.HIDDEN_USERNAMES ??
    process.env.NEXT_PUBLIC_HIDDEN_USERNAMES ??
    ""
  )
    .split(",")
    .map((value) => normalizeUsername(value))
    .filter((value): value is string => !!value);

  return new Set([...DEFAULT_HIDDEN_USERNAMES, ...configured]);
}

function isHiddenUsername(value: unknown, hiddenUsernames: Set<string>) {
  const normalized = normalizeUsername(value);
  return normalized ? hiddenUsernames.has(normalized) : false;
}

function sanitizePostgrestData(tablePath: string, data: unknown) {
  if (!Array.isArray(data)) return data;
  const hiddenUsernames = getHiddenUsernames();

  if (tablePath === "member_profiles") {
    return data.filter(
      (row) =>
        !isHiddenUsername((row as { username?: unknown })?.username, hiddenUsernames)
    );
  }

  if (tablePath === "browse_listings") {
    return data
      .filter(
        (row) =>
          !isHiddenUsername(
            (row as { owner_username?: unknown })?.owner_username,
            hiddenUsernames
          )
      )
      .map((row) => {
        const typed = row as Record<string, unknown>;
        if (!isHiddenUsername(typed.borrower_username, hiddenUsernames)) {
          return typed;
        }

        return {
          ...typed,
          borrower_username: null,
          borrower_display_name: null,
        };
      });
  }

  if (tablePath === "browse_wants") {
    return data
      .map((row) => {
        const typed = row as Record<string, unknown>;
        const wanters = Array.isArray(typed.wanters)
          ? typed.wanters.filter(
              (wanter) =>
                !isHiddenUsername(
                  (wanter as { username?: unknown })?.username,
                  hiddenUsernames
                )
            )
          : [];

        return {
          ...typed,
          wanters,
          want_count: wanters.length,
        };
      })
      .filter(
        (row) =>
          typeof (row as { want_count?: unknown }).want_count === "number" &&
          ((row as { want_count: number }).want_count > 0)
      );
  }

  return data;
}

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

    const data = sanitizePostgrestData(tablePath, await response.json());

    // Extract and forward count
    const responseBody: Record<string, unknown> = { data };
    if (Array.isArray(data)) {
      responseBody.count = data.length;
    }
    const contentRange = response.headers.get("Content-Range");
    if (contentRange && !Array.isArray(data)) {
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
