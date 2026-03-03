import { IsString, IsUUID } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateEventNoteDto {
  @ApiProperty()
  @IsUUID()
  copyId!: string;

  @ApiProperty()
  @IsString()
  notes!: string;
}
