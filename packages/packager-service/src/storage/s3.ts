import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import type { StorageAdapter } from './types.js';
import { config } from '../utils/config.js';

export class S3StorageAdapter implements StorageAdapter {
  private client: S3Client;
  private bucket: string;

  constructor() {
    if (!config.s3Bucket) {
      throw new Error('S3_BUCKET is required for S3 storage');
    }

    this.bucket = config.s3Bucket;

    const clientConfig: any = {
      region: config.s3Region,
    };

    if (config.s3AccessKey && config.s3SecretKey) {
      clientConfig.credentials = {
        accessKeyId: config.s3AccessKey,
        secretAccessKey: config.s3SecretKey,
      };
    }

    if (config.s3Endpoint) {
      clientConfig.endpoint = config.s3Endpoint;
      clientConfig.forcePathStyle = true; // Required for MinIO
    }

    this.client = new S3Client(clientConfig);
  }

  async write(path: string, data: Buffer | Readable): Promise<void> {
    const body = data instanceof Buffer ? data : await this.streamToBuffer(data);

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: path,
        Body: body,
      })
    );
  }

  async read(path: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: path,
      })
    );

    if (!response.Body) {
      throw new Error(`File not found: ${path}`);
    }

    return this.streamToBuffer(response.Body as Readable);
  }

  createReadStream(path: string): Readable {
    // Create a passthrough stream that we'll pipe the S3 response to
    const { PassThrough } = require('stream');
    const passthrough = new PassThrough();

    this.client
      .send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: path,
        })
      )
      .then((response) => {
        if (response.Body) {
          (response.Body as Readable).pipe(passthrough);
        } else {
          passthrough.destroy(new Error(`File not found: ${path}`));
        }
      })
      .catch((err) => {
        passthrough.destroy(err);
      });

    return passthrough;
  }

  async exists(path: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: path,
        })
      );
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  async delete(path: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: path,
      })
    );
  }

  async list(prefix: string): Promise<string[]> {
    const files: string[] = [];
    let continuationToken: string | undefined;

    do {
      const response = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        })
      );

      if (response.Contents) {
        files.push(...response.Contents.map((obj) => obj.Key!));
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    return files;
  }

  getUrl(path: string): string {
    if (config.s3Endpoint) {
      return `${config.s3Endpoint}/${this.bucket}/${path}`;
    }
    return `https://${this.bucket}.s3.${config.s3Region}.amazonaws.com/${path}`;
  }

  async getSignedUrl(path: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: path,
    });

    return getSignedUrl(this.client, command, { expiresIn });
  }

  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
}
