import type {
  StaffDirectoryEntry,
  StaffIdentitySearchResult,
} from "@/shared/api";

export const ROLE_ORDER = ["owner", "manager", "staff", "viewer"] as const;

export function formatRole(role: string) {
  return role.charAt(0).toUpperCase() + role.slice(1).replace(/_/g, " ");
}

export function canManageRole(actorRoles: string[], targetRole: string) {
  if (actorRoles.includes("owner")) {
    return true;
  }

  return actorRoles.includes("manager") && ["staff", "viewer"].includes(targetRole);
}

export function getManageableRoles(actorRoles: string[]) {
  if (actorRoles.includes("owner")) {
    return [...ROLE_ORDER];
  }

  if (actorRoles.includes("manager")) {
    return ["staff", "viewer"] as const;
  }

  return [] as const;
}

export function formatIdentitySubtitle(
  entry: Pick<StaffDirectoryEntry | StaffIdentitySearchResult, "email" | "userId">
) {
  return entry.email || entry.userId;
}
