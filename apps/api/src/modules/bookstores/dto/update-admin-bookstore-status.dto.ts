import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString } from "class-validator";

export class UpdateAdminBookstoreStatusDto {
  @ApiProperty({ enum: ["approved", "rejected", "suspended"] })
  @IsIn(["approved", "rejected", "suspended"])
  status!: "approved" | "rejected" | "suspended";

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reviewNote?: string;
}
