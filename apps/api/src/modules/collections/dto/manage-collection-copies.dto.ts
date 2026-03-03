import { IsUUID, ArrayNotEmpty } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class ManageCollectionCopiesDto {
  @ApiProperty({ type: [String], description: "Array of copy IDs to add/remove" })
  @ArrayNotEmpty()
  @IsUUID("4", { each: true })
  copyIds!: string[];
}
