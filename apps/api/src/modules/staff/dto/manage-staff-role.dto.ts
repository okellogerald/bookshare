import { PlatformRole } from "@bookshare/shared";
import { IsIn, IsNotEmpty, IsString } from "class-validator";

export class ManageStaffRoleDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsIn([PlatformRole.PLATFORM_ADMIN, PlatformRole.PLATFORM_STAFF])
  role!:
    | typeof PlatformRole.PLATFORM_ADMIN
    | typeof PlatformRole.PLATFORM_STAFF;
}
