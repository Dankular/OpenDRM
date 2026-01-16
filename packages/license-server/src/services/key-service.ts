import { eq } from 'drizzle-orm';
import { getDb } from '../db/connection.js';
import { keys } from '../db/schema.js';
import { encryptKey, generateDrmKey, generateKeyId } from '../utils/crypto.js';
import { logger } from '../utils/logger.js';

export interface CreateKeyOptions {
  expiresAt?: Date;
}

export interface KeyInfo {
  id: string;
  keyId: string;
  createdAt: Date;
  expiresAt: Date | null;
  status: string;
}

/**
 * Creates a new DRM encryption key
 */
export async function createKey(options: CreateKeyOptions = {}): Promise<KeyInfo & { keyValue: string }> {
  const db = getDb();

  // Generate key ID and value
  const keyId = generateKeyId();
  const keyValue = generateDrmKey();

  // Encrypt the key for storage
  const encryptedKey = encryptKey(keyValue);

  // Store in database
  const [record] = await db
    .insert(keys)
    .values({
      keyId,
      keyValue: encryptedKey.toString('base64'),
      expiresAt: options.expiresAt,
    })
    .returning();

  logger.info({ keyId }, 'Created new encryption key');

  return {
    id: record.id,
    keyId: record.keyId,
    keyValue: keyValue.toString('hex'), // Return plaintext key for packaging
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
    status: record.status,
  };
}

/**
 * Gets key metadata (not the actual key value)
 */
export async function getKeyInfo(keyId: string): Promise<KeyInfo | null> {
  const db = getDb();

  const [record] = await db
    .select({
      id: keys.id,
      keyId: keys.keyId,
      createdAt: keys.createdAt,
      expiresAt: keys.expiresAt,
      status: keys.status,
    })
    .from(keys)
    .where(eq(keys.keyId, keyId))
    .limit(1);

  return record || null;
}

/**
 * Revokes a key (marks it as revoked)
 */
export async function revokeKey(keyId: string): Promise<boolean> {
  const db = getDb();

  const result = await db
    .update(keys)
    .set({ status: 'revoked' })
    .where(eq(keys.keyId, keyId))
    .returning({ id: keys.id });

  if (result.length > 0) {
    logger.info({ keyId }, 'Key revoked');
    return true;
  }

  return false;
}

/**
 * Lists all keys with pagination
 */
export async function listKeys(
  limit: number = 50,
  offset: number = 0
): Promise<{ keys: KeyInfo[]; total: number }> {
  const db = getDb();

  const allKeys = await db
    .select({
      id: keys.id,
      keyId: keys.keyId,
      createdAt: keys.createdAt,
      expiresAt: keys.expiresAt,
      status: keys.status,
    })
    .from(keys)
    .limit(limit)
    .offset(offset);

  // Get total count
  const countResult = await db.select({ count: keys.id }).from(keys);
  const total = countResult.length;

  return { keys: allKeys, total };
}
