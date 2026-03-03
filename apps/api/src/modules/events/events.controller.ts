import { Controller, Post, Body } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { EventsService } from "./events.service";
import { CreateEventNoteDto } from "./dto";
import { CurrentUser } from "../../common/decorators";
import type { AuthenticatedUser } from "../../common/guards";

@ApiTags("Events")
@ApiBearerAuth()
@Controller("events")
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post("notes")
  addNote(
    @Body() dto: CreateEventNoteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.eventsService.addNote(dto, user.id);
  }
}
