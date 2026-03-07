import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateMissingWantSubmissionDto {
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  wantNotes?: string;
}
