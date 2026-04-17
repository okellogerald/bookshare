import { IsOptional, IsString } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class RejectWantSubmissionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reviewNotes?: string;
}
