import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateAdminBookstoreOwnerDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  ownerEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  ownerFirstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  ownerLastName?: string;
}
