import {
  copies,
  createDb,
  editions,
  notifications,
  wishes,
} from "@bookshare/db";
import {
  NotificationType,
  type CopyAvailableNotificationMetadata,
  type CopyCreatedWorkflowEvent,
  type CopyStatusChangedWorkflowEvent,
  type NotificationBookSnapshot,
  type NotificationCopySnapshot,
  type NotificationEditionSnapshot,
  type NotificationMemberSnapshot,
  type NotificationWishSnapshot,
  type WishCreatedWorkflowEvent,
  type WishFulfilledImmediatelyNotificationMetadata,
  type WishMatchesCopyNotificationMetadata,
} from "@bookshare/shared";
import { and, eq, inArray } from "drizzle-orm";

type LoggerLike = {
  info: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
  warn?: (message: string, meta?: Record<string, unknown>) => void;
};

type PublicProfile =
  | {
      username: string;
      firstName: string | null;
      displayName: string;
      cityArea: string | null;
      contactHandle: string | null;
      avatarUrl: string | null;
    }
  | null
  | undefined;

function logWarn(logger: LoggerLike, message: string, meta?: Record<string, unknown>) {
  if (typeof logger.warn === "function") {
    logger.warn(message, meta);
    return;
  }
  logger.info(message, meta);
}

function createWorkflowDb(logger: LoggerLike) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    logger.error("DATABASE_URL not configured for workflow matching");
    return null;
  }

  return createDb(connectionString);
}

function humanizeToken(value: string) {
  return value.replace(/_/g, " ");
}

function formatCondition(condition: string) {
  return humanizeToken(condition);
}

function formatShareType(shareType: string | null) {
  return shareType ? humanizeToken(shareType) : "share type not specified";
}

function formatEditionLabel(format: string) {
  return humanizeToken(format);
}

function getPublicFirstName(profile: PublicProfile) {
  const firstName = profile?.firstName?.trim();
  if (firstName) return firstName;

  const displayName = profile?.displayName?.trim();
  if (displayName) {
    const [firstToken] = displayName.split(/\s+/);
    if (firstToken) return firstToken;
  }

  const username = profile?.username?.trim();
  if (username) return username;

  return "Someone";
}

function getPublicDisplayName(profile: PublicProfile) {
  const displayName = profile?.displayName?.trim();
  if (displayName) return displayName;

  const username = profile?.username?.trim();
  if (username) return username;

  return "Community member";
}

function getPublicCity(profile: PublicProfile, fallback: string) {
  const cityArea = profile?.cityArea?.trim();
  return cityArea || fallback;
}

function buildBookSnapshot(book: {
  id: string;
  title: string;
  subtitle: string | null;
  bookAuthors?: Array<{ author: { name: string } }> | null;
}): NotificationBookSnapshot {
  return {
    bookId: book.id,
    title: book.title,
    subtitle: book.subtitle,
    authors: Array.from(
      new Set(
        (book.bookAuthors ?? [])
          .map((entry) => entry.author.name.trim())
          .filter((value) => value.length > 0)
      )
    ),
  };
}

function buildEditionSnapshot(edition: {
  id: string;
  isbn: string | null;
  format: NotificationEditionSnapshot["format"];
  publisher: string | null;
  publishedYear: number | null;
}): NotificationEditionSnapshot {
  return {
    editionId: edition.id,
    isbn: edition.isbn,
    format: edition.format,
    publisher: edition.publisher,
    publishedYear: edition.publishedYear,
  };
}

function buildMemberSnapshot(
  profile: PublicProfile,
  userId: string
): NotificationMemberSnapshot {
  return {
    userId,
    username: profile?.username ?? null,
    displayName: getPublicDisplayName(profile),
    firstName: profile?.firstName ?? null,
    cityArea: profile?.cityArea ?? null,
    contactHandle: profile?.contactHandle ?? null,
    avatarUrl: profile?.avatarUrl ?? null,
    profilePath: null,
  };
}

function buildCopySnapshot(copy: {
  id: string;
  condition: NotificationCopySnapshot["condition"];
  shareType: NotificationCopySnapshot["shareType"];
  notes: string | null;
  contactNote: string | null;
  edition: {
    id: string;
    isbn: string | null;
    format: NotificationEditionSnapshot["format"];
    publisher: string | null;
    publishedYear: number | null;
  };
}): NotificationCopySnapshot {
  return {
    copyId: copy.id,
    condition: copy.condition,
    shareType: copy.shareType,
    notes: copy.notes,
    contactNote: copy.contactNote,
    edition: buildEditionSnapshot(copy.edition),
  };
}

function buildWishSnapshot(wish: {
  id: string;
  notes: string | null;
  edition?: {
    id: string;
    isbn: string | null;
    format: NotificationEditionSnapshot["format"];
    publisher: string | null;
    publishedYear: number | null;
  } | null;
}): NotificationWishSnapshot {
  return {
    wishId: wish.id,
    notes: wish.notes,
    requestedEdition: wish.edition ? buildEditionSnapshot(wish.edition) : null,
  };
}

export async function handleCopyWishMatch(
  event: CopyCreatedWorkflowEvent | CopyStatusChangedWorkflowEvent,
  logger: LoggerLike
) {
  const db = createWorkflowDb(logger);
  if (!db) return;

  const copy = await db.query.copies.findFirst({
    where: eq(copies.id, event.copyId),
    with: {
      edition: {
        with: {
          book: {
            with: {
              bookAuthors: {
                with: {
                  author: true,
                },
              },
            },
          },
        },
      },
      ownerProfile: true,
    },
  });

  if (!copy) {
    logWarn(logger, "Skipping copy matcher because copy was not found", {
      copyId: event.copyId,
    });
    return;
  }

  if (copy.status !== "available") {
    logger.info("Skipping copy matcher because copy is not available", {
      copyId: copy.id,
      status: copy.status,
    });
    return;
  }

  const activeWishes = await db.query.wishes.findMany({
    where: and(eq(wishes.bookId, copy.edition.book.id), eq(wishes.status, "active")),
    with: {
      edition: true,
      userProfile: true,
    },
  });

  const recipientWishes = activeWishes.filter((wish) => wish.userId !== copy.userId);
  if (recipientWishes.length === 0) {
    logger.info("No active wishes matched the available copy", {
      copyId: copy.id,
      bookId: copy.edition.book.id,
    });
    return;
  }

  const bookSnapshot = buildBookSnapshot(copy.edition.book);
  const copySnapshot = buildCopySnapshot(copy);
  const ownerSnapshot = buildMemberSnapshot(copy.ownerProfile, copy.userId);
  const linkTo = `/books/${copy.edition.book.id}`;
  const title = `A copy of ${bookSnapshot.title} is now available`;
  const body = `${ownerSnapshot.displayName} in ${getPublicCity(
    copy.ownerProfile,
    "your community"
  )} listed a ${formatEditionLabel(copy.edition.format)} copy in ${formatCondition(
    copy.condition
  )} condition for ${formatShareType(copy.shareType)}.`;

  await db.insert(notifications).values(
    recipientWishes.map((wish) => {
      const metadata: CopyAvailableNotificationMetadata = {
        book: bookSnapshot,
        wish: buildWishSnapshot(wish),
        copy: copySnapshot,
        owner: ownerSnapshot,
        bookPath: linkTo,
      };

      return {
        userId: wish.userId,
        type: NotificationType.COPY_AVAILABLE,
        title,
        body,
        metadata,
        linkTo,
      };
    })
  );

  logger.info("Created copy-available notifications", {
    copyId: copy.id,
    notificationsCreated: recipientWishes.length,
  });
}

export async function handleWishCopyMatch(
  event: WishCreatedWorkflowEvent,
  logger: LoggerLike
) {
  const db = createWorkflowDb(logger);
  if (!db) return;

  const wish = await db.query.wishes.findFirst({
    where: eq(wishes.id, event.wishId),
    with: {
      book: {
        with: {
          bookAuthors: {
            with: {
              author: true,
            },
          },
        },
      },
      edition: true,
      userProfile: true,
    },
  });

  if (!wish) {
    logWarn(logger, "Skipping wish matcher because wish was not found", {
      wishId: event.wishId,
    });
    return;
  }

  const availableCopyRows = await db
    .select({
      copyId: copies.id,
      listerUserId: copies.userId,
    })
    .from(copies)
    .innerJoin(editions, eq(copies.editionId, editions.id))
    .where(and(eq(editions.bookId, wish.bookId), eq(copies.status, "available")));

  const matchingCopyIds = availableCopyRows
    .filter((copy) => copy.listerUserId !== wish.userId)
    .map((copy) => copy.copyId);

  if (matchingCopyIds.length === 0) {
    logger.info("No available copies matched the new wish", {
      wishId: wish.id,
      bookId: wish.bookId,
    });
    return;
  }

  const matchingCopies = await db.query.copies.findMany({
    where: inArray(copies.id, matchingCopyIds),
    with: {
      edition: {
        with: {
          book: {
            with: {
              bookAuthors: {
                with: {
                  author: true,
                },
              },
            },
          },
        },
      },
      ownerProfile: true,
    },
  });

  const bookSnapshot = buildBookSnapshot(wish.book);
  const wishSnapshot = buildWishSnapshot(wish);
  const wisherSnapshot = buildMemberSnapshot(wish.userProfile, wish.userId);
  const bookPath = `/books/${wish.bookId}`;
  const matchSnapshots = matchingCopies.map((copy) => ({
    owner: buildMemberSnapshot(copy.ownerProfile, copy.userId),
    copy: buildCopySnapshot(copy),
  }));

  const notificationRows: Array<{
    userId: string;
    type: string;
    title: string;
    body: string;
    metadata:
      | WishFulfilledImmediatelyNotificationMetadata
      | WishMatchesCopyNotificationMetadata;
    linkTo: string | null;
  }> = [];

  const wishMetadata: WishFulfilledImmediatelyNotificationMetadata = {
    book: bookSnapshot,
    wish: wishSnapshot,
    matches: matchSnapshots,
    bookPath,
  };

  notificationRows.push({
    userId: wish.userId,
    type: NotificationType.WISH_FULFILLED_IMMEDIATELY,
    title: `Matches found for ${bookSnapshot.title}`,
    body: `${matchSnapshots.length} ${
      matchSnapshots.length === 1 ? "available copy is" : "available copies are"
    } already in the community.`,
    metadata: wishMetadata,
    linkTo: bookPath,
  });

  const matchesByOwner = new Map<
    string,
    { owner: NotificationMemberSnapshot; copies: NotificationCopySnapshot[] }
  >();

  for (const match of matchSnapshots) {
    const existing = matchesByOwner.get(match.owner.userId);
    if (existing) {
      existing.copies.push(match.copy);
      continue;
    }

    matchesByOwner.set(match.owner.userId, {
      owner: match.owner,
      copies: [match.copy],
    });
  }

  const wisherName = getPublicDisplayName(wish.userProfile);
  const wisherFirstName = getPublicFirstName(wish.userProfile);
  const wisherCity = getPublicCity(wish.userProfile, "your community");

  for (const [ownerUserId, ownerMatch] of matchesByOwner.entries()) {
    const metadata: WishMatchesCopyNotificationMetadata = {
      book: bookSnapshot,
      wish: wishSnapshot,
      wisher: wisherSnapshot,
      matchingCopies: ownerMatch.copies,
      bookPath,
    };

    notificationRows.push({
      userId: ownerUserId,
      type: NotificationType.WISH_MATCHES_COPY,
      title: `${wisherName} is looking for ${bookSnapshot.title}`,
      body: `${wisherFirstName} in ${wisherCity} added this book to their wishlist. ${
        ownerMatch.copies.length === 1
          ? "1 matching copy from your library is shown below."
          : `${ownerMatch.copies.length} matching copies from your library are shown below.`
      }`,
      metadata,
      linkTo: null,
    });
  }

  await db.insert(notifications).values(notificationRows);

  logger.info("Created wish-match notifications", {
    wishId: wish.id,
    notificationsCreated: notificationRows.length,
    matchedCopies: matchSnapshots.length,
  });
}
