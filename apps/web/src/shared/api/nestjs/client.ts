import { initClient } from "@ts-rest/core";

import { apiContract } from "../contracts";

/**
 * Create a typed ts-rest client for NestJS write endpoints.
 *
 * All requests are routed through the Next.js API proxy at /api/nestjs/
 * which attaches the JWT server-side. This keeps the auth token out of
 * the browser and leverages the existing proxy route handler.
 *
 * The base URL points to the Next.js origin so the proxy route handles
 * forwarding to the actual NestJS backend.
 *
 * @example
 * const api = createApiClient();
 *
 * // Create a book
 * const { status, body } = await api.books.create({
 *   body: { title: "The Great Gatsby", language: "en" },
 * });
 *
 * // Update a copy's status
 * const { status, body } = await api.copies.updateStatus({
 *   params: { id: "some-uuid" },
 *   body: { status: "sold", counterpartyType: "external", externalCounterpartyName: "Neighborhood swap" },
 * });
 */
export function createApiClient() {
  return initClient(apiContract, {
    baseUrl: "",
    baseHeaders: {
      "Content-Type": "application/json",
    },
  });
}

/**
 * Pre-initialized API client instance.
 * Import this directly for convenience in most cases.
 */
export const api = createApiClient();
