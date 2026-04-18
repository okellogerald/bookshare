import type {
  StaffDirectoryEntry,
  StaffIdentitySearchResult,
} from "@/shared/api";
import { PlatformRole } from "@bookshare/shared";

export const ROLE_ORDER = [
  PlatformRole.PLATFORM_ADMIN,
  PlatformRole.PLATFORM_STAFF,
] as const;

export function formatRole(role: string) {
  return role.charAt(0).toUpperCase() + role.slice(1).replace(/_/g, " ");
}

export function canManageRole(actorRoles: string[], targetRole: string) {
  return (
    actorRoles.includes(PlatformRole.PLATFORM_ADMIN) &&
    ROLE_ORDER.includes(targetRole as (typeof ROLE_ORDER)[number])
  );
}

export function getManageableRoles(actorRoles: string[]) {
  if (actorRoles.includes(PlatformRole.PLATFORM_ADMIN)) {
    return [...ROLE_ORDER];
  }

  return [] as const;
}

export function formatIdentitySubtitle(
  entry: Pick<StaffDirectoryEntry | StaffIdentitySearchResult, "email" | "userId">
) {
  return entry.email || entry.userId;
}
