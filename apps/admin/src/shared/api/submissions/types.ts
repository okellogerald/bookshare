export interface CopySubmissionRecord {
  id: string;
  userId: string;
  userEmail: string | null;
  status: "pending" | "approved" | "rejected";
  title: string;
  subtitle: string | null;
  authors: string[];
  isbn: string | null;
  language: string | null;
  bookDescriptionNotes: string | null;
  condition: string | null;
  shareType: string | null;
  notes: string | null;
  contactNote: string | null;
  reviewerUsername: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  resolvedEditionId: string | null;
  resolvedCopyId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApproveCopySubmissionInput {
  editionId: string;
  condition?: string;
  shareType?: string;
  notes?: string;
  contactNote?: string;
  reviewNotes?: string;
}

export interface RejectCopySubmissionInput {
  reviewNotes?: string;
}

export interface ApproveCopySubmissionResult {
  approved: true;
  copyId: string;
  editionId: string;
}

export interface RejectCopySubmissionResult {
  rejected: true;
}
