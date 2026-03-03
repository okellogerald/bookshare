import { IsString, IsOptional, IsUUID, MaxLength } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateCategoryDto {
  @ApiProperty({ maxLength: 255 })
  @IsString()
  @MaxLength(255)
  name!: string;

  @ApiProperty({ maxLength: 255 })
  @IsString()
  @MaxLength(255)
  slug!: string;

  @ApiPropertyOptional({ description: "Parent category ID for hierarchy" })
  @IsOptional()
  @IsUUID()
  parentId?: string;
}
