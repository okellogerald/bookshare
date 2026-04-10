export interface PgBookWithAuthorsView {
  id: string;
  title: string;
  subtitle: string | null;
  language: string;
  authors: Array<{ id: string; name: string }>;
}
