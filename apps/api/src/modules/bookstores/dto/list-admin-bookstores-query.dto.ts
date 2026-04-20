import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class ListAdminBookstoresQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  query?: string;

  @ApiPropertyOptional({
    enum: ["all", "pending", "approved", "rejected", "suspended"],
  })
  @IsOptional()
  @IsIn(["all", "pending", "approved", "rejected", "suspended"])
  status?: "all" | "pending" | "approved" | "rejected" | "suspended";
}
