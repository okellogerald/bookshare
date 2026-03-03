import { IsString, IsOptional, IsEnum } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateCopyStatusDto {
  @ApiProperty({
    enum: [
      "available",
      "reserved",
      "rented",
      "checked_out",
      "sold",
      "donated",
      "given_away",
      "lost",
      "damaged",
    ],
  })
  @IsEnum([
    "available",
    "reserved",
    "rented",
    "checked_out",
    "sold",
    "donated",
    "given_away",
    "lost",
    "damaged",
  ])
  status!: string;

  @ApiPropertyOptional({ description: "Amount for financial events (e.g. sale price)" })
  @IsOptional()
  @IsString()
  amount?: string;

  @ApiPropertyOptional({ description: "Currency code (ISO 4217)", example: "USD" })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
