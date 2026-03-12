import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class UpdateWishDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
