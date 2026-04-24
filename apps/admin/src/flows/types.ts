import type { AdminBookstoreDetail } from "@bookshare/shared";
import type { CopySubmissionRecord, StaffDirectoryEntry, WantSubmissionRecord, PgBookWithAuthorsView } from "@/shared/api";
import type { CatalogEditionRecord, CatalogCopyRecord, CatalogWishRecord } from "@/domain/catalog/queries";

export type AdminFlow =
  | { kind: "add-edition" }
  | { kind: "add-title" }
  | { kind: "add-copy" }
  | { kind: "add-wish" }
  | { kind: "create-bookstore" }
  | { kind: "edit-bookstore"; bookstore: AdminBookstoreDetail }
  | { kind: "catalog-search" }
  | { kind: "import-batch" }
  | { kind: "add-team-member"; actorRoles: string[]; actorUserId: string }
  | { kind: "manage-team-member"; actorRoles: string[]; actorUserId: string; entry: StaffDirectoryEntry }
  | { kind: "review-copy-submission"; submission: CopySubmissionRecord }
  | { kind: "review-want-submission"; submission: WantSubmissionRecord }
  | { kind: "edit-book"; book: PgBookWithAuthorsView }
  | { kind: "edit-edition"; edition: CatalogEditionRecord }
  | { kind: "edit-copy"; copy: CatalogCopyRecord }
  | { kind: "edit-wish"; wish: CatalogWishRecord };
