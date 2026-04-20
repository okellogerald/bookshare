import { ApiProperty } from "@nestjs/swagger";
import { IsEmail } from "class-validator";

export class CreateOrganizationInviteDto {
  @ApiProperty()
  @IsEmail()
  email!: string;
}
