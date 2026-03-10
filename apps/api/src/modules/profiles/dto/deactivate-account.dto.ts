import { ApiProperty } from "@nestjs/swagger";
import { Equals, IsString, MinLength, MaxLength } from "class-validator";

export class DeactivateAccountDto {
  @ApiProperty({
    description: "User confirmation phrase",
    example: "DEACTIVATE",
  })
  @IsString()
  @Equals("DEACTIVATE", {
    message: "confirmation must be exactly DEACTIVATE",
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
