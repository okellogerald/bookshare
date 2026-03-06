import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

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
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: "username can only contain letters, numbers, and underscores",
  })
  username?: string;

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
    enum: zitadelGenderValues,
  })
  @IsOptional()
  @IsString()
  @IsIn(zitadelGenderValues)
  gender?: ZitadelGenderValue;
}
