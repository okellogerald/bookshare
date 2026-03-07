import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class UpdateWantDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
