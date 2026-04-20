import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class ListBookstoreWantsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;

  @ApiPropertyOptional({
    enum: ["all", "not_proposed", "proposed"],
  })
  @IsOptional()
  @IsIn(["all", "not_proposed", "proposed"])
  proposalState?: "all" | "not_proposed" | "proposed";

  @ApiPropertyOptional({
    enum: ["latest_activity_desc", "oldest_created_asc", "title_asc"],
  })
  @IsOptional()
  @IsIn(["latest_activity_desc", "oldest_created_asc", "title_asc"])
  sort?: "latest_activity_desc" | "oldest_created_asc" | "title_asc";
}
