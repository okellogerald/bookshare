import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { extname } from "node:path";
import { isValidIsbn, normalizeIsbn } from "./isbn";

export const MAX_COVER_BYTES = 5 * 1024 * 1024;

export type CoverExtension = "jpg" | "jpeg" | "png" | "webp";
const COVER_EXTENSIONS: readonly CoverExtension[] = [
  "jpg",
  "jpeg",
  "png",
  "webp",
] as const;

const EXTENSION_TO_CONTENT_TYPE: Record<CoverExtension, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export class CoverImageError extends Error {
  readonly code:
    | "cover_storage_config_missing"
    | "cover_too_large"
    | "invalid_cover_content_type"
    | "cover_upload_failed";

  constructor(code: CoverImageError["code"], message: string) {
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

function parseEndpointUrl(rawEndpoint: string, rawPort: string): string {
  const endpoint = rawEndpoint.trim();
  const port = rawPort.trim();
  if (!endpoint) {
    throw new CoverImageError(
      "cover_storage_config_missing",
      "MINIO_ENDPOINT is required for cover uploads"
    );
  }

  if (endpoint.startsWith("http://") || endpoint.startsWith("https://")) {
    const parsed = new URL(endpoint);
    if (!parsed.port && port) parsed.port = port;
    return trimTrailingSlash(parsed.toString());
  }

  if (endpoint.includes(":")) {
    return `http://${endpoint}`;
  }

  if (!port) {
    throw new CoverImageError(
      "cover_storage_config_missing",
      "MINIO_PORT is required for cover uploads when MINIO_ENDPOINT has no port"
    );
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

export function normalizeCoverFileIsbn(value: string): string | null {
  const normalized = normalizeIsbn(value);
  if (!normalized) return null;
  if (!(normalized.length === 10 || normalized.length === 13)) return null;
  if (!isValidIsbn(normalized)) return null;
  return normalized;
}

export function coverExtensionFromFileName(fileName: string): CoverExtension | null {
  const extension = extname(fileName).toLowerCase().replace(/^\./, "");
  if (!extension) return null;
  if (!COVER_EXTENSIONS.includes(extension as CoverExtension)) return null;
  return extension as CoverExtension;
}

export function contentTypeForCoverExtension(extension: CoverExtension): string {
  return EXTENSION_TO_CONTENT_TYPE[extension];
}

export function buildEditionCoverObjectKey(
  normalizedOrRawIsbn: string,
  extension: CoverExtension
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

  async uploadBuffer(params: {
    isbn: string;
    extension: CoverExtension;
    bytes: Buffer;
  }): Promise<UploadedCoverResult> {
    const contentType = contentTypeForCoverExtension(params.extension);
    if (!contentType) {
      throw new CoverImageError(
        "invalid_cover_content_type",
        `Unsupported image extension '${params.extension}'`
      );
    }
    if (params.bytes.length > MAX_COVER_BYTES) {
      throw new CoverImageError(
        "cover_too_large",
        `Cover image is too large (${params.bytes.length} bytes). Max is ${MAX_COVER_BYTES} bytes`
      );
    }

    const objectKey = buildEditionCoverObjectKey(params.isbn, params.extension);

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: objectKey,
          Body: params.bytes,
          ContentType: contentType,
          ContentLength: params.bytes.length,
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
      bytes: params.bytes.length,
      contentType,
    };
  }
}

export function createEditionCoverStorageFromEnv(): EditionCoverStorage {
  return new EditionCoverStorage(readCoverStorageConfigFromEnv());
}
