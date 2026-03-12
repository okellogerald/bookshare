import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, count, desc, eq } from "drizzle-orm";
import { type Database, notifications } from "@bookshare/db";
import { DRIZZLE } from "../../drizzle/drizzle.service";
import { ListNotificationsQueryDto } from "./dto";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

@Injectable()
export class NotificationsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async findAll(userId: string, query: ListNotificationsQueryDto) {
    const limit = Math.min(query.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const offset = Math.max(query.offset ?? 0, 0);

    const [items, [{ total }]] = await Promise.all([
      this.db.query.notifications.findMany({
        where: eq(notifications.userId, userId),
        orderBy: (table, { desc }) => [desc(table.createdAt)],
        limit,
        offset,
      }),
      this.db
        .select({ total: count() })
        .from(notifications)
        .where(eq(notifications.userId, userId)),
    ]);

    return {
      items,
      total: Number(total),
      limit,
      offset,
    };
  }

  async unreadCount(userId: string) {
    const [{ total }] = await this.db
      .select({ total: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));

    return { count: Number(total) };
  }

  async markRead(id: string, userId: string) {
    const [updated] = await this.db
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning();

    if (!updated) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }

    return updated;
  }

  async markAllRead(userId: string) {
    const updated = await this.db
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.read, false)))
      .returning({ id: notifications.id });

    return { updated: updated.length };
  }
}
