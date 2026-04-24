import { SetMetadata } from "@nestjs/common";
import type { AuthorizationPermission } from "@bookshare/shared";

export const PERMISSIONS_KEY = "permissions";
export const Permissions = (...permissions: AuthorizationPermission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
