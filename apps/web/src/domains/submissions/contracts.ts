import { initContract } from "@ts-rest/core";

const c = initContract();

// ─── Submissions ─────────────────────────────────────────────

export interface CreateCopySubmissionBody {
  title: string;
  authors: string[];
  isbn?: string;
  language?: string;
  bookDescriptionNotes?: string;
  condition?: string;
  shareType?: string;
  notes?: string;
  contactNote?: string;
  imageUrls?: string[];
}

export interface CreateMissingWantSubmissionBody {
  title: string;
  authors: string[];
  isbn?: string;
  language?: string;
  bookDescriptionNotes?: string;
  wantNotes?: string;
}

export interface SubmissionResponse {
  submitted: true;
}

export const submissionsContract = c.router({
  submitCopy: {
    method: "POST",
    path: "/api/nestjs/submissions/copy",
    body: c.type<CreateCopySubmissionBody>(),
    responses: { 201: c.type<SubmissionResponse>() },
  },
  submitMissingWant: {
    method: "POST",
    path: "/api/nestjs/submissions/want-missing",
    body: c.type<CreateMissingWantSubmissionBody>(),
    responses: { 201: c.type<SubmissionResponse>() },
  },
});
