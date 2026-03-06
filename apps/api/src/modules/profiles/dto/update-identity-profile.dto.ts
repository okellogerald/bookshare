import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export const zitadelGenderValues = [
  "GENDER_UNSPECIFIED",
  "GENDER_FEMALE",
  "GENDER_MALE",
  "GENDER_DIVERSE",
] as const;

export type ZitadelGenderValue = (typeof zitadelGenderValues)[number];

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  displayName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  nickname?: string;

  @ApiPropertyOptional({
    enum: zitadelGenderValues,
  })
  @IsOptional()
  @IsString()
  @IsIn(zitadelGenderValues)
  gender?: ZitadelGenderValue;
}
