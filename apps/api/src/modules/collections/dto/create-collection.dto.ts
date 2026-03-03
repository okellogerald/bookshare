import { IsString, IsOptional, MaxLength } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateCollectionDto {
  @ApiProperty({ maxLength: 500 })
  @IsString()
  @MaxLength(500)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}
