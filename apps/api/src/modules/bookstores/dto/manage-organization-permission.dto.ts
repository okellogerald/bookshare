import { ApiProperty } from "@nestjs/swagger";
import {
  BOOKSTORE_GRANTABLE_PERMISSIONS,
  type AuthorizationPermission,
} from "@bookshare/shared";
import { IsIn } from "class-validator";

export class ManageOrganizationPermissionDto {
  @ApiProperty({ enum: BOOKSTORE_GRANTABLE_PERMISSIONS })
  @IsIn(BOOKSTORE_GRANTABLE_PERMISSIONS)
  permission!: AuthorizationPermission;
}
