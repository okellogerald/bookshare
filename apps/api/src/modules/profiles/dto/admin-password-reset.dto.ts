import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";

export class AdminPasswordResetDto {
  @ApiPropertyOptional({
    description: "How long the recovery code remains valid.",
    example: "1h",
  })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  expiresIn?: string;
}
