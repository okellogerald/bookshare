import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class UploadService {
  private readonly endpoint: string;
  private readonly port: number;
  private readonly accessKey: string;
  private readonly secretKey: string;
  private readonly bucket: string;

  constructor(private readonly configService: ConfigService) {
    this.endpoint = this.configService.getOrThrow("MINIO_ENDPOINT");
    this.port = parseInt(this.configService.getOrThrow("MINIO_PORT"), 10);
    this.accessKey = this.configService.getOrThrow("MINIO_ACCESS_KEY");
    this.secretKey = this.configService.getOrThrow("MINIO_SECRET_KEY");
    this.bucket = this.configService.getOrThrow("MINIO_BUCKET");
  }

  getUploadConfig() {
    return {
      endpoint: this.endpoint,
      port: this.port,
      bucket: this.bucket,
      useSSL: false,
    };
  }
}
