import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateCopySubmissionDto {
  @ApiProperty({ maxLength: 500 })
  @IsString()
  @MaxLength(500)
  title!: string;

  @ApiProperty({ type: [String], minItems: 1, maxItems: 10 })
  @Type(() => String)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(255, { each: true })
  authors!: string[];

  @ApiPropertyOptional({ maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  isbn?: string;

  @ApiPropertyOptional({ maxLength: 10 })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bookDescriptionNotes?: string;

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

  @ApiPropertyOptional({ type: [String], maxItems: 5 })
  @IsOptional()
  @Type(() => String)
  @IsArray()
  @ArrayMaxSize(5)
  @IsUrl(
    {
      require_tld: false,
      require_protocol: true,
    },
    { each: true }
  )
  imageUrls?: string[];
}
