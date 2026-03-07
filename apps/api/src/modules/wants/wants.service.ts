import {
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
  wants,
} from "@booktrack/db";
import {
  and,
  asc,
  count,
  eq,
  exists,
  ilike,
  inArray,
  or,
  sql,
} from "drizzle-orm";
import { userScope, userAnd } from "../../common/tenant/tenant-scope";
import { CreateWantDto, UpdateWantDto } from "./dto";

const activeCopyStatuses = [
  "available",
  "reserved",
  "lent",
  "rented",
  "checked_out",
] as const;

interface WantSearchResult {
  bookId: string;
  title: string;
  subtitle: string | null;
  authors: Array<{ id: string; name: string }>;
  primaryIsbn: string | null;
  hasEdition: boolean;
  hasCommunityCopy: boolean;
}

@Injectable()
export class WantsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async findAll(userId: string) {
    return this.db.query.wants.findMany({
      where: userScope(wants.userId, userId),
      with: { book: true },
      orderBy: (wants, { desc }) => [desc(wants.createdAt)],
    });
  }

  async findOne(id: string, userId: string) {
    const want = await this.db.query.wants.findFirst({
      where: userAnd(wants.userId, userId, [eq(wants.id, id)]),
      with: { book: true },
    });

    if (!want) throw new NotFoundException(`Want with ID ${id} not found`);
    return want;
  }

  async search(query: string): Promise<WantSearchResult[]> {
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

    const editionSummaryRows = await this.db
      .select({
        bookId: editions.bookId,
        editionCount: count(editions.id),
        primaryIsbn: sql<string | null>`MIN(${editions.isbn})`,
      })
      .from(editions)
      .where(inArray(editions.bookId, bookIds))
      .groupBy(editions.bookId);

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
      { editionCount: number; primaryIsbn: string | null }
    >();
    for (const row of editionSummaryRows) {
      editionsByBookId.set(row.bookId, {
        editionCount: Number(row.editionCount),
        primaryIsbn: row.primaryIsbn,
      });
    }

    const copiesByBookId = new Map<string, number>();
    for (const row of copySummaryRows) {
      copiesByBookId.set(row.bookId, Number(row.copyCount));
    }

    return matchedBooks.map((book) => {
      const editionSummary = editionsByBookId.get(book.id);
      return {
        bookId: book.id,
        title: book.title,
        subtitle: book.subtitle,
        authors: authorsByBookId.get(book.id) ?? [],
        primaryIsbn: editionSummary?.primaryIsbn ?? null,
        hasEdition: (editionSummary?.editionCount ?? 0) > 0,
        hasCommunityCopy: (copiesByBookId.get(book.id) ?? 0) > 0,
      };
    });
  }

  async create(dto: CreateWantDto, userId: string) {
    // Check for duplicate active want (user_id, book_id)
    const existing = await this.db.query.wants.findFirst({
      where: and(
        eq(wants.userId, userId),
        eq(wants.bookId, dto.bookId),
        eq(wants.status, "active")
      ),
    });

    if (existing) {
      throw new ConflictException(
        "You already have a want for this book"
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
          inArray(copies.status, [
            "available",
            "reserved",
            "lent",
            "checked_out",
          ] as any[])
        )
      )
      .limit(1);

    if (activeOwnership.length > 0) {
      throw new ConflictException(
        "You already have an active copy of this book in your library"
      );
    }

    const [want] = await this.db
      .insert(wants)
      .values({
        userId,
        bookId: dto.bookId,
        notes: dto.notes,
        status: "active",
        lastConfirmedAt: new Date(),
      })
      .returning();

    return this.findOne(want.id, userId);
  }

  async confirm(id: string, userId: string) {
    await this.findOne(id, userId);
    const [updated] = await this.db
      .update(wants)
      .set({ lastConfirmedAt: new Date() })
      .where(and(eq(wants.id, id), eq(wants.userId, userId)))
      .returning();
    return updated;
  }

  async update(id: string, dto: UpdateWantDto, userId: string) {
    const existing = await this.findOne(id, userId);
    if (dto.notes === undefined) return existing;

    await this.db
      .update(wants)
      .set({ notes: dto.notes })
      .where(and(eq(wants.id, id), eq(wants.userId, userId)));

    return this.findOne(id, userId);
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    const [deleted] = await this.db
      .delete(wants)
      .where(and(eq(wants.id, id), eq(wants.userId, userId)))
      .returning({ id: wants.id });

    if (!deleted) throw new NotFoundException(`Want with ID ${id} not found`);
    return { deleted: true };
  }
}
