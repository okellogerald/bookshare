/**
 * ISBN Lookup Step
 *
 * When an edition is created with an ISBN, fetches metadata from
 * the OpenLibrary API and auto-fills fields like publisher, year,
 * page count, and cover image URL.
 *
 * Trigger: edition.created event (with isbn present)
 * Output: Updated edition data from OpenLibrary
 */

export const config = {
  name: "ISBN Lookup",
  description: "Fetch book metadata from OpenLibrary by ISBN",
  triggers: [{ type: "queue", topic: "edition.created" }],
  enqueues: ["edition.enriched"],
} as const;

interface IsbnLookupInput {
  editionId: string;
  isbn: string;
}

interface OpenLibraryResponse {
  title?: string;
  publishers?: string[];
  publish_date?: string;
  number_of_pages?: number;
  covers?: number[];
}

export async function handler(input: IsbnLookupInput, { enqueue, logger }: any) {
  const { editionId, isbn } = input;

  logger.info(`Looking up ISBN: ${isbn}`);

  try {
    const response = await fetch(
      `https://openlibrary.org/isbn/${isbn}.json`
    );

    if (!response.ok) {
      logger.warn(`OpenLibrary returned ${response.status} for ISBN ${isbn}`);
      return;
    }

    const data: OpenLibraryResponse = await response.json();

    const enrichedData = {
      editionId,
      publisher: data.publishers?.[0] ?? null,
      publishedYear: data.publish_date
        ? parseInt(data.publish_date.match(/\d{4}/)?.[0] ?? "", 10) || null
        : null,
      pageCount: data.number_of_pages ?? null,
      coverImageUrl: data.covers?.[0]
        ? `https://covers.openlibrary.org/b/id/${data.covers[0]}-L.jpg`
        : null,
    };

    logger.info(`Enriched edition ${editionId} from OpenLibrary`);

    await enqueue({ topic: "edition.enriched", data: enrichedData });
  } catch (error) {
    logger.error(`Failed to look up ISBN ${isbn}:`, error);
  }
}
