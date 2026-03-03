import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { DRIZZLE } from "../../drizzle/drizzle.service";
import { type Database, books, bookAuthors, bookCategories } from "@booktrack/db";
import { eq } from "drizzle-orm";
import { CreateBookDto, UpdateBookDto } from "./dto";

@Injectable()
export class BooksService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async create(dto: CreateBookDto) {
    return this.db.transaction(async (tx) => {
      const [book] = await tx
        .insert(books)
        .values({
          title: dto.title,
          subtitle: dto.subtitle,
          description: dto.description,
          language: dto.language ?? "en",
        })
        .returning();

      if (dto.authorIds?.length) {
        await tx.insert(bookAuthors).values(
          dto.authorIds.map((authorId) => ({ bookId: book.id, authorId }))
        );
      }

      if (dto.categoryIds?.length) {
        await tx.insert(bookCategories).values(
          dto.categoryIds.map((categoryId) => ({ bookId: book.id, categoryId }))
        );
      }

      return book;
    });
  }

  async update(id: string, dto: UpdateBookDto) {
    const { authorIds, categoryIds, ...bookData } = dto;

    return this.db.transaction(async (tx) => {
      if (Object.keys(bookData).length > 0) {
        const [updated] = await tx.update(books).set(bookData).where(eq(books.id, id)).returning();
        if (!updated) throw new NotFoundException(`Book with ID ${id} not found`);
      }

      if (authorIds !== undefined) {
        await tx.delete(bookAuthors).where(eq(bookAuthors.bookId, id));
        if (authorIds.length) {
          await tx.insert(bookAuthors).values(
            authorIds.map((authorId) => ({ bookId: id, authorId }))
          );
        }
      }

      if (categoryIds !== undefined) {
        await tx.delete(bookCategories).where(eq(bookCategories.bookId, id));
        if (categoryIds.length) {
          await tx.insert(bookCategories).values(
            categoryIds.map((categoryId) => ({ bookId: id, categoryId }))
          );
        }
      }

      return { id };
    });
  }

  async remove(id: string) {
    const [deleted] = await this.db.delete(books).where(eq(books.id, id)).returning({ id: books.id });
    if (!deleted) throw new NotFoundException(`Book with ID ${id} not found`);
    return { deleted: true };
  }
}
