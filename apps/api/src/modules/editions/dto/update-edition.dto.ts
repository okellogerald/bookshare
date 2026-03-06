import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export class UpdateEditionDto {
  @ApiPropertyOptional({ maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  isbn?: string;

  @ApiPropertyOptional({
    enum: ["hardcover", "paperback", "mass_market", "ebook", "audiobook"],
  })
  @IsOptional()
  @IsEnum(["hardcover", "paperback", "mass_market", "ebook", "audiobook"])
  format?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  publisher?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  publishedYear?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  pageCount?: number;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  coverImageUrl?: string | null;
}
