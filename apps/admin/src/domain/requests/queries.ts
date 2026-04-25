"use client";

import { useQuery } from "@tanstack/react-query";
import type { AdminRequestsOverview } from "@bookshare/shared";

function getErrorMessage(payload: unknown, fallback: string) {
  if (typeof payload === "string" && payload.trim().length > 0) {
    return payload;
  }

  if (payload && typeof payload === "object" && "message" in payload) {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === "string" && message.trim().length > 0) {
      return message;
    }
    if (
      Array.isArray(message) &&
      typeof message[0] === "string" &&
      message[0].trim().length > 0
    ) {
      return message[0];
    }
  }

  return fallback;
}

async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);

  if (!response.ok) {
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = await response.text();
    }

    throw new Error(getErrorMessage(payload, "Requests lookup failed."));
  }

  return (await response.json()) as T;
}

async function fetchRequestsOverview(): Promise<AdminRequestsOverview> {
  return requestJson<AdminRequestsOverview>("/api/backend/requests/matches");
}

/**
 * Load the Matches workbench envelope. A single network call powers all
 * three tabs (matches / unmet / idle) plus the summary header.
 */
export function useRequestsOverview() {
  return useQuery({
    queryKey: ["admin-requests-overview"],
    queryFn: fetchRequestsOverview,
  });
}
