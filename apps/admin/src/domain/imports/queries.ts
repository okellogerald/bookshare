"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CommitImportRunResult,
  ImportRunRecord,
  ImportRunValidationResult,
} from "@/shared/api";

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
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      payload = await response.text();
    }

    throw new Error(getErrorMessage(payload, "Batch request failed."));
  }

  return (await response.json()) as T;
}

export function useRecentImportRuns(limit = 8) {
  return useQuery({
    queryKey: ["admin-import-runs", limit],
    queryFn: () => requestJson<ImportRunRecord[]>(`/api/backend/imports?limit=${limit}`),
  });
}

export function useValidateImportZip() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      file: File;
      mode: "catalog" | "inventory_only";
      replaceInventory: boolean;
    }) => {
      const formData = new FormData();
      formData.set("zip", params.file);
      formData.set("mode", params.mode);
      formData.set("replaceInventory", String(params.replaceInventory));

      return requestJson<ImportRunValidationResult>("/api/backend/imports/validate", {
        method: "POST",
        body: formData,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-import-runs"] });
    },
  });
}

export function useCommitImportRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (runId: string) =>
      requestJson<CommitImportRunResult>(`/api/backend/imports/${runId}/commit`, {
        method: "POST",
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-import-runs"] });
    },
  });
}
