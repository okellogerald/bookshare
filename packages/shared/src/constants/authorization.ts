import {
  BookstoreMembershipRole,
  PlatformRole,
} from "./enums";

export const AuthorizationSurface = {
  WEB_PUBLIC: "web_public",
  WEB_MEMBER: "web_member",
  ADMIN_CONSOLE: "admin_console",
  BOOKSTORE_PORTAL: "bookstore_portal",
} as const;

export type AuthorizationSurface =
  (typeof AuthorizationSurface)[keyof typeof AuthorizationSurface];

export const AuthorizationScopeType = {
  PLATFORM: "platform",
  BOOKSTORE: "bookstore",
} as const;

export type AuthorizationScopeType =
  (typeof AuthorizationScopeType)[keyof typeof AuthorizationScopeType];

export const AuthorizationPermission = {
  CONSOLE_ACCESS: "console.access",
  MEMBER_DIRECTORY_READ: "member.directory.read",
  IDENTITY_PASSWORD_RESET: "identity.password.reset",
  IDENTITY_SESSIONS_REVOKE: "identity.sessions.revoke",
  IDENTITY_VERIFICATION_REQUIRE: "identity.verification.require",
  IDENTITY_ACCOUNT_DEACTIVATE: "identity.account.deactivate",
  IDENTITY_ACCOUNT_REACTIVATE: "identity.account.reactivate",
  STAFF_DIRECTORY_READ: "staff.directory.read",
  STAFF_ROLE_MANAGE: "staff.role.manage",
  STAFF_PERMISSION_MANAGE: "staff.permission.manage",
  CATALOG_READ: "catalog.read",
  CATALOG_WRITE: "catalog.write",
  CATALOG_ARCHIVE: "catalog.archive",
  SUBMISSION_READ: "submission.read",
  SUBMISSION_REVIEW: "submission.review",
  IMPORT_READ: "import.read",
  IMPORT_VALIDATE: "import.validate",
  IMPORT_COMMIT: "import.commit",
  BOOKSTORE_DIRECTORY_READ: "bookstore.directory.read",
  BOOKSTORE_STATUS_MANAGE: "bookstore.status.manage",
  BOOKSTORE_OWNER_MANAGE: "bookstore.owner.manage",
  BOOKSTORE_READ: "bookstore.read",
  BOOKSTORE_UPDATE: "bookstore.update",
  BOOKSTORE_WANT_READ: "bookstore.want.read",
  BOOKSTORE_PROPOSAL_CREATE: "bookstore.proposal.create",
  BOOKSTORE_PROPOSAL_WITHDRAW: "bookstore.proposal.withdraw",
  BOOKSTORE_MEMBER_READ: "bookstore.member.read",
  BOOKSTORE_INVITE_MANAGE: "bookstore.invite.manage",
  BOOKSTORE_MEMBER_ROLE_MANAGE: "bookstore.member.role.manage",
  BOOKSTORE_MEMBER_SUSPEND: "bookstore.member.suspend",
  BOOKSTORE_MEMBER_RESTORE: "bookstore.member.restore",
  BOOKSTORE_MEMBER_REMOVE: "bookstore.member.remove",
  BOOKSTORE_SECURITY_ESCALATE: "bookstore.security.escalate",
} as const;

export type AuthorizationPermission =
  (typeof AuthorizationPermission)[keyof typeof AuthorizationPermission];

export const ALL_AUTHORIZATION_PERMISSIONS = Object.values(
  AuthorizationPermission
) as AuthorizationPermission[];

export const PlatformAuthorizationRole = {
  PLATFORM_ADMIN: PlatformRole.PLATFORM_ADMIN,
  PLATFORM_STAFF: PlatformRole.PLATFORM_STAFF,
} as const;

export type PlatformAuthorizationRole =
  (typeof PlatformAuthorizationRole)[keyof typeof PlatformAuthorizationRole];

export const BookstoreAuthorizationRole = {
  BOOKSTORE_ADMIN: "bookstore_admin",
  BOOKSTORE_MEMBER: "bookstore_member",
} as const;

export type BookstoreAuthorizationRole =
  (typeof BookstoreAuthorizationRole)[keyof typeof BookstoreAuthorizationRole];

export const ALL_AUTHORIZATION_ROLES = [
  ...Object.values(PlatformAuthorizationRole),
  ...Object.values(BookstoreAuthorizationRole),
] as const;

export type AuthorizationRole =
  (typeof ALL_AUTHORIZATION_ROLES)[number];

export interface AuthorizationGrant {
  permission: AuthorizationPermission;
  scopeType: AuthorizationScopeType;
  scopeId: string;
}

export interface EffectiveAuthorizationGrant extends AuthorizationGrant {
  source: "role" | "direct";
  role?: AuthorizationRole;
}

export const PLATFORM_SCOPE_ID = "platform";

export function createPlatformScope() {
  return {
    scopeType: AuthorizationScopeType.PLATFORM,
    scopeId: PLATFORM_SCOPE_ID,
  } as const;
}

export function createBookstoreScope(bookstoreId: string) {
  return {
    scopeType: AuthorizationScopeType.BOOKSTORE,
    scopeId: bookstoreId,
  } as const;
}

export function getPlatformRolePermissionBundle(
  role: PlatformAuthorizationRole
): AuthorizationPermission[] {
  if (role === PlatformAuthorizationRole.PLATFORM_ADMIN) {
    return [...ALL_AUTHORIZATION_PERMISSIONS];
  }

  return [
    AuthorizationPermission.CONSOLE_ACCESS,
    AuthorizationPermission.MEMBER_DIRECTORY_READ,
    AuthorizationPermission.STAFF_DIRECTORY_READ,
    AuthorizationPermission.CATALOG_READ,
    AuthorizationPermission.CATALOG_WRITE,
    AuthorizationPermission.SUBMISSION_READ,
    AuthorizationPermission.SUBMISSION_REVIEW,
    AuthorizationPermission.IMPORT_READ,
    AuthorizationPermission.IMPORT_VALIDATE,
    AuthorizationPermission.BOOKSTORE_DIRECTORY_READ,
    AuthorizationPermission.BOOKSTORE_READ,
    AuthorizationPermission.BOOKSTORE_UPDATE,
    AuthorizationPermission.BOOKSTORE_MEMBER_READ,
    AuthorizationPermission.BOOKSTORE_STATUS_MANAGE,
  ];
}

export const BOOKSTORE_GRANTABLE_PERMISSIONS: AuthorizationPermission[] = [
  AuthorizationPermission.BOOKSTORE_UPDATE,
  AuthorizationPermission.BOOKSTORE_INVITE_MANAGE,
  AuthorizationPermission.BOOKSTORE_MEMBER_ROLE_MANAGE,
  AuthorizationPermission.BOOKSTORE_MEMBER_SUSPEND,
  AuthorizationPermission.BOOKSTORE_MEMBER_RESTORE,
  AuthorizationPermission.BOOKSTORE_MEMBER_REMOVE,
];

export function isBookstoreGrantablePermission(
  permission: string
): permission is AuthorizationPermission {
  return BOOKSTORE_GRANTABLE_PERMISSIONS.includes(
    permission as AuthorizationPermission
  );
}

export function getBookstoreRolePermissionBundle(
  role: BookstoreAuthorizationRole
): AuthorizationPermission[] {
  if (role === BookstoreAuthorizationRole.BOOKSTORE_ADMIN) {
    return [
      AuthorizationPermission.BOOKSTORE_READ,
      AuthorizationPermission.BOOKSTORE_UPDATE,
      AuthorizationPermission.BOOKSTORE_WANT_READ,
      AuthorizationPermission.BOOKSTORE_PROPOSAL_CREATE,
      AuthorizationPermission.BOOKSTORE_PROPOSAL_WITHDRAW,
      AuthorizationPermission.BOOKSTORE_MEMBER_READ,
      AuthorizationPermission.BOOKSTORE_INVITE_MANAGE,
      AuthorizationPermission.BOOKSTORE_MEMBER_ROLE_MANAGE,
      AuthorizationPermission.BOOKSTORE_MEMBER_SUSPEND,
      AuthorizationPermission.BOOKSTORE_MEMBER_RESTORE,
      AuthorizationPermission.BOOKSTORE_MEMBER_REMOVE,
      AuthorizationPermission.BOOKSTORE_SECURITY_ESCALATE,
    ];
  }

  return [
    AuthorizationPermission.BOOKSTORE_READ,
    AuthorizationPermission.BOOKSTORE_WANT_READ,
    AuthorizationPermission.BOOKSTORE_PROPOSAL_CREATE,
    AuthorizationPermission.BOOKSTORE_PROPOSAL_WITHDRAW,
  ];
}

export function isAuthorizationPermission(
  value: string
): value is AuthorizationPermission {
  return ALL_AUTHORIZATION_PERMISSIONS.includes(
    value as AuthorizationPermission
  );
}

export function isPlatformAuthorizationRole(
  value: string
): value is PlatformAuthorizationRole {
  return Object.values(PlatformAuthorizationRole).includes(
    value as PlatformAuthorizationRole
  );
}

export function mapBookstoreMembershipRoleToAuthorizationRole(
  role: string
): BookstoreAuthorizationRole | null {
  if (role === BookstoreMembershipRole.OWNER) {
    return BookstoreAuthorizationRole.BOOKSTORE_ADMIN;
  }
  if (role === BookstoreMembershipRole.MEMBER) {
    return BookstoreAuthorizationRole.BOOKSTORE_MEMBER;
  }
  return null;
}
