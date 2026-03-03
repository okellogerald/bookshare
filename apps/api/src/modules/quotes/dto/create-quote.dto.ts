import { IsString, IsOptional, IsUUID, MaxLength } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateQuoteDto {
  @ApiProperty()
  @IsUUID()
  editionId!: string;

  @ApiProperty()
  @IsString()
  text!: string;

  @ApiPropertyOptional({ maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  chapter?: string;
}
