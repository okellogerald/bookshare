/**
 * Build a display name for a category.
 * With Thema, the name from the database is already the canonical label.
 */
export function getCategoryDisplayName(name: string) {
  return name.trim();
}
