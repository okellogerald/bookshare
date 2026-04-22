import {
  BookstoreMembershipRole,
  BookstoreStatus,
  type BookstoreSummary,
} from "@bookshare/shared";

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
    : `/orgs/${bookstore.id}/profile`;
}

export function getMembershipRoleLabel(role: BookstoreMembershipRole) {
  return role === BookstoreMembershipRole.OWNER ? "Owner" : "Member";
}

export async function setActiveBookstoreId(bookstoreId: string) {
  await fetch("/api/session/active-org", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ organizationId: bookstoreId }),
  });
}

export async function getActiveBookstoreId() {
  const response = await fetch("/api/session/active-org", {
    cache: "no-store",
  });

  if (!response.ok) return null;

  const payload = (await response.json()) as { organizationId?: unknown };
  return typeof payload.organizationId === "string"
    ? payload.organizationId
    : null;
}
