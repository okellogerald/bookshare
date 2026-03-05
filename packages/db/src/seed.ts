import { sql } from "drizzle-orm";
import { createDb } from "./index";
import {
  books,
  authors,
  bookAuthors,
  categories,
  bookCategories,
  editions,
  bookQuotes,
  copies,
  copyEvents,
  collections,
  collectionCopies,
  wants,
  memberProfiles,
} from "./schema";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const USER_ID = process.env.SEED_USER_ID ?? "seed-user-1";

const db = createDb(DATABASE_URL);

async function seed() {
  console.log(`Seeding database (userId: ${USER_ID})...\n`);

  // ─── Truncate ───────────────────────────────────────────────
  await db.execute(
    sql`TRUNCATE books, authors, categories, editions, book_authors, book_categories, book_quotes, copies, copy_events, copy_images, collections, collection_copies, wants, member_profiles CASCADE`
  );

  await db.insert(memberProfiles).values({
    userId: USER_ID,
    username: "seed_reader",
    displayName: "Seed Reader",
    cityArea: "BookTown",
    contactHandle: "@seed_reader",
  });

  // ─── Authors ────────────────────────────────────────────────
  const [fitzgerald, lee, orwell, austen, tolkien, herbert, harari, norman, martin, kahneman] =
    await db
      .insert(authors)
      .values([
        { name: "F. Scott Fitzgerald" },
        { name: "Harper Lee" },
        { name: "George Orwell" },
        { name: "Jane Austen" },
        { name: "J.R.R. Tolkien" },
        { name: "Frank Herbert" },
        { name: "Yuval Noah Harari" },
        { name: "Don Norman" },
        { name: "Robert C. Martin" },
        { name: "Daniel Kahneman" },
      ])
      .returning();

  console.log(`  authors: 10`);

  // ─── Categories ─────────────────────────────────────────────
  const [fiction, nonFiction] = await db
    .insert(categories)
    .values([
      { name: "Fiction", slug: "fiction" },
      { name: "Non-Fiction", slug: "non-fiction" },
    ])
    .returning();

  const [classic, sciFi, fantasy, science, technology, psychology] = await db
    .insert(categories)
    .values([
      { name: "Classic Literature", slug: "classic-literature", parentId: fiction.id },
      { name: "Science Fiction", slug: "science-fiction", parentId: fiction.id },
      { name: "Fantasy", slug: "fantasy", parentId: fiction.id },
      { name: "Science", slug: "science", parentId: nonFiction.id },
      { name: "Technology", slug: "technology", parentId: nonFiction.id },
      { name: "Psychology", slug: "psychology", parentId: nonFiction.id },
    ])
    .returning();

  console.log(`  categories: 8`);

  // ─── Books ──────────────────────────────────────────────────
  const [gatsby, mockingbird, nineteen84, pride, hobbit, dune, sapiens, design, cleanCode, thinking] =
    await db
      .insert(books)
      .values([
        {
          title: "The Great Gatsby",
          description:
            "A novel about the American Dream set in the Jazz Age, following the mysterious millionaire Jay Gatsby and his obsession with Daisy Buchanan.",
          language: "en",
        },
        {
          title: "To Kill a Mockingbird",
          description:
            "A story of racial injustice and childhood innocence in the Deep South, seen through the eyes of young Scout Finch.",
          language: "en",
        },
        {
          title: "1984",
          description:
            "A dystopian novel set in a totalitarian society under constant surveillance, where independent thinking is a crime.",
          language: "en",
        },
        {
          title: "Pride and Prejudice",
          description:
            "A romantic novel following Elizabeth Bennet as she navigates issues of manners, morality, and marriage in Regency-era England.",
          language: "en",
        },
        {
          title: "The Hobbit",
          subtitle: "Or There and Back Again",
          description:
            "The adventure of Bilbo Baggins, a hobbit who is swept into an epic quest to reclaim the lost Dwarf Kingdom of Erebor.",
          language: "en",
        },
        {
          title: "Dune",
          description:
            "An epic science fiction saga set on the desert planet Arrakis, following young Paul Atreides as he navigates politics, religion, and ecology.",
          language: "en",
        },
        {
          title: "Sapiens",
          subtitle: "A Brief History of Humankind",
          description:
            "An exploration of how Homo sapiens came to dominate the Earth, covering the Cognitive, Agricultural, and Scientific Revolutions.",
          language: "en",
        },
        {
          title: "The Design of Everyday Things",
          description:
            "A foundational text on human-centered design, examining why some products satisfy users while others frustrate them.",
          language: "en",
        },
        {
          title: "Clean Code",
          subtitle: "A Handbook of Agile Software Craftsmanship",
          description:
            "A guide to writing readable, maintainable code with practical advice on naming, functions, error handling, and testing.",
          language: "en",
        },
        {
          title: "Thinking, Fast and Slow",
          description:
            "An exploration of the two systems that drive the way we think: fast intuitive thinking and slow deliberate thinking.",
          language: "en",
        },
      ])
      .returning();

  console.log(`  books: 10`);

  // ─── Book ↔ Author ─────────────────────────────────────────
  await db.insert(bookAuthors).values([
    { bookId: gatsby.id, authorId: fitzgerald.id },
    { bookId: mockingbird.id, authorId: lee.id },
    { bookId: nineteen84.id, authorId: orwell.id },
    { bookId: pride.id, authorId: austen.id },
    { bookId: hobbit.id, authorId: tolkien.id },
    { bookId: dune.id, authorId: herbert.id },
    { bookId: sapiens.id, authorId: harari.id },
    { bookId: design.id, authorId: norman.id },
    { bookId: cleanCode.id, authorId: martin.id },
    { bookId: thinking.id, authorId: kahneman.id },
  ]);

  console.log(`  book_authors: 10`);

  // ─── Book ↔ Category ───────────────────────────────────────
  await db.insert(bookCategories).values([
    { bookId: gatsby.id, categoryId: fiction.id },
    { bookId: gatsby.id, categoryId: classic.id },
    { bookId: mockingbird.id, categoryId: fiction.id },
    { bookId: mockingbird.id, categoryId: classic.id },
    { bookId: nineteen84.id, categoryId: fiction.id },
    { bookId: nineteen84.id, categoryId: sciFi.id },
    { bookId: pride.id, categoryId: fiction.id },
    { bookId: pride.id, categoryId: classic.id },
    { bookId: hobbit.id, categoryId: fiction.id },
    { bookId: hobbit.id, categoryId: fantasy.id },
    { bookId: dune.id, categoryId: fiction.id },
    { bookId: dune.id, categoryId: sciFi.id },
    { bookId: sapiens.id, categoryId: nonFiction.id },
    { bookId: sapiens.id, categoryId: science.id },
    { bookId: design.id, categoryId: nonFiction.id },
    { bookId: design.id, categoryId: technology.id },
    { bookId: cleanCode.id, categoryId: nonFiction.id },
    { bookId: cleanCode.id, categoryId: technology.id },
    { bookId: thinking.id, categoryId: nonFiction.id },
    { bookId: thinking.id, categoryId: psychology.id },
  ]);

  console.log(`  book_categories: 20`);

  // ─── Editions ───────────────────────────────────────────────
  const [
    gatsbyPb,
    mockingbirdPb,
    nineteen84Pb,
    nineteen84Hc,
    pridePb,
    hobbitPb,
    hobbitHc,
    dunePb,
    sapiensPb,
    designPb,
    cleanCodePb,
    thinkingPb,
  ] = await db
    .insert(editions)
    .values([
      {
        bookId: gatsby.id,
        isbn: "9780743273565",
        format: "paperback",
        publisher: "Scribner",
        publishedYear: 2004,
        pageCount: 180,
      },
      {
        bookId: mockingbird.id,
        isbn: "9780061120084",
        format: "paperback",
        publisher: "Harper Perennial",
        publishedYear: 2006,
        pageCount: 336,
      },
      {
        bookId: nineteen84.id,
        isbn: "9780451524935",
        format: "paperback",
        publisher: "Signet Classics",
        publishedYear: 1961,
        pageCount: 328,
      },
      {
        bookId: nineteen84.id,
        isbn: "9780141036144",
        format: "hardcover",
        publisher: "Penguin Books",
        publishedYear: 2008,
        pageCount: 336,
      },
      {
        bookId: pride.id,
        isbn: "9780141439518",
        format: "paperback",
        publisher: "Penguin Classics",
        publishedYear: 2002,
        pageCount: 480,
      },
      {
        bookId: hobbit.id,
        isbn: "9780547928227",
        format: "paperback",
        publisher: "Mariner Books",
        publishedYear: 2012,
        pageCount: 300,
      },
      {
        bookId: hobbit.id,
        isbn: "9780618260300",
        format: "hardcover",
        publisher: "Houghton Mifflin",
        publishedYear: 2001,
        pageCount: 320,
      },
      {
        bookId: dune.id,
        isbn: "9780441013593",
        format: "paperback",
        publisher: "Ace Books",
        publishedYear: 2005,
        pageCount: 688,
      },
      {
        bookId: sapiens.id,
        isbn: "9780062316097",
        format: "paperback",
        publisher: "Harper Perennial",
        publishedYear: 2015,
        pageCount: 464,
      },
      {
        bookId: design.id,
        isbn: "9780465050659",
        format: "paperback",
        publisher: "Basic Books",
        publishedYear: 2013,
        pageCount: 368,
      },
      {
        bookId: cleanCode.id,
        isbn: "9780132350884",
        format: "paperback",
        publisher: "Prentice Hall",
        publishedYear: 2008,
        pageCount: 464,
      },
      {
        bookId: thinking.id,
        isbn: "9780374533557",
        format: "paperback",
        publisher: "Farrar, Straus and Giroux",
        publishedYear: 2013,
        pageCount: 499,
      },
    ])
    .returning();

  console.log(`  editions: 12`);

  // ─── Quotes ─────────────────────────────────────────────────
  await db.insert(bookQuotes).values([
    {
      editionId: nineteen84Pb.id,
      text: "Who controls the past controls the future. Who controls the present controls the past.",
      chapter: "Part 1, Chapter 3",
      addedBy: USER_ID,
    },
    {
      editionId: hobbitPb.id,
      text: "It does not do to leave a live dragon out of your calculations, if you live near one.",
      chapter: "Chapter 12",
      addedBy: USER_ID,
    },
    {
      editionId: dunePb.id,
      text: "I must not fear. Fear is the mind-killer.",
      chapter: "Part 1",
      addedBy: USER_ID,
    },
  ]);

  console.log(`  book_quotes: 3`);

  // ─── Copies (user-scoped) ──────────────────────────────────
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

  const [
    copyGatsby,
    copy1984,
    copyHobbit,
    copyDune,
    copySapiens,
    copyClean,
    copyMockingbird,
    copyPride,
  ] = await db
    .insert(copies)
    .values([
      {
        userId: USER_ID,
        editionId: gatsbyPb.id,
        condition: "good",
        status: "available",
        acquisitionType: "purchased",
        shareType: "lend",
        contactNote: "DM me on the community chat",
        location: "Living room shelf",
        lastConfirmedAt: tenDaysAgo,
      },
      {
        userId: USER_ID,
        editionId: nineteen84Pb.id,
        condition: "like_new",
        status: "available",
        acquisitionType: "purchased",
        shareType: "sell",
        contactNote: "Text me at 555-0123",
        notes: "Barely read, spine is pristine",
        lastConfirmedAt: now,
      },
      {
        userId: USER_ID,
        editionId: hobbitPb.id,
        condition: "fair",
        status: "available",
        acquisitionType: "donated",
        shareType: "give_away",
        contactNote: "Pick up from downtown office",
        location: "Office",
        lastConfirmedAt: thirtyDaysAgo,
      },
      {
        userId: USER_ID,
        editionId: dunePb.id,
        condition: "good",
        status: "available",
        acquisitionType: "purchased",
        shareType: "lend",
        contactNote: "Available weekends",
        lastConfirmedAt: now,
      },
      {
        userId: USER_ID,
        editionId: sapiensPb.id,
        condition: "new",
        status: "reserved",
        acquisitionType: "purchased",
        shareType: "lend",
        contactNote: "Currently reserved for a friend",
        lastConfirmedAt: tenDaysAgo,
      },
      {
        userId: USER_ID,
        editionId: cleanCodePb.id,
        condition: "good",
        status: "available",
        acquisitionType: "purchased",
        shareType: "sell",
        contactNote: "Asking $10",
        notes: "Some highlighting in chapters 2-4",
        lastConfirmedAt: now,
      },
      {
        userId: USER_ID,
        editionId: mockingbirdPb.id,
        condition: "good",
        status: "rented",
        acquisitionType: "purchased",
        shareType: "lend",
        contactNote: "Currently lent out, back next week",
        lastConfirmedAt: tenDaysAgo,
      },
      {
        userId: USER_ID,
        editionId: pridePb.id,
        condition: "like_new",
        status: "available",
        acquisitionType: "other",
        shareType: "lend",
        contactNote: "Email me via the community board",
        location: "Bedroom shelf",
        lastConfirmedAt: now,
      },
    ])
    .returning();

  console.log(`  copies: 8`);

  // ─── Copy Events (initial "acquired" for each copy) ────────
  await db.insert(copyEvents).values([
    { userId: USER_ID, copyId: copyGatsby.id, eventType: "acquired", toStatus: "available", performedBy: USER_ID },
    { userId: USER_ID, copyId: copy1984.id, eventType: "acquired", toStatus: "available", performedBy: USER_ID },
    { userId: USER_ID, copyId: copyHobbit.id, eventType: "acquired", toStatus: "available", performedBy: USER_ID },
    { userId: USER_ID, copyId: copyDune.id, eventType: "acquired", toStatus: "available", performedBy: USER_ID },
    { userId: USER_ID, copyId: copySapiens.id, eventType: "acquired", toStatus: "available", performedBy: USER_ID },
    { userId: USER_ID, copyId: copyClean.id, eventType: "acquired", toStatus: "available", performedBy: USER_ID },
    { userId: USER_ID, copyId: copyMockingbird.id, eventType: "acquired", toStatus: "available", performedBy: USER_ID },
    { userId: USER_ID, copyId: copyPride.id, eventType: "acquired", toStatus: "available", performedBy: USER_ID },
  ]);

  console.log(`  copy_events: 8`);

  // ─── Collections ────────────────────────────────────────────
  const [favorites, toLend] = await db
    .insert(collections)
    .values([
      { userId: USER_ID, name: "Favorites", description: "Books I love the most" },
      { userId: USER_ID, name: "To Lend", description: "Books I'm happy to lend out" },
    ])
    .returning();

  await db.insert(collectionCopies).values([
    { collectionId: favorites.id, copyId: copyGatsby.id },
    { collectionId: favorites.id, copyId: copyDune.id },
    { collectionId: toLend.id, copyId: copyHobbit.id },
    { collectionId: toLend.id, copyId: copyPride.id },
  ]);

  console.log(`  collections: 2`);
  console.log(`  collection_copies: 4`);

  // ─── Wants ──────────────────────────────────────────────────
  await db.insert(wants).values([
    {
      userId: USER_ID,
      bookId: design.id,
      notes: "Looking for the revised 2013 edition",
      lastConfirmedAt: now,
    },
    {
      userId: USER_ID,
      bookId: thinking.id,
      notes: "Any edition works",
      lastConfirmedAt: tenDaysAgo,
    },
  ]);

  console.log(`  wants: 2`);

  console.log("\nDone.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
