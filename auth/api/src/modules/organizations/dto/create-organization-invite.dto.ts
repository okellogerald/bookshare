import { IsEmail, IsIn, IsOptional } from "class-validator";

export class CreateOrganizationInviteDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsIn(["admin", "staff"])
  role?: "admin" | "staff";
}
