import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export const identityGenderValues = [
  "GENDER_UNSPECIFIED",
  "GENDER_FEMALE",
  "GENDER_MALE",
] as const;

export type IdentityGenderValue = (typeof identityGenderValues)[number];

export class UpdateIdentityProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  lastName?: string;

  @ApiPropertyOptional({
    enum: identityGenderValues,
  })
  @IsOptional()
  @IsString()
  @IsIn(identityGenderValues)
  gender?: IdentityGenderValue;
}
