-- BISAC taxonomy (strictly 2 levels):
--   Level 1 = BISAC major group
--   Level 2 = BISAC heading

INSERT INTO "categories" ("name", "slug")
VALUES
  ('FICTION', 'bisac-fiction'),
  ('BIOGRAPHY & AUTOBIOGRAPHY', 'bisac-biography-autobiography'),
  ('SOCIAL SCIENCE', 'bisac-social-science'),
  ('PSYCHOLOGY', 'bisac-psychology'),
  ('DRAMA', 'bisac-drama'),
  ('POETRY', 'bisac-poetry'),
  ('COMPUTERS', 'bisac-computers')
ON CONFLICT ("slug") DO UPDATE
SET
  "name" = EXCLUDED."name",
  "parent_id" = NULL;

INSERT INTO "categories" ("name", "slug", "parent_id")
SELECT
  leaf."name",
  leaf."slug",
  parent."id"
FROM (
  VALUES
    ('FICTION / Classics', 'bisac-fiction-classics', 'bisac-fiction'),
    ('FICTION / Literary', 'bisac-fiction-literary', 'bisac-fiction'),
    ('FICTION / Historical / General', 'bisac-fiction-historical-general', 'bisac-fiction'),
    ('FICTION / Dystopian', 'bisac-fiction-dystopian', 'bisac-fiction'),
    ('FICTION / Fantasy / General', 'bisac-fiction-fantasy-general', 'bisac-fiction'),
    ('FICTION / Science Fiction / General', 'bisac-fiction-science-fiction-general', 'bisac-fiction'),
    ('FICTION / Magical Realism', 'bisac-fiction-magical-realism', 'bisac-fiction'),
    ('FICTION / Thrillers / Suspense', 'bisac-fiction-thrillers-suspense', 'bisac-fiction'),
    ('FICTION / Satire', 'bisac-fiction-satire', 'bisac-fiction'),
    ('BIOGRAPHY & AUTOBIOGRAPHY / Personal Memoirs', 'bisac-biography-autobiography-personal-memoirs', 'bisac-biography-autobiography'),
    ('SOCIAL SCIENCE / Anthropology / Cultural & Social', 'bisac-social-science-anthropology-cultural-social', 'bisac-social-science'),
    ('PSYCHOLOGY / Cognitive Psychology', 'bisac-psychology-cognitive-psychology', 'bisac-psychology'),
    ('DRAMA / General', 'bisac-drama-general', 'bisac-drama'),
    ('POETRY / General', 'bisac-poetry-general', 'bisac-poetry'),
    ('COMPUTERS / User Interfaces', 'bisac-computers-user-interfaces', 'bisac-computers'),
    ('COMPUTERS / Programming / General', 'bisac-computers-programming-general', 'bisac-computers'),
    ('COMPUTERS / Software Development & Engineering / General', 'bisac-computers-software-development-engineering-general', 'bisac-computers')
) AS leaf("name", "slug", "parent_slug")
INNER JOIN "categories" AS parent
  ON parent."slug" = leaf."parent_slug"
ON CONFLICT ("slug") DO UPDATE
SET
  "name" = EXCLUDED."name",
  "parent_id" = EXCLUDED."parent_id";

CREATE TEMP TABLE "tmp_bisac_title_map" (
  "title" varchar(500) PRIMARY KEY,
  "leaf_slug" varchar(255) NOT NULL
) ON COMMIT DROP;

INSERT INTO "tmp_bisac_title_map" ("title", "leaf_slug")
VALUES
  ('A Farewell to Arms', 'bisac-fiction-historical-general'),
  ('A Thousand Splendid Suns', 'bisac-fiction-historical-general'),
  ('Americanah', 'bisac-fiction-literary'),
  ('Animal Farm', 'bisac-fiction-satire'),
  ('Anna Karenina', 'bisac-fiction-classics'),
  ('Beloved', 'bisac-fiction-literary'),
  ('Blood Meridian', 'bisac-fiction-literary'),
  ('Brave New World', 'bisac-fiction-dystopian'),
  ('Catch-22', 'bisac-fiction-satire'),
  ('Crime and Punishment', 'bisac-fiction-classics'),
  ('Don Quixote', 'bisac-fiction-classics'),
  ('East of Eden', 'bisac-fiction-literary'),
  ('Educated', 'bisac-biography-autobiography-personal-memoirs'),
  ('Half of a Yellow Sun', 'bisac-fiction-historical-general'),
  ('Hamlet', 'bisac-drama-general'),
  ('Harry Potter and the Philosopher''s Stone', 'bisac-fiction-fantasy-general'),
  ('In Search of Lost Time', 'bisac-fiction-classics'),
  ('Invisible Man', 'bisac-fiction-literary'),
  ('Life of Pi', 'bisac-fiction-literary'),
  ('Lolita', 'bisac-fiction-classics'),
  ('Midnight''s Children', 'bisac-fiction-magical-realism'),
  ('Moby-Dick', 'bisac-fiction-classics'),
  ('Nineteen Eighty-Four', 'bisac-fiction-dystopian'),
  ('1984', 'bisac-fiction-dystopian'),
  ('No Country for Old Men', 'bisac-fiction-thrillers-suspense'),
  ('Normal People', 'bisac-fiction-literary'),
  ('Of Mice and Men', 'bisac-fiction-classics'),
  ('One Hundred Years of Solitude', 'bisac-fiction-magical-realism'),
  ('Pride and Prejudice', 'bisac-fiction-classics'),
  ('Sapiens: A Brief History of Humankind', 'bisac-social-science-anthropology-cultural-social'),
  ('Slaughterhouse-Five', 'bisac-fiction-science-fiction-general'),
  ('The Alchemist', 'bisac-fiction-magical-realism'),
  ('The Book Thief', 'bisac-fiction-historical-general'),
  ('The Brothers Karamazov', 'bisac-fiction-classics'),
  ('The Catcher in the Rye', 'bisac-fiction-classics'),
  ('The Color Purple', 'bisac-fiction-literary'),
  ('The Grapes of Wrath', 'bisac-fiction-classics'),
  ('The Great Gatsby', 'bisac-fiction-classics'),
  ('The Hitchhiker''s Guide to the Galaxy', 'bisac-fiction-science-fiction-general'),
  ('The Kite Runner', 'bisac-fiction-historical-general'),
  ('The Lord of the Rings', 'bisac-fiction-fantasy-general'),
  ('The Odyssey', 'bisac-poetry-general'),
  ('The Old Man and the Sea', 'bisac-fiction-classics'),
  ('The Road', 'bisac-fiction-dystopian'),
  ('The Sun Also Rises', 'bisac-fiction-classics'),
  ('Their Eyes Were Watching God', 'bisac-fiction-classics'),
  ('Things Fall Apart', 'bisac-fiction-classics'),
  ('Thinking, Fast and Slow', 'bisac-psychology-cognitive-psychology'),
  ('To Kill a Mockingbird', 'bisac-fiction-classics'),
  ('Ulysses', 'bisac-fiction-classics'),
  ('War and Peace', 'bisac-fiction-classics'),
  ('The Design of Everyday Things', 'bisac-computers-user-interfaces'),
  ('Clean Code', 'bisac-computers-software-development-engineering-general'),
  ('The Hobbit', 'bisac-fiction-fantasy-general'),
  ('Dune', 'bisac-fiction-science-fiction-general');

DELETE FROM "book_categories" AS bc
USING "books" AS b
INNER JOIN "tmp_bisac_title_map" AS map
  ON map."title" = b."title"
WHERE bc."book_id" = b."id";

INSERT INTO "book_categories" ("book_id", "category_id")
SELECT
  links."book_id",
  links."category_id"
FROM (
  SELECT
    b."id" AS "book_id",
    leaf."id" AS "category_id"
  FROM "books" AS b
  INNER JOIN "tmp_bisac_title_map" AS map
    ON map."title" = b."title"
  INNER JOIN "categories" AS leaf
    ON leaf."slug" = map."leaf_slug"

  UNION

  SELECT
    b."id" AS "book_id",
    parent."id" AS "category_id"
  FROM "books" AS b
  INNER JOIN "tmp_bisac_title_map" AS map
    ON map."title" = b."title"
  INNER JOIN "categories" AS leaf
    ON leaf."slug" = map."leaf_slug"
  INNER JOIN "categories" AS parent
    ON parent."id" = leaf."parent_id"
) AS links
ON CONFLICT DO NOTHING;
