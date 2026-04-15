import { IsString, MaxLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateCategoryDto {
  @ApiProperty({ maxLength: 20, description: "Thema subject code" })
  @IsString()
  @MaxLength(20)
  themaCode!: string;

  @ApiProperty({ maxLength: 255 })
  @IsString()
  @MaxLength(255)
  name!: string;
}
