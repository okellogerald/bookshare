import { IsString, IsOptional, IsEnum, IsInt, MaxLength, IsUUID } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateEditionDto {
  @ApiProperty()
  @IsUUID()
  bookId!: string;

  @ApiPropertyOptional({ maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  isbn?: string;

  @ApiProperty({ enum: ["hardcover", "paperback", "mass_market", "ebook", "audiobook"] })
  @IsEnum(["hardcover", "paperback", "mass_market", "ebook", "audiobook"])
  format!: string;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  coverImageUrl?: string;
}
