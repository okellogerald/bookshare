import { IsString, IsOptional, IsEnum } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateCopyStatusDto {
  @ApiProperty({
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
  })
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

  @ApiPropertyOptional({
    description:
      "Required for lent/sold/given_away to identify the receiving community member",
  })
  @IsOptional()
  @IsString()
  counterpartyUserId?: string;
}
