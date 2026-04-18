import { IsString, IsOptional, IsEnum, IsUUID } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class AdminCreateCopyDto {
  @ApiProperty({ description: "The user ID of the member this copy is created on behalf of" })
  @IsUUID()
  userId!: string;

  @ApiProperty()
  @IsUUID()
  editionId!: string;

  @ApiProperty({ enum: ["new", "like_new", "good", "fair", "poor"] })
  @IsEnum(["new", "like_new", "good", "fair", "poor"])
  condition!: string;

  @ApiPropertyOptional({ enum: ["lend", "sell", "give_away"] })
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
}
