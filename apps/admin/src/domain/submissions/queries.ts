"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ApproveCopySubmissionInput,
  ApproveCopySubmissionResult,
  ApproveWantSubmissionInput,
  ApproveWantSubmissionResult,
  CopySubmissionRecord,
  RejectCopySubmissionInput,
  RejectCopySubmissionResult,
  RejectWantSubmissionInput,
  RejectWantSubmissionResult,
  WantSubmissionRecord,
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

    throw new Error(getErrorMessage(payload, "Submission request failed."));
  }

  return (await response.json()) as T;
}

export function useCopySubmissions(status?: string) {
  const queryString = status ? `?status=${status}` : "";

  return useQuery({
    queryKey: ["admin-copy-submissions", status ?? "all"],
    queryFn: () =>
      requestJson<CopySubmissionRecord[]>(
        `/api/backend/submissions/copies${queryString}`
      ),
  });
}

export function useCopySubmission(id: string | null) {
  return useQuery({
    queryKey: ["admin-copy-submission", id],
    queryFn: () =>
      requestJson<CopySubmissionRecord>(
        `/api/backend/submissions/copies/${id}`
      ),
    enabled: !!id,
  });
}

export function useApproveCopySubmission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: ApproveCopySubmissionInput & { id: string }) =>
      requestJson<ApproveCopySubmissionResult>(
        `/api/backend/submissions/copies/${id}/approve`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["admin-copy-submissions"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["admin-copy-submission"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["admin-catalog-summary-counts"],
      });
    },
  });
}

export function useRejectCopySubmission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: RejectCopySubmissionInput & { id: string }) =>
      requestJson<RejectCopySubmissionResult>(
        `/api/backend/submissions/copies/${id}/reject`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["admin-copy-submissions"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["admin-copy-submission"],
      });
    },
  });
}

// ── Want Submissions ───────────────────────────────────────────

export function useWantSubmissions(status?: string) {
  const queryString = status ? `?status=${status}` : "";

  return useQuery({
    queryKey: ["admin-want-submissions", status ?? "all"],
    queryFn: () =>
      requestJson<WantSubmissionRecord[]>(
        `/api/backend/submissions/wants${queryString}`
      ),
  });
}

export function useWantSubmission(id: string | null) {
  return useQuery({
    queryKey: ["admin-want-submission", id],
    queryFn: () =>
      requestJson<WantSubmissionRecord>(
        `/api/backend/submissions/wants/${id}`
      ),
    enabled: !!id,
  });
}

export function useApproveWantSubmission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: ApproveWantSubmissionInput & { id: string }) =>
      requestJson<ApproveWantSubmissionResult>(
        `/api/backend/submissions/wants/${id}/approve`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["admin-want-submissions"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["admin-want-submission"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["admin-catalog-summary-counts"],
      });
    },
  });
}

export function useRejectWantSubmission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: RejectWantSubmissionInput & { id: string }) =>
      requestJson<RejectWantSubmissionResult>(
        `/api/backend/submissions/wants/${id}/reject`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["admin-want-submissions"],
      });
      void queryClient.invalidateQueries({
        queryKey: ["admin-want-submission"],
      });
    },
  });
}
