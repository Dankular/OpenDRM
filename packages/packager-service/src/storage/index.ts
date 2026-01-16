import type { StorageAdapter } from './types.js';
import { LocalStorageAdapter } from './local.js';
import { S3StorageAdapter } from './s3.js';
import { config } from '../utils/config.js';
import { logger } from '../utils/logger.js';

export type { StorageAdapter } from './types.js';

let storageInstance: StorageAdapter | null = null;

/**
 * Get the configured storage adapter
 */
export function getStorage(): StorageAdapter {
  if (storageInstance) {
    return storageInstance;
  }

  switch (config.storageBackend) {
    case 'local':
      logger.info({ path: config.localStoragePath }, 'Using local storage');
      storageInstance = new LocalStorageAdapter();
      break;

    case 's3':
      logger.info({ bucket: config.s3Bucket }, 'Using S3 storage');
      storageInstance = new S3StorageAdapter();
      break;

    case 'gcs':
      // Lazy import to avoid loading the SDK if not needed
      throw new Error('GCS storage not yet implemented');

    case 'azure':
      // Lazy import to avoid loading the SDK if not needed
      throw new Error('Azure storage not yet implemented');

    default:
      throw new Error(`Unknown storage backend: ${config.storageBackend}`);
  }

  return storageInstance;
}
