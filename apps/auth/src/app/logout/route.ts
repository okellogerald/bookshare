import { NextRequest, NextResponse } from "next/server";
import {
  getAuthPortalPublicUrl,
  getBookshareAppPublicUrl,
  getKratosBrowserUrl,
  getKratosInternalPublicUrl,
} from "@/lib/config";

function sanitizeReturnTo(value: string | null): string {
  const fallback = getBookshareAppPublicUrl();
  if (!value) return fallback;

  try {
    const parsed = new URL(value);
    const allowedOrigins = new Set([
      new URL(fallback).origin,
      new URL(getAuthPortalPublicUrl()).origin,
    ]);

    if (!allowedOrigins.has(parsed.origin)) {
      return fallback;
    }

    return parsed.toString();
  } catch {
    return fallback;
  }
}

function toKratosBrowserUrl(value: string): URL {
  return new URL(value, getKratosBrowserUrl());
}

export async function GET(request: NextRequest) {
  const returnTo = sanitizeReturnTo(
    request.nextUrl.searchParams.get("return_to")
  );
  const logoutFlowUrl = new URL(
    "/self-service/logout/browser",
    getKratosInternalPublicUrl()
  );
  logoutFlowUrl.searchParams.set("return_to", returnTo);

  const cookieHeader = request.headers.get("cookie") ?? "";
  const headers: HeadersInit = {
    Accept: "application/json",
  };

  if (cookieHeader) {
    headers.Cookie = cookieHeader;
  }

  try {
    const response = await fetch(logoutFlowUrl.toString(), {
      method: "GET",
      headers,
      cache: "no-store",
      redirect: "manual",
    });

    const location = response.headers.get("location");
    if (location) {
      return NextResponse.redirect(toKratosBrowserUrl(location));
    }

    if (response.status === 401) {
      return NextResponse.redirect(returnTo);
    }

    if (!response.ok) {
      console.error("Kratos logout flow creation failed", {
        status: response.status,
      });
      return NextResponse.redirect(returnTo);
    }

    const body = (await response.json()) as { logout_url?: unknown };
    if (typeof body.logout_url === "string" && body.logout_url.trim().length > 0) {
      return NextResponse.redirect(toKratosBrowserUrl(body.logout_url));
    }

    return NextResponse.redirect(returnTo);
  } catch (error) {
    console.error("Auth portal logout failed", error);
    return NextResponse.redirect(returnTo);
  }
}
