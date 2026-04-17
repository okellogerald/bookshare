import { IsOptional, IsString, IsUUID } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ApproveWantSubmissionDto {
  @ApiProperty({ description: "The catalog book to link this want to." })
  @IsUUID()
  bookId!: string;

  @ApiPropertyOptional({
    description: "Optionally restrict the want to a specific edition.",
  })
  @IsOptional()
  @IsUUID()
  editionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  wantNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reviewNotes?: string;
}
