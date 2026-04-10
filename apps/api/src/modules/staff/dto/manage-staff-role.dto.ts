import { UserRole } from "@bookshare/shared";
import { IsEnum, IsNotEmpty, IsString } from "class-validator";

export class ManageStaffRoleDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsEnum(UserRole)
  role!: (typeof UserRole)[keyof typeof UserRole];
}
