import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsString, Max, MaxLength, Min } from "class-validator";

export class CreateEditionCoverPresignDto {
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  fileName!: string;

  @ApiProperty({ example: "image/jpeg" })
  @IsString()
  @MaxLength(100)
  contentType!: string;

  @ApiProperty({ example: 1024000 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5 * 1024 * 1024)
  fileSize!: number;
}
