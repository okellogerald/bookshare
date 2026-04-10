export interface StaffRoleAssignment {
  role: string;
  grantedBy: string | null;
  createdAt: string;
}

export interface StaffDirectoryEntry {
  userId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string;
  emailVerified: boolean;
  state: string | null;
  roles: StaffRoleAssignment[];
}

export interface StaffIdentitySearchResult {
  userId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string;
  emailVerified: boolean;
  state: string | null;
  existingRoles: string[];
}
