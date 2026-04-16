import type { CopySubmissionRecord, StaffDirectoryEntry } from "@/shared/api";

export type AdminFlow =
  | { kind: "add-edition" }
  | { kind: "catalog-search" }
  | { kind: "import-batch" }
  | { kind: "add-team-member"; actorRoles: string[] }
  | { kind: "manage-team-member"; actorRoles: string[]; entry: StaffDirectoryEntry }
  | { kind: "review-copy-submission"; submission: CopySubmissionRecord };
