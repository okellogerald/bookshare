export type OrganizationRole = "admin" | "staff";
export type OrganizationStatus = "active" | "suspended";

export interface OrganizationSummary {
  id: string;
  name: string;
  status: OrganizationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationDetail extends OrganizationSummary {
  createdBy: string;
  myRole: OrganizationRole;
  canManageMembers: boolean;
  memberCount: number;
}

export interface OrganizationMembership {
  organizationId: string;
  role: OrganizationRole;
  joinedAt: string;
  organization: OrganizationSummary;
}

export interface PendingOrganizationInvite {
  id: string;
  invitedEmail: string;
  role: OrganizationRole;
  createdAt: string;
  organization: OrganizationSummary;
}

export interface OrganizationsMeResponse {
  memberships: OrganizationMembership[];
  pendingInvites: PendingOrganizationInvite[];
  user: {
    id: string;
    email: string | null;
    emailVerified: boolean;
    roles: string[];
  };
}

export interface OrganizationMember {
  userId: string;
  role: OrganizationRole;
  joinedAt: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string;
}

export interface OrganizationMembersResponse {
  members: OrganizationMember[];
  pendingInvites: Array<{
    id: string;
    invitedEmail: string;
    role: OrganizationRole;
    createdAt: string;
  }>;
}

export interface AdminOrganizationSummary extends OrganizationSummary {
  memberCount: number;
  adminCount: number;
  adminNames: string[];
  pendingInviteCount: number;
}
