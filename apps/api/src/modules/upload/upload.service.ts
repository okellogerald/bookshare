import { randomUUID } from "crypto";
import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  CreateCopyImagePresignDto,
  CreateEditionCoverPresignDto,
  CreateProfileAvatarPresignDto,
} from "./dto";

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
    return this.createImagePresign("copies", dto, userId);
  }

  async createSubmissionCopyImagePresign(
    dto: CreateCopyImagePresignDto,
    userId: string
  ) {
    return this.createImagePresign("submissions/copy-requests", dto, userId);
  }

  async createEditionCoverPresign(
    dto: CreateEditionCoverPresignDto,
    userId: string
  ) {
    return this.createImagePresign("edition-covers", dto, userId);
  }

  async createProfileAvatarPresign(
    dto: CreateProfileAvatarPresignDto,
    userId: string
  ) {
    return this.createImagePresign("profile-avatars", dto, userId);
  }

  private async createImagePresign(
    directory: string,
    dto: {
      fileName: string;
      contentType: string;
      fileSize: number;
    },
    userId: string
  ) {
    this.validateImageUpload(dto.contentType, dto.fileSize);
    const safeName = this.sanitizeFileName(dto.fileName);
    const objectKey = `${directory}/${userId}/${Date.now()}-${randomUUID()}-${safeName}`;
    const uploadUrl = await this.generateUploadUrl(
      objectKey,
      dto.contentType,
      dto.fileSize
    );

    return {
      uploadUrl,
      objectKey,
      publicUrl: `${this.publicBaseUrl}/${this.bucket}/${objectKey}`,
      expiresInSeconds: 600,
    };
  }

  private validateImageUpload(contentType: string, fileSize: number) {
    if (!this.allowedTypes.has(contentType)) {
      throw new BadRequestException(
        "Unsupported image type. Use jpg, png, or webp."
      );
    }
    if (fileSize > 5 * 1024 * 1024) {
      throw new BadRequestException("Image size must be 5MB or less.");
    }
  }

  private sanitizeFileName(fileName: string) {
    return fileName
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, "_")
      .slice(-120);
  }

  private async generateUploadUrl(
    objectKey: string,
    contentType: string,
    fileSize: number
  ) {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
      ContentType: contentType,
      ContentLength: fileSize,
    });
    return getSignedUrl(this.s3Client, command, {
      expiresIn: 60 * 10,
    });
  }
}
