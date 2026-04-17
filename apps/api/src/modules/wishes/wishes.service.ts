import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { DRIZZLE } from "../../drizzle/drizzle.service";
import {
  type Database,
  authors,
  bookAuthors,
  books,
  copies,
  editions,
  wishes,
} from "@bookshare/db";
import { WishClosureReason, WorkflowTopic } from "@bookshare/shared";
import {
  and,
  asc,
  count,
  eq,
  exists,
  ilike,
  inArray,
  or,
} from "drizzle-orm";
import { userScope, userAnd } from "../../common/tenant/tenant-scope";
import { WorkflowEventsService } from "../workflow-events/workflow-events.service";
import { CreateWishDto, UpdateWishDto } from "./dto";

const activeCopyStatuses = [
  "available",
  "shelved",
  "lent",
] as const;

interface WishSearchResult {
  bookId: string;
  title: string;
  subtitle: string | null;
  authors: Array<{ id: string; name: string }>;
  editions: Array<{
    id: string;
    isbn: string | null;
    format: string;
    coverImageUrl: string | null;
  }>;
  primaryIsbn: string | null;
  hasEdition: boolean;
  hasCommunityCopy: boolean;
}

@Injectable()
export class WishesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly workflowEvents: WorkflowEventsService
  ) {}

  private assertActiveWishForMutation(
    wish: { status: "active" | "fulfilled" | "cancelled" }
  ) {
    if (wish.status !== "active") {
      throw new BadRequestException(
        "Only active wishes can be modified. Closed wishes are read-only history."
      );
    }
  }

  async findAll(userId: string) {
    return this.db.query.wishes.findMany({
      where: userScope(wishes.userId, userId),
      with: { book: true },
      orderBy: (table, { desc }) => [desc(table.createdAt)],
    });
  }

  async findOne(id: string, userId: string) {
    const wish = await this.db.query.wishes.findFirst({
      where: userAnd(wishes.userId, userId, [eq(wishes.id, id)]),
      with: { book: true },
    });

    if (!wish) throw new NotFoundException(`Wish with ID ${id} not found`);
    return wish;
  }

  async search(query: string): Promise<WishSearchResult[]> {
    const normalized = query.trim();
    if (normalized.length < 2) return [];
    const term = `%${normalized}%`;

    const matchedBooks = await this.db
      .select({
        id: books.id,
        title: books.title,
        subtitle: books.subtitle,
      })
      .from(books)
      .where(
        or(
          ilike(books.title, term),
          ilike(books.subtitle, term),
          exists(
            this.db
              .select({ id: bookAuthors.bookId })
              .from(bookAuthors)
              .innerJoin(authors, eq(bookAuthors.authorId, authors.id))
              .where(
                and(eq(bookAuthors.bookId, books.id), ilike(authors.name, term))
              )
          ),
          exists(
            this.db
              .select({ id: editions.bookId })
              .from(editions)
              .where(
                and(eq(editions.bookId, books.id), ilike(editions.isbn, term))
              )
          )
        )
      )
      .orderBy(asc(books.title), asc(books.subtitle))
      .limit(30);

    if (matchedBooks.length === 0) return [];
    const bookIds = matchedBooks.map((book) => book.id);

    const authorRows = await this.db
      .select({
        bookId: bookAuthors.bookId,
        authorId: authors.id,
        authorName: authors.name,
      })
      .from(bookAuthors)
      .innerJoin(authors, eq(bookAuthors.authorId, authors.id))
      .where(inArray(bookAuthors.bookId, bookIds))
      .orderBy(asc(authors.name));

    const editionRows = await this.db
      .select({
        id: editions.id,
        bookId: editions.bookId,
        isbn: editions.isbn,
        format: editions.format,
        coverImageUrl: editions.coverImageUrl,
      })
      .from(editions)
      .where(inArray(editions.bookId, bookIds))
      .orderBy(asc(editions.isbn), asc(editions.createdAt));

    const copySummaryRows = await this.db
      .select({
        bookId: editions.bookId,
        copyCount: count(copies.id),
      })
      .from(copies)
      .innerJoin(editions, eq(copies.editionId, editions.id))
      .where(
        and(
          inArray(editions.bookId, bookIds),
          inArray(copies.status, [...activeCopyStatuses] as any[])
        )
      )
      .groupBy(editions.bookId);

    const authorsByBookId = new Map<string, Array<{ id: string; name: string }>>();
    for (const row of authorRows) {
      const existing = authorsByBookId.get(row.bookId) ?? [];
      existing.push({ id: row.authorId, name: row.authorName });
      authorsByBookId.set(row.bookId, existing);
    }

    const editionsByBookId = new Map<
      string,
      Array<{
        id: string;
        isbn: string | null;
        format: string;
        coverImageUrl: string | null;
      }>
    >();
    for (const row of editionRows) {
      const existing = editionsByBookId.get(row.bookId) ?? [];
      existing.push({
        id: row.id,
        isbn: row.isbn,
        format: row.format,
        coverImageUrl: row.coverImageUrl,
      });
      editionsByBookId.set(row.bookId, existing);
    }

    const copiesByBookId = new Map<string, number>();
    for (const row of copySummaryRows) {
      copiesByBookId.set(row.bookId, Number(row.copyCount));
    }

    return matchedBooks.map((book) => {
      const bookEditions = editionsByBookId.get(book.id) ?? [];
      return {
        bookId: book.id,
        title: book.title,
        subtitle: book.subtitle,
        authors: authorsByBookId.get(book.id) ?? [],
        editions: bookEditions,
        primaryIsbn:
          bookEditions.find((edition) => !!edition.isbn)?.isbn ?? null,
        hasEdition: bookEditions.length > 0,
        hasCommunityCopy: (copiesByBookId.get(book.id) ?? 0) > 0,
      };
    });
  }

  async create(dto: CreateWishDto, userId: string) {
    // Check for duplicate active wish (user_id, book_id)
    const existing = await this.db.query.wishes.findFirst({
      where: and(
        eq(wishes.userId, userId),
        eq(wishes.bookId, dto.bookId),
        eq(wishes.status, "active")
      ),
    });

    if (existing) {
      throw new ConflictException(
        "You already have a wish for this book"
      );
    }

    const activeOwnership = await this.db
      .select({ id: copies.id })
      .from(copies)
      .innerJoin(editions, eq(copies.editionId, editions.id))
      .where(
        and(
          eq(copies.userId, userId),
          eq(editions.bookId, dto.bookId),
          inArray(copies.status, ["available", "shelved", "lent"] as any[])
        )
      )
      .limit(1);

    if (activeOwnership.length > 0) {
      throw new ConflictException(
        "You already have an active copy of this book in your library"
      );
    }

    const [wish] = await this.db
      .insert(wishes)
      .values({
        userId,
        bookId: dto.bookId,
        editionId: null,
        notes: dto.notes,
        status: "active",
        lastConfirmedAt: new Date(),
      })
      .returning();

    const createdWish = await this.findOne(wish.id, userId);
    await this.workflowEvents.publish(WorkflowTopic.WISH_CREATED, {
      wishId: createdWish.id,
      userId,
    });

    return createdWish;
  }

  async confirm(id: string, userId: string) {
    const existing = await this.findOne(id, userId);
    this.assertActiveWishForMutation(existing);
    const [updated] = await this.db
      .update(wishes)
      .set({ lastConfirmedAt: new Date() })
      .where(and(eq(wishes.id, id), eq(wishes.userId, userId)))
      .returning();
    return updated;
  }

  async update(id: string, dto: UpdateWishDto, userId: string) {
    const existing = await this.findOne(id, userId);
    this.assertActiveWishForMutation(existing);
    if (dto.notes === undefined) return existing;

    await this.db
      .update(wishes)
      .set({ notes: dto.notes })
      .where(and(eq(wishes.id, id), eq(wishes.userId, userId)));

    return this.findOne(id, userId);
  }

  async remove(id: string, userId: string) {
    const existing = await this.findOne(id, userId);
    this.assertActiveWishForMutation(existing);
    const [removed] = await this.db
      .update(wishes)
      .set({
        status: "cancelled",
        closureReason: WishClosureReason.REMOVED_BY_WISHER,
        closedAt: new Date(),
      })
      .where(and(eq(wishes.id, id), eq(wishes.userId, userId)))
      .returning({ id: wishes.id });

    if (!removed) throw new NotFoundException(`Wish with ID ${id} not found`);
    return { deleted: true };
  }

  // ── Admin operations (no userId scoping) ──────────────────

  private async findOneAdmin(id: string) {
    const wish = await this.db.query.wishes.findFirst({
      where: eq(wishes.id, id),
      with: { book: true },
    });
    if (!wish) throw new NotFoundException(`Wish with ID ${id} not found`);
    return wish;
  }

  async adminUpdate(id: string, dto: UpdateWishDto) {
    const existing = await this.findOneAdmin(id);
    if (dto.notes === undefined) return existing;

    await this.db
      .update(wishes)
      .set({ notes: dto.notes })
      .where(eq(wishes.id, id));

    return this.findOneAdmin(id);
  }

  async adminDelete(id: string) {
    await this.findOneAdmin(id);
    await this.db.delete(wishes).where(eq(wishes.id, id));
    return { deleted: true };
  }

  async adminArchive(id: string) {
    const existing = await this.findOneAdmin(id);

    if (existing.status === "cancelled") {
      throw new BadRequestException("Wish is already cancelled.");
    }

    if (existing.status === "fulfilled") {
      throw new BadRequestException("Fulfilled wishes cannot be archived.");
    }

    await this.db
      .update(wishes)
      .set({
        status: "cancelled",
        closureReason: WishClosureReason.ARCHIVED_BY_ADMIN,
        closedAt: new Date(),
      })
      .where(eq(wishes.id, id));

    return { archived: true };
  }

  async adminRestore(id: string) {
    const existing = await this.findOneAdmin(id);

    if (existing.status !== "cancelled") {
      throw new BadRequestException(
        "Only cancelled wishes can be restored."
      );
    }

    // Guard against duplicate active wish for the same user + book.
    const activeExists = await this.db.query.wishes.findFirst({
      where: and(
        eq(wishes.userId, existing.userId),
        eq(wishes.bookId, existing.bookId),
        eq(wishes.status, "active")
      ),
    });

    if (activeExists) {
      throw new ConflictException(
        "Member already has an active want for this book."
      );
    }

    await this.db
      .update(wishes)
      .set({
        status: "active",
        closureReason: null,
        closedAt: null,
      })
      .where(eq(wishes.id, id));

    return { restored: true };
  }
}
