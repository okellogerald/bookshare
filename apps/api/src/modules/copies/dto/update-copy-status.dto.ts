import { IsString, IsOptional, IsEnum } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { CopyStatus, GoneReason } from "@bookshare/shared";

export class UpdateCopyStatusDto {
  @ApiProperty({
    enum: Object.values(CopyStatus),
  })
  @IsEnum(CopyStatus)
  status!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description:
      "Required when status=gone to record why the copy left the library",
    enum: Object.values(GoneReason),
  })
  @IsOptional()
  @IsEnum(GoneReason)
  goneReason?: string;

  @ApiPropertyOptional({
    description:
      "Optional for lent or gone when you want to record who received the copy",
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
