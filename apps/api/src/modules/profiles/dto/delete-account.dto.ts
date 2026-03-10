import { ApiProperty } from "@nestjs/swagger";
import { Equals, IsString, MinLength, MaxLength } from "class-validator";

export class DeleteAccountDto {
  @ApiProperty({
    description: "User confirmation phrase",
    example: "DELETE",
  })
  @IsString()
  @Equals("DELETE", {
    message: "confirmation must be exactly DELETE",
  })
  confirmation!: string;

  @ApiProperty({
    description: "Password confirmation",
  })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password!: string;
}
