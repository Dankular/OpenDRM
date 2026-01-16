import { Readable } from 'stream';

/**
 * Common interface for all storage adapters
 */
export interface StorageAdapter {
  /**
   * Write a file to storage
   */
  write(path: string, data: Buffer | Readable): Promise<void>;

  /**
   * Read a file from storage
   */
  read(path: string): Promise<Buffer>;

  /**
   * Create a readable stream for a file
   */
  createReadStream(path: string): Readable;

  /**
   * Check if a file exists
   */
  exists(path: string): Promise<boolean>;

  /**
   * Delete a file
   */
  delete(path: string): Promise<void>;

  /**
   * List files in a directory
   */
  list(prefix: string): Promise<string[]>;

  /**
   * Get the public URL for a file (if supported)
   */
  getUrl(path: string): string;

  /**
   * Get signed URL for temporary access (if supported)
   */
  getSignedUrl?(path: string, expiresIn: number): Promise<string>;
}
