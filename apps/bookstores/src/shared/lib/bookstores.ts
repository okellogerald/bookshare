import {
  BookstoreMembershipRole,
  BookstoreStatus,
  type BookstoreSummary,
} from "@bookshare/shared";

const LAST_USED_BOOKSTORE_KEY = "bookshare.bookstores.last-bookstore-id";

export function getBookstoreStatusLabel(status: BookstoreStatus) {
  switch (status) {
    case BookstoreStatus.PENDING:
      return "Pending review";
    case BookstoreStatus.APPROVED:
      return "Approved";
    case BookstoreStatus.REJECTED:
      return "Needs changes";
    case BookstoreStatus.SUSPENDED:
      return "Suspended";
    default:
      return status;
  }
}

export function getBookstoreStatusTone(status: BookstoreStatus) {
  switch (status) {
    case BookstoreStatus.APPROVED:
      return "default" as const;
    case BookstoreStatus.PENDING:
      return "secondary" as const;
    case BookstoreStatus.REJECTED:
    case BookstoreStatus.SUSPENDED:
      return "outline" as const;
    default:
      return "secondary" as const;
  }
}

export function getBookstorePrimaryRoute(bookstore: Pick<BookstoreSummary, "id" | "status">) {
  return bookstore.status === BookstoreStatus.APPROVED
    ? `/orgs/${bookstore.id}/wants`
    : `/orgs/${bookstore.id}/settings`;
}

export function getMembershipRoleLabel(role: BookstoreMembershipRole) {
  return role === BookstoreMembershipRole.OWNER ? "Owner" : "Member";
}

export function setLastUsedBookstoreId(bookstoreId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LAST_USED_BOOKSTORE_KEY, bookstoreId);
}

export function getLastUsedBookstoreId() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(LAST_USED_BOOKSTORE_KEY);
}
