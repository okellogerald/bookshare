import { IsEmail, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateOrganizationDto {
  @IsString()
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsEmail()
  adminEmail?: string;
}
