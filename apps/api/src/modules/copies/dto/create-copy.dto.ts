import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { CopyStatus } from "@bookshare/shared";

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
    enum: Object.values(CopyStatus),
    default: "available",
  })
  @IsOptional()
  @IsEnum(CopyStatus)
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ enum: ["lend", "sell", "give_away"] })
  @IsOptional()
  @IsEnum(["lend", "sell", "give_away"])
  shareType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactNote?: string;
}
