import { IsString, IsOptional, MaxLength } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateBookDto {
  @ApiProperty({ maxLength: 500 })
  @IsString()
  @MaxLength(500)
  title!: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  subtitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: "en", maxLength: 10 })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;

  @ApiPropertyOptional({ description: "Array of author IDs to link", type: [String] })
  @IsOptional()
  @IsString({ each: true })
  authorIds?: string[];

  @ApiPropertyOptional({ description: "Array of category IDs to link", type: [String] })
  @IsOptional()
  @IsString({ each: true })
  categoryIds?: string[];
}
