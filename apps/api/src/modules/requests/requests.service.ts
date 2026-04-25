import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import {
  type Database,
  copies,
  wishes,
} from "@bookshare/db";
import type {
  AdminRequestIdleCopyRow,
  AdminRequestMatchCandidate,
  AdminRequestMatchRow,
  AdminRequestUnmetWishRow,
  AdminRequestsOverview,
  AdminRequestsSummary,
} from "@bookshare/shared";
import { DRIZZLE } from "../../drizzle/drizzle.service";

@Injectable()
export class RequestsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * Produce the full Matches-workbench payload in one query pair.
   *
   * Algorithm:
   * 1. Load every active wish with its book, (optional) edition, and wisher
   *    profile.
   * 2. Load every available copy with its edition (and the edition's book)
   *    and the owner profile.
   * 3. Group copies by `book_id` — the common denominator for matching. A
   *    copy becomes an edition-exact candidate when its `edition_id` equals
   *    the wish's `edition_id`.
   * 4. Partition wishes into `matches` (≥1 candidate) vs `unmet`.
   * 5. Copies whose book_id is not referenced by any active wish become
   *    `idle` (supply sitting with no pull).
   */
  async getOverview(): Promise<AdminRequestsOverview> {
    const [activeWishes, availableCopies] = await Promise.all([
      this.db.query.wishes.findMany({
        where: eq(wishes.status, "active"),
        with: {
          book: true,
          edition: true,
          userProfile: true,
        },
      }),
      this.db.query.copies.findMany({
        where: eq(copies.status, "available"),
        with: {
          edition: {
            with: {
              book: true,
            },
          },
          ownerProfile: true,
        },
      }),
    ]);

    type CopyWithRelations = (typeof availableCopies)[number];

    // Group copies by their underlying book_id so we can O(1) look them up
    // while iterating wishes. Each wish produces candidates from this bucket.
    const copiesByBookId = new Map<string, CopyWithRelations[]>();
    for (const copy of availableCopies) {
      const bookId = copy.edition.book.id;
      const bucket = copiesByBookId.get(bookId);
      if (bucket) {
        bucket.push(copy);
      } else {
        copiesByBookId.set(bookId, [copy]);
      }
    }

    // Track which book_ids had at least one active wish — used later to
    // classify copies as "idle" (book not wished for by anyone right now).
    const wishedBookIds = new Set<string>();

    const matches: AdminRequestMatchRow[] = [];
    const unmet: AdminRequestUnmetWishRow[] = [];

    for (const wish of activeWishes) {
      wishedBookIds.add(wish.bookId);
      const candidatesRaw = copiesByBookId.get(wish.bookId) ?? [];

      if (candidatesRaw.length === 0) {
        unmet.push({
          wishId: wish.id,
          wisherUserId: wish.userId,
          wisherDisplayName: formatDisplayName(wish.userProfile),
          bookId: wish.book.id,
          bookTitle: wish.book.title,
          bookSubtitle: wish.book.subtitle,
          wishEditionId: wish.editionId,
          wishEditionIsbn: wish.edition?.isbn ?? null,
          wishNotes: wish.notes,
          wishCreatedAt: wish.createdAt.toISOString(),
        });
        continue;
      }

      const candidates: AdminRequestMatchCandidate[] = candidatesRaw.map(
        (copy) => ({
          copyId: copy.id,
          ownerUserId: copy.userId,
          ownerDisplayName: formatDisplayName(copy.ownerProfile),
          editionId: copy.edition.id,
          isbn: copy.edition.isbn,
          coverImageUrl: copy.edition.coverImageUrl,
          condition: copy.condition,
          shareType: copy.shareType,
          contactNote: copy.contactNote,
          copyCreatedAt: copy.createdAt.toISOString(),
          isEditionExact:
            wish.editionId !== null && wish.editionId === copy.edition.id,
        })
      );

      // Sort edition-exact candidates first, then newest listings ahead of
      // older ones — staff want the strongest match at the top of the row.
      candidates.sort((a, b) => {
        if (a.isEditionExact !== b.isEditionExact) {
          return a.isEditionExact ? -1 : 1;
        }
        return b.copyCreatedAt.localeCompare(a.copyCreatedAt);
      });

      matches.push({
        wishId: wish.id,
        wisherUserId: wish.userId,
        wisherDisplayName: formatDisplayName(wish.userProfile),
        bookId: wish.book.id,
        bookTitle: wish.book.title,
        bookSubtitle: wish.book.subtitle,
        wishEditionId: wish.editionId,
        wishEditionIsbn: wish.edition?.isbn ?? null,
        wishNotes: wish.notes,
        wishCreatedAt: wish.createdAt.toISOString(),
        candidates,
        hasEditionExactCandidate: candidates.some((c) => c.isEditionExact),
      });
    }

    // Idle copies = available copies whose book is not on any active wish.
    const idle: AdminRequestIdleCopyRow[] = availableCopies
      .filter((copy) => !wishedBookIds.has(copy.edition.book.id))
      .map((copy) => ({
        copyId: copy.id,
        ownerUserId: copy.userId,
        ownerDisplayName: formatDisplayName(copy.ownerProfile),
        bookId: copy.edition.book.id,
        bookTitle: copy.edition.book.title,
        bookSubtitle: copy.edition.book.subtitle,
        editionId: copy.edition.id,
        isbn: copy.edition.isbn,
        coverImageUrl: copy.edition.coverImageUrl,
        condition: copy.condition,
        shareType: copy.shareType,
        contactNote: copy.contactNote,
        copyCreatedAt: copy.createdAt.toISOString(),
      }));

    // Newest-first across all three lists keeps the operator's attention on
    // fresh activity.
    matches.sort((a, b) => b.wishCreatedAt.localeCompare(a.wishCreatedAt));
    unmet.sort((a, b) => b.wishCreatedAt.localeCompare(a.wishCreatedAt));
    idle.sort((a, b) => b.copyCreatedAt.localeCompare(a.copyCreatedAt));

    const summary: AdminRequestsSummary = {
      activeWishes: activeWishes.length,
      availableCopies: availableCopies.length,
      wishesWithMatches: matches.length,
      idleCopies: idle.length,
    };

    return { summary, matches, unmet, idle };
  }
}

function formatDisplayName(
  profile: {
    firstName: string | null;
    lastName: string | null;
  } | null
): string | null {
  if (!profile) return null;
  const parts = [profile.firstName, profile.lastName]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part && part.length > 0));
  if (parts.length === 0) return null;
  return parts.join(" ");
}
