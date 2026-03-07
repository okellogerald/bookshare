"use client";

import { useMutation } from "@tanstack/react-query";
import type {
  CopyImagePresignBody,
  CopyImagePresignResponse,
  CreateCopySubmissionBody,
  CreateMissingWantSubmissionBody,
  SubmissionResponse,
} from "@/shared/api";
import { nestjsFetch } from "./fetch";

export function useCreateSubmissionCopyImagePresign() {
  return useMutation({
    mutationFn: (body: CopyImagePresignBody) =>
      nestjsFetch<CopyImagePresignResponse>(
        "upload/submission-copy-image-presign",
        "POST",
        body
      ),
  });
}

export function useSubmitCopyRequest() {
  return useMutation({
    mutationFn: (body: CreateCopySubmissionBody) =>
      nestjsFetch<SubmissionResponse>("submissions/copy", "POST", body),
  });
}

export function useSubmitMissingWantRequest() {
  return useMutation({
    mutationFn: (body: CreateMissingWantSubmissionBody) =>
      nestjsFetch<SubmissionResponse>(
        "submissions/want-missing",
        "POST",
        body
      ),
  });
}
