import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  IsDateString,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateCopyDto {
  @ApiProperty()
  @IsUUID()
  editionId!: string;

  @ApiProperty({
    enum: ["new", "like_new", "good", "fair", "poor"],
  })
  @IsEnum(["new", "like_new", "good", "fair", "poor"])
  condition!: string;

  @ApiPropertyOptional({
    enum: [
      "available",
      "reserved",
      "lent",
      "rented",
      "checked_out",
      "sold",
      "donated",
      "given_away",
      "lost",
      "damaged",
    ],
    default: "available",
  })
  @IsOptional()
  @IsEnum([
    "available",
    "reserved",
    "lent",
    "rented",
    "checked_out",
    "sold",
    "donated",
    "given_away",
    "lost",
    "damaged",
  ])
  status?: string;

  @ApiProperty({
    enum: ["purchased", "donated", "consigned", "other"],
  })
  @IsEnum(["purchased", "donated", "consigned", "other"])
  acquisitionType!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  acquisitionDate?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: "Acquisition cost for the initial event" })
  @IsOptional()
  @IsString()
  acquisitionAmount?: string;

  @ApiPropertyOptional({ description: "Currency code (ISO 4217)", example: "USD" })
  @IsOptional()
  @IsString()
  acquisitionCurrency?: string;

  @ApiPropertyOptional({ enum: ["lend", "sell", "give_away"] })
  @IsOptional()
  @IsEnum(["lend", "sell", "give_away"])
  shareType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactNote?: string;
}
