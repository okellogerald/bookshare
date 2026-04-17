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

export interface WantSubmissionRecord {
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
  wantNotes: string | null;
  reviewerUsername: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  resolvedBookId: string | null;
  resolvedWishId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApproveWantSubmissionInput {
  bookId: string;
  editionId?: string;
  wantNotes?: string;
  reviewNotes?: string;
}

export interface RejectWantSubmissionInput {
  reviewNotes?: string;
}

export interface ApproveWantSubmissionResult {
  approved: true;
  wishId: string;
  bookId: string;
}

export interface RejectWantSubmissionResult {
  rejected: true;
}
