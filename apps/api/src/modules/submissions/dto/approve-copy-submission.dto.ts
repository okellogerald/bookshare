import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ApproveCopySubmissionDto {
  @ApiProperty({ description: "The catalog edition to link this copy to." })
  @IsUUID()
  editionId!: string;

  @ApiPropertyOptional({
    enum: ["new", "like_new", "good", "fair", "poor"],
  })
  @IsOptional()
  @IsEnum(["new", "like_new", "good", "fair", "poor"])
  condition?: string;

  @ApiPropertyOptional({
    enum: ["lend", "sell", "give_away"],
  })
  @IsOptional()
  @IsEnum(["lend", "sell", "give_away"])
  shareType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactNote?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reviewNotes?: string;
}
