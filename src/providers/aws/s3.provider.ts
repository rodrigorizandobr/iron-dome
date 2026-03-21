import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { BaseProvider } from '../base.provider';

/**
 * AWS S3 Provider for object storage operations.
 *
 * @example
 * ```typescript
 * constructor(private readonly s3: S3Provider) {}
 * const bucket = this.s3.getBucketName('documents');
 * await this.s3.upload(bucket, 'file.pdf', buffer);
 * ```
 */
@Injectable()
export class S3Provider extends BaseProvider {
  private client: S3Client;

  constructor(protected readonly configService: ConfigService) {
    super(S3Provider.name, configService);
    this.client = new S3Client({ ...this.getAwsConfig(), forcePathStyle: true });
  }

  /**
   * Returns a bucket name based on its functional purpose.
   *
   * @param functionalName - The purpose of the bucket (e.g., 'storage', 'documents').
   * @returns The full bucket name: `dev-fintech-core-s3-storage`
   */
  getBucketName(functionalName: string = 'storage'): string {
    return this.getResourceName('s3', functionalName);
  }

  /**
   * Uploads an object to an S3 bucket.
   *
   * @param bucket - The bucket name.
   * @param key - The object key (file path).
   * @param body - The file content.
   */
  async upload(bucket: string, key: string, body: Buffer | string) {
    this.logOperation('upload', { bucket, key });
    try {
      const command = new PutObjectCommand({ Bucket: bucket, Key: key, Body: body });
      return await this.client.send(command);
    } catch (error) {
      this.handleError('upload', error);
    }
  }

  /**
   * Retrieves an object from an S3 bucket.
   *
   * @param bucket - The bucket name.
   * @param key - The object key (file path).
   */
  async getObject(bucket: string, key: string) {
    this.logOperation('getObject', { bucket, key });
    try {
      const command = new GetObjectCommand({ Bucket: bucket, Key: key });
      return await this.client.send(command);
    } catch (error) {
      this.handleError('getObject', error);
    }
  }
}
