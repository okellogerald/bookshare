import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MaxLength } from "class-validator";

export class UpdateEmailDto {
  @ApiProperty()
  @IsString()
  @IsEmail()
  @MaxLength(320)
  email!: string;
}
