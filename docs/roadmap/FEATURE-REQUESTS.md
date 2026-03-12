# Bookshare - New Features Implementation

Two new features to implement at launch. Ordered by priority.

---

## Feature: Unfulfilled Wishes View

### What It Is

A view that surfaces books people are looking for that nobody has listed. It answers the most actionable question the platform can ask: "What do people need that nobody has?"

This is the platform's strongest prompt for new users to list their books. If someone sees that 6 people want a book sitting on their shelf, they will list it.

### Where It Lives

Two placements:

1. **A dedicated section on the authenticated home page.** Currently the authenticated user is redirected straight to browse. Instead, create a proper home/dashboard page that includes an "Unfulfilled Wishes" section showing the top entries - perhaps the 6-10 most wished-for books with no available copies.

2. **A filter or tab on the Community Wishlist page.** The existing `browse_wishes` PostgREST view already aggregates active wishes by book with wish counts. Add a filter mode: "Unfulfilled only" - wishes where no available copies exist for the book.

### Data

The existing `browse_wishes` view (in `infra/postgres/post-migration.sql`) already provides:

- Book details (title, subtitle, language)
- Edition details (ISBN, format, cover image, publisher, year)
- Authors (aggregated names)
- Wish count per book/edition
- Wishers array (user profiles: display name, city, avatar)

What it does **not** currently include is whether available copies exist for that book. The view needs to be extended or a new view created.

### Implementation

#### 1a. New PostgREST View: `unfulfilled_wishes`

Create a new SQL view that extends the `browse_wishes` logic with a left join against available copies, filtering to only return books where the available copy count is zero.

```sql
CREATE OR REPLACE VIEW unfulfilled_wishes AS
SELECT
    b.id AS book_id,
    b.title AS book_title,
    b.subtitle AS book_subtitle,
    COUNT(DISTINCT w.id) AS wish_count,
    json_agg(DISTINCT jsonb_build_object(
        'userId', mp.user_id,
        'displayName', mp.display_name,
        'cityArea', mp.city_area,
        'avatarUrl', mp.avatar_url
    )) AS wishers,
    string_agg(DISTINCT a.name, ', ') AS author_names,
    MIN(w.created_at) AS first_wished_at
FROM wishes w
JOIN books b ON b.id = w.book_id
JOIN member_profiles mp ON mp.user_id = w.user_id
LEFT JOIN book_authors ba ON ba.book_id = b.id
LEFT JOIN authors a ON a.id = ba.author_id
LEFT JOIN editions e ON e.book_id = b.id
LEFT JOIN copies c ON c.edition_id = e.id AND c.status = 'available'
WHERE w.status = 'active'
GROUP BY b.id, b.title, b.subtitle
HAVING COUNT(c.id) = 0
ORDER BY wish_count DESC, first_wished_at ASC;
```

Grant SELECT to `postgrest_auth`.

**Key design choice:** Order by wish count descending, then by how long the wish has gone unfulfilled. Books wanted by many people for a long time float to the top.

**Note:** The SQL above is illustrative. Column names and join patterns should be tuned to match the exact schema (e.g., actual column casing, RLS helper functions). Use the existing `browse_wishes` view as the reference pattern.

#### 1b. Authenticated Home Page

Create a new authenticated home/dashboard page at `apps/web/src/app/(app)/home/page.tsx` (or repurpose the app layout's default route).

This page should include:

- **"Books People Are Looking For" section** - Fetches from `unfulfilled_wishes` view via PostgREST, shows top 6-10 entries as cards. Each card shows: cover image (if available from any edition), book title, authors, wish count ("Wished for by 5 people"), and how long it has been wanted ("First wished for 3 months ago"). Clicking navigates to the book detail page.
- **A "See all" link** that goes to the Community Wishlist page filtered to unfulfilled only.

**Query pattern** (matches existing codebase conventions):

```typescript
// In apps/web/src/shared/queries/unfulfilled-wishes.ts
export function useUnfulfilledWishes(limit = 10) {
    return useQuery({
        queryKey: ["unfulfilled-wishes", limit],
        queryFn: async () => {
            const params = new URLSearchParams();
            params.set("select", "*");
            params.set("order", "wish_count.desc,first_wished_at.asc");
            params.set("limit", String(limit));
            const res = await postgrestFetch(`/unfulfilled_wishes?${params}`);
            return res;
        },
    });
}
```

#### 1c. Community Wishlist Page Enhancement

On the existing Community Wishlist page (currently `/wanted`, to be renamed `/community-wishlist`), add a toggle or filter: **"Show only unfulfilled wishes"**. When active, query `unfulfilled_wishes` instead of `browse_wishes`.

This lets users deliberately browse what is needed and not available - a different intent from browsing all wishes.

### Areas Affected

| Area | What Changes |
|---|---|
| `infra/postgres/post-migration.sql` | New `unfulfilled_wishes` view |
| `apps/web/src/app/(app)/` | New authenticated home page (or update default route) |
| `apps/web/src/shared/queries/` | New `useUnfulfilledWishes` hook |
| `apps/web/src/app/(app)/community-wishlist/` | Add "unfulfilled only" filter |
| `apps/web/src/shared/components/` | New `UnfulfilledWishCard` component |

### Edge Cases

- **Zero wishes exist yet.** At launch the wishlist may be empty. The home page should handle this gracefully - show an encouraging empty state like "No wishes yet. Be the first to share what you are looking for."
- **A copy is listed after the view is loaded.** The view is eventually consistent. No real-time requirement - the next page load reflects the change.
- **A book has wishes but all copies are Borrowed (not Available).** These should still appear as unfulfilled - no available copy means the wish cannot be immediately met. However, consider a secondary note: "1 copy exists but is currently borrowed" - this tells the wisher the book is in the community and may return. This can be a future enhancement to the view (count borrowed copies alongside available ones).

---

## Feature 2: Books in Motion

### What It Is

A lightweight activity feed showing that books are moving through the community. Not who specifically - just what is happening and where. "A copy of Sapiens was just shared in Dar es Salaam." "Someone in Dodoma is looking for Atomic Habits."

It gives the platform a pulse. A new user arrives and sees activity, and the platform feels alive. Without it, a quiet catalog looks dead even if it has good data.

### What It Shows

The feed surfaces two kinds of activity:

1. **Copy events** - A book was listed, lent, given away, returned. These come from the `copy_events` table.
2. **New wishes** - Someone posted a wish for a book. These come from the `wishes` table creation timestamps.

Each entry in the feed shows:

- **What happened** - "A copy was shared", "A book was lent", "Someone is looking for..."
- **Which book** - Title and cover image.
- **Where** - The city of the person involved (from their profile). Not their name.
- **When** - Relative timestamp ("2 hours ago", "yesterday").

### Privacy

The feed is deliberately anonymized. It shows the city (from `member_profiles.city_area`) but not the user's name, avatar, or any identifying information. The goal is to show that the platform is active, not to expose who did what.

### Implementation

#### 2a. New PostgREST View: `books_in_motion`

A unified view that merges recent copy events and new wishes into a single chronological feed.

```sql
CREATE OR REPLACE VIEW books_in_motion AS

-- Copy events (listed, lent, returned, given_away, sold, donated)
SELECT
    ce.id AS event_id,
    'copy_event' AS feed_type,
    ce.event_type,
    ce.created_at,
    b.id AS book_id,
    b.title AS book_title,
    e.cover_image_url,
    mp.city_area,
    CASE ce.event_type
        WHEN 'listed' THEN 'A new copy was listed'
        WHEN 'lent' THEN 'A copy was lent out'
        WHEN 'returned' THEN 'A copy was returned'
        WHEN 'given_away' THEN 'A copy was shared'
        WHEN 'sold' THEN 'A copy found a new home'
        WHEN 'donated' THEN 'A copy was donated'
        ELSE 'A copy was updated'
    END AS description
FROM copy_events ce
JOIN copies c ON c.id = ce.copy_id
JOIN editions e ON e.id = c.edition_id
JOIN books b ON b.id = e.book_id
JOIN member_profiles mp ON mp.user_id = ce.user_id
WHERE ce.event_type IN ('listed', 'lent', 'returned', 'given_away', 'sold', 'donated')

UNION ALL

-- New wishes
SELECT
    w.id AS event_id,
    'wish' AS feed_type,
    'wished' AS event_type,
    w.created_at,
    b.id AS book_id,
    b.title AS book_title,
    (SELECT e2.cover_image_url FROM editions e2 WHERE e2.book_id = b.id LIMIT 1) AS cover_image_url,
    mp.city_area,
    'Someone is looking for this book' AS description
FROM wishes w
JOIN books b ON b.id = w.book_id
JOIN member_profiles mp ON mp.user_id = w.user_id
WHERE w.status = 'active'

ORDER BY created_at DESC;
```

Grant SELECT to `postgrest_auth`.

**Design notes:**

- The `description` field is generated in SQL so the frontend does not need to map event types to labels.
- The view excludes noisy events like `condition_changed`, `note_added`, `status_changed` (generic) - only events that represent meaningful activity.
- "A copy was shared" (given_away) and "A copy found a new home" (sold) use warm language rather than transactional terms.
- No user names or IDs are exposed in the view output - only `city_area`.
- The SQL is illustrative. Column names should be tuned to match the exact schema.

#### 2b. Home Page Integration

Add a **"Books in Motion"** section to the authenticated home page (same page as the Unfulfilled Wishes section). This section shows the most recent 8-12 feed entries.

**Layout suggestion:** The home page has two sections:

1. **"Books People Are Looking For"** (Unfulfilled Wishes) - top section, card grid.
2. **"Books in Motion"** - below, as a vertical timeline/list.

Each feed entry is a compact row:

```
[Cover thumbnail]  "A copy was shared"          Dar es Salaam  .  2 hours ago
                   Sapiens - Yuval Noah Harari
```

Clicking a feed entry navigates to the book detail page.

**Query pattern:**

```typescript
// In apps/web/src/shared/queries/books-in-motion.ts
export function useBooksInMotion(limit = 12) {
    return useQuery({
        queryKey: ["books-in-motion", limit],
        queryFn: async () => {
            const params = new URLSearchParams();
            params.set("select", "*");
            params.set("order", "created_at.desc");
            params.set("limit", String(limit));
            const res = await postgrestFetch(`/books_in_motion?${params}`);
            return res;
        },
        // Refresh periodically to keep the feed current
        refetchInterval: 60_000,  // every 60 seconds
    });
}
```

#### 2c. Optional: Dedicated Activity Page

If the feed becomes popular or the data grows, consider a dedicated `/activity` page with the full feed, paginated. At launch, the home page section is sufficient.

### Areas Affected

| Area | What Changes |
|---|---|
| `infra/postgres/post-migration.sql` | New `books_in_motion` view |
| `apps/web/src/app/(app)/home/` | Books in Motion section on home page |
| `apps/web/src/shared/queries/` | New `useBooksInMotion` hook |
| `apps/web/src/shared/components/` | New `MotionFeedItem` component |

### Edge Cases

- **Platform is brand new, no events yet.** Show an encouraging empty state: "No activity yet. List a book to get things moving." This is especially important at launch - the feed will be empty until people start using the platform.
- **Burst of activity from bulk import.** If the admin imports 50 books at once, the feed becomes all "A new copy was listed" entries from the same moment. Consider filtering: if more than N events share the same timestamp (within a few seconds), collapse them into "Several new copies were just listed." Or: exclude import-originated events from the feed by checking a flag or source in the event metadata.
- **Deleted copies.** If a copy is deleted, its events may still be in the feed via the view. The cascade delete on `copy_events` handles this - when a copy is deleted, its events are deleted too, so they disappear from the feed automatically.
- **Privacy of "sold" events.** Showing "A copy found a new home" for a sold book is fine - it does not reveal price or buyer. But if the event metadata contains counterparty info, ensure the view never exposes it. The SQL above only selects `city_area`, which is safe.

---

## Implementation Order

1. **Create the authenticated home page shell.** Before either feature, the home page needs to exist. Currently authenticated users land on browse. Create the home page with placeholder sections.

2. **Build Unfulfilled Wishes View.** Create the SQL view, the query hook, the card component, and wire it into the home page. This is the highest-value feature and can work independently.

3. **Build Books in Motion.** Create the SQL view, the query hook, the feed item component, and wire it into the home page below the wishes section. This depends on having enough event data to be meaningful - even a few entries will help.

Both features are read-only views over existing data. No new write paths, no new events, no new tables (just views). This makes them low-risk to ship.
