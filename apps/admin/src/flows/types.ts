import type { CopySubmissionRecord, StaffDirectoryEntry, WantSubmissionRecord, PgBookWithAuthorsView } from "@/shared/api";
import type { CatalogEditionRecord, CatalogCopyRecord, CatalogWishRecord } from "@/domain/catalog/queries";

export type AdminFlow =
  | { kind: "add-edition" }
  | { kind: "catalog-search" }
  | { kind: "import-batch" }
  | { kind: "add-team-member"; actorRoles: string[] }
  | { kind: "manage-team-member"; actorRoles: string[]; entry: StaffDirectoryEntry }
  | { kind: "review-copy-submission"; submission: CopySubmissionRecord }
  | { kind: "review-want-submission"; submission: WantSubmissionRecord }
  | { kind: "edit-book"; book: PgBookWithAuthorsView }
  | { kind: "edit-edition"; edition: CatalogEditionRecord }
  | { kind: "edit-copy"; copy: CatalogCopyRecord }
  | { kind: "edit-wish"; wish: CatalogWishRecord };
