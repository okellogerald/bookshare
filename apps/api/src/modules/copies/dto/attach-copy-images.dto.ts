import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

class CopyImageInputDto {
  @ApiProperty()
  @IsString()
  @MaxLength(1000)
  objectKey!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(2000)
  imageUrl!: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class AttachCopyImagesDto {
  @ApiProperty({ type: [CopyImageInputDto] })
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => CopyImageInputDto)
  images!: CopyImageInputDto[];
}
