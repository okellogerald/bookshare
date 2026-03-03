import { IsString, IsOptional, IsEnum } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateCopyDto {
  @ApiPropertyOptional({
    enum: ["new", "like_new", "good", "fair", "poor"],
  })
  @IsOptional()
  @IsEnum(["new", "like_new", "good", "fair", "poor"])
  condition?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  location?: string;

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
