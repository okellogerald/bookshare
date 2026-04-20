import {
  BookCopy,
  Building2,
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
  {
    href: "/bookstores",
    label: "Bookstores",
    icon: Building2,
    description: "Review bookstore organizations, approve access, and inspect current operators.",
  },
];

export function isActiveAdminPath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
