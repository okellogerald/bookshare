import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { normalizeIsbn } from "./isbn";

const MAX_COVER_BYTES = 5 * 1024 * 1024;
const CONTENT_TYPE_TO_EXTENSION = new Map<string, "jpg" | "png" | "webp">([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export class CoverImageError extends Error {
  readonly code:
    | "invalid_cover_url"
    | "cover_fetch_failed"
    | "invalid_cover_content_type"
    | "cover_too_large"
    | "cover_upload_failed"
    | "cover_storage_config_missing";

  constructor(
    code: CoverImageError["code"],
    message: string
  ) {
    super(message);
    this.code = code;
  }
}

interface CoverStorageConfig {
  endpointUrl: string;
  publicBaseUrl: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
}

export interface UploadedCoverResult {
  objectKey: string;
  publicUrl: string;
  bytes: number;
  contentType: string;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function normalizeContentType(value: string | null): string {
  if (!value) return "";
  return value.split(";")[0]!.trim().toLowerCase();
}

function parseEndpointUrl(rawEndpoint: string, rawPort: string): string {
  const endpoint = rawEndpoint.trim();
  const port = rawPort.trim();
  if (!endpoint) {
    throw new CoverImageError(
      "cover_storage_config_missing",
      "MINIO_ENDPOINT is required for cover uploads"
    );
  }
  if (!port) {
    throw new CoverImageError(
      "cover_storage_config_missing",
      "MINIO_PORT is required for cover uploads"
    );
  }

  if (endpoint.startsWith("http://") || endpoint.startsWith("https://")) {
    const parsed = new URL(endpoint);
    if (!parsed.port) {
      parsed.port = port;
    }
    return trimTrailingSlash(parsed.toString());
  }

  return `http://${endpoint}:${port}`;
}

function readCoverStorageConfigFromEnv(): CoverStorageConfig {
  const endpointUrl = parseEndpointUrl(
    process.env.MINIO_ENDPOINT ?? "",
    process.env.MINIO_PORT ?? ""
  );
  const accessKey = (process.env.MINIO_ACCESS_KEY ?? "").trim();
  const secretKey = (process.env.MINIO_SECRET_KEY ?? "").trim();
  const bucket = (process.env.MINIO_BUCKET ?? "").trim();

  if (!accessKey) {
    throw new CoverImageError(
      "cover_storage_config_missing",
      "MINIO_ACCESS_KEY is required for cover uploads"
    );
  }
  if (!secretKey) {
    throw new CoverImageError(
      "cover_storage_config_missing",
      "MINIO_SECRET_KEY is required for cover uploads"
    );
  }
  if (!bucket) {
    throw new CoverImageError(
      "cover_storage_config_missing",
      "MINIO_BUCKET is required for cover uploads"
    );
  }

  const publicBaseUrl = trimTrailingSlash(
    process.env.PUBLIC_MINIO_URL?.trim() || endpointUrl
  );

  return {
    endpointUrl,
    publicBaseUrl,
    accessKey,
    secretKey,
    bucket,
  };
}

export function parseCoverSourceUrl(value: string): URL | null {
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function extensionForContentType(value: string): "jpg" | "png" | "webp" | null {
  const normalized = normalizeContentType(value);
  return CONTENT_TYPE_TO_EXTENSION.get(normalized) ?? null;
}

export function buildEditionCoverObjectKey(
  normalizedOrRawIsbn: string,
  extension: "jpg" | "png" | "webp"
): string {
  const isbn = normalizeIsbn(normalizedOrRawIsbn);
  return `edition-covers/${isbn}.${extension}`;
}

export class EditionCoverStorage {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor(config: CoverStorageConfig) {
    this.bucket = config.bucket;
    this.publicBaseUrl = config.publicBaseUrl;
    this.client = new S3Client({
      endpoint: config.endpointUrl,
      region: "us-east-1",
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey,
      },
      forcePathStyle: true,
    });
  }

  async uploadFromSource(params: {
    isbn: string;
    sourceUrl: string;
  }): Promise<UploadedCoverResult> {
    const parsedSourceUrl = parseCoverSourceUrl(params.sourceUrl);
    if (!parsedSourceUrl) {
      throw new CoverImageError(
        "invalid_cover_url",
        `cover_image_url '${params.sourceUrl}' must be a valid http/https URL`
      );
    }

    let response: Response;
    try {
      response = await fetch(parsedSourceUrl.toString(), {
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch cover image";
      throw new CoverImageError("cover_fetch_failed", message);
    }

    if (!response.ok) {
      throw new CoverImageError(
        "cover_fetch_failed",
        `Cover URL responded with HTTP ${response.status}`
      );
    }

    const contentTypeRaw = response.headers.get("content-type");
    const extension = extensionForContentType(contentTypeRaw ?? "");
    if (!extension) {
      throw new CoverImageError(
        "invalid_cover_content_type",
        `Unsupported image content-type '${contentTypeRaw ?? "unknown"}'`
      );
    }

    const contentLengthRaw = response.headers.get("content-length");
    if (contentLengthRaw) {
      const headerBytes = Number.parseInt(contentLengthRaw, 10);
      if (Number.isFinite(headerBytes) && headerBytes > MAX_COVER_BYTES) {
        throw new CoverImageError(
          "cover_too_large",
          `Cover image is too large (${headerBytes} bytes). Max is ${MAX_COVER_BYTES} bytes`
        );
      }
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0) {
      throw new CoverImageError("cover_fetch_failed", "Cover image is empty");
    }
    if (bytes.length > MAX_COVER_BYTES) {
      throw new CoverImageError(
        "cover_too_large",
        `Cover image is too large (${bytes.length} bytes). Max is ${MAX_COVER_BYTES} bytes`
      );
    }

    const contentType = normalizeContentType(contentTypeRaw);
    const objectKey = buildEditionCoverObjectKey(params.isbn, extension);

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: objectKey,
          Body: bytes,
          ContentType: contentType,
          ContentLength: bytes.length,
        })
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to upload cover image";
      throw new CoverImageError("cover_upload_failed", message);
    }

    return {
      objectKey,
      publicUrl: `${this.publicBaseUrl}/${this.bucket}/${objectKey}`,
      bytes: bytes.length,
      contentType,
    };
  }
}

export function createEditionCoverStorageFromEnv(): EditionCoverStorage {
  return new EditionCoverStorage(readCoverStorageConfigFromEnv());
}

export { MAX_COVER_BYTES };
