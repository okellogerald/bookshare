import { Inject, Injectable } from "@nestjs/common";
import { DRIZZLE } from "../../drizzle/drizzle.service";
import { type Database, copyEvents } from "@booktrack/db";
import { CreateEventNoteDto } from "./dto";

@Injectable()
export class EventsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async addNote(dto: CreateEventNoteDto, userId: string) {
    const [event] = await this.db
      .insert(copyEvents)
      .values({
        userId,
        copyId: dto.copyId,
        eventType: "note_added",
        performedBy: userId,
        notes: dto.notes,
      })
      .returning();
    return event;
  }
}
