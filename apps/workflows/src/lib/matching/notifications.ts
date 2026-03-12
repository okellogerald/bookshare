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
  type WishCreatedWorkflowEvent,
  type WishFulfilledImmediatelyNotificationMetadata,
  type WishMatchesCopyNotificationMetadata,
} from "@bookshare/shared";
import { and, eq } from "drizzle-orm";

type LoggerLike = {
  info: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
  warn?: (message: string, meta?: Record<string, unknown>) => void;
};

type PublicProfile =
  | {
      firstName: string | null;
      displayName: string;
      cityArea: string | null;
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

function getPublicFirstName(profile: PublicProfile) {
  const firstName = profile?.firstName?.trim();
  if (firstName) return firstName;

  const displayName = profile?.displayName?.trim();
  if (displayName) {
    const [firstToken] = displayName.split(/\s+/);
    if (firstToken) return firstToken;
  }

  return "Someone";
}

function getPublicCity(profile: PublicProfile, fallback: string) {
  const cityArea = profile?.cityArea?.trim();
  return cityArea || fallback;
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
          book: true,
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

  const title = `A copy of ${copy.edition.book.title} is now available`;
  const body = `${getPublicFirstName(copy.ownerProfile)} in ${getPublicCity(
    copy.ownerProfile,
    "your community"
  )} has listed a copy — ${formatCondition(copy.condition)}, ${formatShareType(
    copy.shareType
  )}.`;
  const linkTo = `/books/${copy.edition.book.id}`;

  await db.insert(notifications).values(
    recipientWishes.map((wish) => {
      const metadata: CopyAvailableNotificationMetadata = {
        bookId: copy.edition.book.id,
        editionId: copy.editionId,
        copyId: copy.id,
        wishId: wish.id,
        listerUserId: copy.userId,
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
      book: true,
      userProfile: true,
    },
  });

  if (!wish) {
    logWarn(logger, "Skipping wish matcher because wish was not found", {
      wishId: event.wishId,
    });
    return;
  }

  const availableCopies = await db
    .select({
      copyId: copies.id,
      listerUserId: copies.userId,
    })
    .from(copies)
    .innerJoin(editions, eq(copies.editionId, editions.id))
    .where(and(eq(editions.bookId, wish.bookId), eq(copies.status, "available")));

  const matchingCopies = availableCopies.filter((copy) => copy.listerUserId !== wish.userId);
  if (matchingCopies.length === 0) {
    logger.info("No available copies matched the new wish", {
      wishId: wish.id,
      bookId: wish.bookId,
    });
    return;
  }

  const notificationRows: Array<{
    userId: string;
    type: string;
    title: string;
    body: string;
    metadata:
      | WishFulfilledImmediatelyNotificationMetadata
      | WishMatchesCopyNotificationMetadata;
    linkTo: string;
  }> = [];

  const wishMetadata: WishFulfilledImmediatelyNotificationMetadata = {
    bookId: wish.bookId,
    wishId: wish.id,
    copyIds: matchingCopies.map((copy) => copy.copyId),
  };

  notificationRows.push({
    userId: wish.userId,
    type: NotificationType.WISH_FULFILLED_IMMEDIATELY,
    title: `${wish.book.title} has available copies`,
    body: `${matchingCopies.length} ${
      matchingCopies.length === 1 ? "copy" : "copies"
    } available in the community.`,
    metadata: wishMetadata,
    linkTo: `/books/${wish.bookId}`,
  });

  const notifiedListers = new Set<string>();
  const wisherCity = getPublicCity(wish.userProfile, "your community");

  for (const copy of matchingCopies) {
    if (notifiedListers.has(copy.listerUserId)) continue;
    notifiedListers.add(copy.listerUserId);

    const metadata: WishMatchesCopyNotificationMetadata = {
      bookId: wish.bookId,
      copyId: copy.copyId,
      wishId: wish.id,
      wisherUserId: wish.userId,
    };

    notificationRows.push({
      userId: copy.listerUserId,
      type: NotificationType.WISH_MATCHES_COPY,
      title: `Someone is looking for ${wish.book.title}`,
      body: `A reader in ${wisherCity} is looking for a book you have listed.`,
      metadata,
      linkTo: `/books/${wish.bookId}`,
    });
  }

  await db.insert(notifications).values(notificationRows);

  logger.info("Created wish-match notifications", {
    wishId: wish.id,
    notificationsCreated: notificationRows.length,
    matchedCopies: matchingCopies.length,
  });
}
