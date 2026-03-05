import { randomUUID } from "crypto";
import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { CreateCopyImagePresignDto } from "./dto";

@Injectable()
export class UploadService {
  private readonly endpoint: string;
  private readonly port: number;
  private readonly accessKey: string;
  private readonly secretKey: string;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;
  private readonly s3Client: S3Client;
  private readonly allowedTypes = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
  ]);

  constructor(private readonly configService: ConfigService) {
    this.endpoint = this.configService.getOrThrow("MINIO_ENDPOINT");
    this.port = parseInt(this.configService.getOrThrow("MINIO_PORT"), 10);
    this.accessKey = this.configService.getOrThrow("MINIO_ACCESS_KEY");
    this.secretKey = this.configService.getOrThrow("MINIO_SECRET_KEY");
    this.bucket = this.configService.getOrThrow("MINIO_BUCKET");
    this.publicBaseUrl =
      this.configService.get("PUBLIC_MINIO_URL") ?? "http://localhost:9002";

    this.s3Client = new S3Client({
      endpoint: this.publicBaseUrl,
      region: "us-east-1",
      credentials: {
        accessKeyId: this.accessKey,
        secretAccessKey: this.secretKey,
      },
      forcePathStyle: true,
    });
  }

  getUploadConfig() {
    return {
      endpoint: this.endpoint,
      port: this.port,
      bucket: this.bucket,
      useSSL: false,
    };
  }

  async createCopyImagePresign(dto: CreateCopyImagePresignDto, userId: string) {
    if (!this.allowedTypes.has(dto.contentType)) {
      throw new BadRequestException(
        "Unsupported image type. Use jpg, png, or webp."
      );
    }
    if (dto.fileSize > 5 * 1024 * 1024) {
      throw new BadRequestException("Image size must be 5MB or less.");
    }

    const safeName = dto.fileName
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, "_")
      .slice(-120);
    const objectKey = `copies/${userId}/${Date.now()}-${randomUUID()}-${safeName}`;
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
      ContentType: dto.contentType,
      ContentLength: dto.fileSize,
    });
    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: 60 * 10,
    });

    return {
      uploadUrl,
      objectKey,
      publicUrl: `${this.publicBaseUrl}/${this.bucket}/${objectKey}`,
      expiresInSeconds: 600,
    };
  }
}
