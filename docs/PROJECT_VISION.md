# Bookshare

## What It Is

Bookshare is a book-sharing platform for readers in Tanzania. It exists because finding books locally is hard — bookstores carry limited stock, and ordering from Amazon means shipping fees and long waits. But among readers in the country, many of the books one person wants are already sitting on another person's shelf, unread or finished.

Bookshare makes that visible. It surfaces who has what and who is looking for what, so people can share books with each other.

## The Problem

A reader in Dar es Salaam finishes a book and puts it on a shelf where it may sit for years. Meanwhile, another reader across the city is searching for that exact title and considering paying international shipping to get it. Neither knows the other exists.

Multiply this across dozens of readers and hundreds of books, and there is a quiet inefficiency: books that could circulate are sitting still, and readers who could share are isolated.

## The Spirit

Bookshare is built on a few deliberate principles:

**Sharing, not commerce.** The platform exists to help people share books. Users can lend, give away, or sell a used copy at a fair price — but the platform handles no payments, stores no prices, and takes no cut. Any financial exchange happens entirely off-platform, between the two people involved.

**Matchmaking, not mediating.** The platform's job is to make people visible to each other: who has a book, who wants a book, where they are. Once that visibility exists, the actual exchange — the conversation, the meetup, the handoff — happens off-platform. The platform does not coordinate logistics, enforce return dates, or manage communication between users.

**Privacy by default.** The platform shows only what a user chooses to show: first name, last name, gender, avatar, and city. No email addresses, no phone numbers, no contact details are exposed by the platform. If a user wants to share how to reach them, they can do so through a note on their listing — that is their choice, not the platform's.

**No community structure.** Bookshare is not trying to build a community with leadership, meetups, or organized events. If people meet and form reading groups or organize bulk orders, that is wonderful — but it is voluntary, uncoordinated by the platform, and entirely their own affair.

**Discovery, not social networking.** The platform helps you discover books you did not know existed nearby and people who read what you read. What you do with that discovery is up to you.

## How It Works

### The Core Loop

1. A user lists a copy of a book they own, indicating whether they are willing to lend it, give it away, or sell it.
2. Another user posts a wish for a book they are looking for.
3. The platform matches wishes to listings and notifies both sides.
4. The two people figure out the rest on their own.

### Books, Editions, and Copies

The platform maintains a clean catalog of books and their editions, managed by an admin. A **book** is the canonical work — title, authors, categories. An **edition** is a specific format — paperback, hardcover, with its own ISBN, publisher, and cover. A **copy** is a user's physical instance of an edition, with a condition, a sharing type, and notes.

This separation matters because it prevents the same book from appearing multiple times with different spellings or details. The admin ensures data quality; users interact with a clean, consistent catalog.

### Adding a Copy

When a user wants to list a book they own, they submit the details through the platform. An admin reviews the submission and creates the listing — ensuring the book and edition exist in the catalog (or adding them if they do not). Once approved, the copy appears in the community library and the matching system checks for any wishes it fulfills.

### Adding a Wish

If a user is looking for a book that already exists in the catalog, they can add it to their wishlist directly. If the book is not in the catalog, they submit a request and an admin adds it. Either way, the matching system checks whether any available copies exist.

### Copy Statuses

A copy has one of four statuses:

- **Available** — The copy is on offer. Others can see it and seek it out.
- **Borrowed** — The copy is out on loan. It is temporarily unavailable but may return.
- **Shelved** — The owner is not sharing this copy right now, for whatever reason.
- **Gone** — The copy has left the owner's possession — given away, sold, or otherwise no longer theirs.

The nuance of *why* a copy changed status (who borrowed it, whether it was sold or donated) is recorded in the copy's event history, not in the status itself. The status only answers the question a browser cares about: can I get this book, and might it come back?

### Notifications

The platform sends in-app notifications when relevant things happen:

- A copy becomes available for a book on your wishlist.
- Someone wishes for a book you have listed.
- A borrowed copy you wished for is available again.

Notifications are a general-purpose system — not tied specifically to matching. The same channel can carry system announcements, stale listing reminders, or any future message type.

### The Admin Role

The admin is not a community leader. The admin is a data steward. Their job is to maintain the book catalog, review submissions, and ensure the data that enters the platform is clean and consistent. The admin does not coordinate exchanges, moderate disputes, or manage the community.

### Bulk Ordering

When multiple people wish for the same book and no copies are available, that is a natural signal for a group order — splitting shipping costs across several buyers. The platform may surface this information passively (showing how many people wish for a book with no copies listed), but it does not coordinate the ordering. Anyone can see the opportunity and organize it using whatever means they prefer.

## What Bookshare Is Not

- **Not a marketplace.** No payments, no prices, no transactions on the platform.
- **Not a social network.** No messaging, no feeds, no follower counts.
- **Not a community organization.** No leadership, no events, no meetup coordination.
- **Not a library management system.** No due dates enforced, no checkout counters, no fines.
- **Not a communication platform.** The platform does not pass messages between users.

Bookshare is a quiet, useful thing: a shared catalog where readers make their books visible to each other. Everything else — the conversations, the friendships, the group orders, the reading clubs — grows from that visibility, on its own terms.

## Geography and Scale

Bookshare is designed for Tanzania, starting with a small group of readers in Dar es Salaam but built so that anyone in the country can join. Location (city) is part of each user's profile and each copy listing, so readers can find books and people near them. The platform does not restrict sharing to any geography — someone in Dodoma can see a book listed in Mwanza — but proximity naturally makes physical sharing more practical.

## Technology

Bookshare is built as a monorepo with a clear separation of concerns:

- A **Next.js web application** for the user-facing interface.
- A **NestJS write API** for all mutations (creating copies, wishes, updating statuses).
- **PostgREST** for fast, direct read access to the database.
- **PostgreSQL** with row-level security for data isolation and privacy.
- An **Ory-based authentication system** (Hydra + Kratos) for identity management.
- A **Motia workflow engine** for background processing — matching, notifications, catalog enrichment.
- A **bulk importer** for admin-driven data population.
- **MinIO** for object storage (cover images, avatars).

The read/write split allows the platform to serve browse-heavy traffic efficiently while keeping mutations controlled and auditable.
