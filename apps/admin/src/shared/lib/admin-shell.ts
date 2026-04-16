import {
  BookCopy,
  FolderKanban,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface AdminNavChildItem {
  href: string;
  label: string;
}

export interface AdminNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  description?: string;
  children?: AdminNavChildItem[];
}

export interface AdminPageMeta {
  section: string;
  title: string;
}

export const adminNavItems: AdminNavItem[] = [
  {
    href: "/catalog",
    label: "Catalog",
    icon: BookCopy,
    description: "Work through catalog operations, edition flows, copies, wishes, and intake queues.",
  },
  {
    href: "/batches",
    label: "Imports",
    icon: FolderKanban,
    description: "Run batch imports, validate issues, and review recent import history.",
  },
  {
    href: "/members",
    label: "Members",
    icon: Users,
    description: "Search and manage community members from a dedicated operational directory.",
  },
];

const adminPageMetaByPath: Record<string, AdminPageMeta> = {
  "/catalog": {
    section: "Catalog",
    title: "Catalog",
  },
  "/batches": {
    section: "Imports",
    title: "Imports",
  },
  "/batches/runs": {
    section: "Imports",
    title: "Recent runs",
  },
  "/members": {
    section: "Members",
    title: "Members",
  },
  "/team": {
    section: "Team",
    title: "Team Management",
  },
  "/profile": {
    section: "Account",
    title: "Profile",
  },
};

export function isActiveAdminPath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function getAdminPageMeta(pathname: string): AdminPageMeta {
  const exactMatch = adminPageMetaByPath[pathname];
  if (exactMatch) {
    return exactMatch;
  }

  const match = adminNavItems.find((item) => isActiveAdminPath(pathname, item.href));
  return adminPageMetaByPath[match?.href ?? "/catalog"];
}
