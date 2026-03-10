import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength, MaxLength } from "class-validator";

export class UpdatePasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  oldPassword!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(200)
  newPassword!: string;
}
