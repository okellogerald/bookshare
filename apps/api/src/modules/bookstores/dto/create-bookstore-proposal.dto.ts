import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, IsUUID } from "class-validator";

export class CreateBookstoreProposalDto {
  @ApiProperty()
  @IsUUID()
  wishId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  message?: string;
}
