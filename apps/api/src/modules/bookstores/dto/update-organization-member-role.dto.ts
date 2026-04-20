import { ApiProperty } from "@nestjs/swagger";
import { IsIn } from "class-validator";

export class UpdateOrganizationMemberRoleDto {
  @ApiProperty({ enum: ["owner", "member"] })
  @IsIn(["owner", "member"])
  role!: "owner" | "member";
}
