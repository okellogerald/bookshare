UPDATE "wants" AS w
SET
  "status" = 'fulfilled',
  "fulfilled_at" = COALESCE(w."fulfilled_at", now()),
  "fulfilled_by_copy_id" = c.id,
  "fulfilled_by_user_id" = c.user_id
FROM "copies" AS c
JOIN "editions" AS e ON e.id = c.edition_id
JOIN "copy_loans" AS cl
  ON cl.copy_id = c.id
 AND cl.returned_at IS NULL
 AND cl.counterparty_type = 'member'
 AND cl.counterparty_user_id IS NOT NULL
WHERE c.status = 'lent'
  AND w.status = 'active'
  AND w.user_id = cl.counterparty_user_id
  AND w.book_id = e.book_id
  AND (w.edition_id IS NULL OR w.edition_id = e.id);--> statement-breakpoint
