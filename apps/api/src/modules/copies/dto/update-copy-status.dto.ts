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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description:
      "Required for lent/rented/checked_out/sold/given_away",
    enum: ["member", "external"],
  })
  @IsOptional()
  @IsEnum(["member", "external"])
  counterpartyType?: string;

  @ApiPropertyOptional({
    description:
      "Required when counterpartyType=member",
  })
  @IsOptional()
  @IsString()
  counterpartyUserId?: string;

  @ApiPropertyOptional({
    description:
      "Required when counterpartyType=external",
  })
  @IsOptional()
  @IsString()
  externalCounterpartyName?: string;

  @ApiPropertyOptional({
    description:
      "Optional contact detail when counterpartyType=external",
  })
  @IsOptional()
  @IsString()
  externalCounterpartyContact?: string;
}
