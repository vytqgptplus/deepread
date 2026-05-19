import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

/**
 * MinIO client provider for object storage.
 * Handles file upload/download operations with MinIO S3-compatible storage.
 */
@Injectable()
export class MinioProvider implements OnModuleInit {
  private readonly logger = new Logger(MinioProvider.name);
  private client: Minio.Client;
  private readonly bucketName = 'deepread-books';

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.configService.get<string>('MINIO_ENDPOINT', 'localhost') || 'localhost';
    const portStr = this.configService.get<string>('MINIO_PORT', '9440') || '9440';
    const port = parseInt(portStr, 10);
    const useSSLStr = this.configService.get<string>('MINIO_USE_SSL', 'false') || 'false';
    const useSSL = useSSLStr.toLowerCase() === 'true';
    const accessKey = this.configService.get<string>('MINIO_ACCESS_KEY', 'deepread') || 'deepread';
    const secretKey = this.configService.get<string>('MINIO_SECRET_KEY', 'deepread_secret_123') || 'deepread_secret_123';

    this.client = new Minio.Client({
      endPoint: endpoint,
      port: port,
      useSSL: useSSL,
      accessKey: accessKey,
      secretKey: secretKey,
    });
  }

  async onModuleInit() {
    try {
      const exists = await this.client.bucketExists(this.bucketName);
      if (!exists) {
        await this.client.makeBucket(this.bucketName);
        this.logger.log(`Bucket ${this.bucketName} created`);
      }
      this.logger.log('MinIO client initialized');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`MinIO initialization warning: ${message}`);
    }
  }

  /**
   * Upload a file to MinIO.
   */
  async upload(
    objectName: string,
    buffer: Buffer,
    contentType: string,
    size: number,
  ): Promise<string> {
    try {
      await this.client.putObject(
        this.bucketName,
        objectName,
        buffer,
        size,
        { 'Content-Type': contentType },
      );
      this.logger.log(`File uploaded: ${objectName}`);
      return objectName;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Upload failed: ${message}`);
      throw error;
    }
  }

  /**
   * Get file stream from MinIO.
   */
  async getStream(objectName: string): Promise<NodeJS.ReadableStream> {
    return this.client.getObject(this.bucketName, objectName);
  }

  /**
   * Delete a file from MinIO.
   */
  async delete(objectName: string): Promise<void> {
    try {
      await this.client.removeObject(this.bucketName, objectName);
      this.logger.log(`File deleted: ${objectName}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Delete failed: ${message}`);
      throw error;
    }
  }

  /**
   * Check if file exists.
   */
  async exists(objectName: string): Promise<boolean> {
    try {
      await this.client.statObject(this.bucketName, objectName);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get presigned URL for temporary access.
   */
  async getPresignedUrl(objectName: string, expiry = 3600): Promise<string> {
    return this.client.presignedGetObject(this.bucketName, objectName, expiry);
  }

  /**
   * Get file metadata.
   */
  async getMetadata(objectName: string): Promise<Minio.BucketItemStat> {
    return this.client.statObject(this.bucketName, objectName);
  }
}
