import { IsString, IsOptional, IsUUID } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class AdminCreateWishDto {
  @ApiProperty({ description: "The user ID of the member this wish is created on behalf of" })
  @IsUUID()
  userId!: string;

  @ApiProperty()
  @IsUUID()
  bookId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  editionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
