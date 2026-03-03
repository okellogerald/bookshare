import { IsString, MaxLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateAuthorDto {
  @ApiProperty({ maxLength: 500 })
  @IsString()
  @MaxLength(500)
  name!: string;
}
