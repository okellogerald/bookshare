import {
  ALL_AUTHORIZATION_PERMISSIONS,
  AuthorizationScopeType,
  PLATFORM_SCOPE_ID,
  type AuthorizationPermission,
} from "@bookshare/shared";
import {
  IsIn,
  IsNotEmpty,
  IsString,
  ValidateIf,
} from "class-validator";

export class ManagePermissionGrantDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsIn(ALL_AUTHORIZATION_PERMISSIONS)
  permission!: AuthorizationPermission;

  @IsIn(Object.values(AuthorizationScopeType))
  scopeType!: typeof AuthorizationScopeType[keyof typeof AuthorizationScopeType];

  @ValidateIf((value: ManagePermissionGrantDto) => value.scopeType === AuthorizationScopeType.BOOKSTORE)
  @IsString()
  @IsNotEmpty()
  scopeId?: string;
}

export function normalizePermissionScopeId(dto: ManagePermissionGrantDto) {
  if (dto.scopeType === AuthorizationScopeType.PLATFORM) {
    return PLATFORM_SCOPE_ID;
  }

  return dto.scopeId!;
}
