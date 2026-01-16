import { eq } from 'drizzle-orm';
import { getDb } from '../db/connection.js';
import { keys, content, licenseRequests } from '../db/schema.js';
import { decryptKey, hexToBase64Url, base64UrlToHex } from '../utils/crypto.js';
import { logger } from '../utils/logger.js';

/**
 * ClearKey License Request format per EME specification
 * https://www.w3.org/TR/encrypted-media/#clear-key-request-format
 */
interface ClearKeyRequest {
  kids: string[]; // Base64url-encoded key IDs
  type: 'temporary' | 'persistent-license';
}

/**
 * ClearKey License Response format per EME specification
 */
interface ClearKeyResponse {
  keys: Array<{
    kty: 'oct';
    kid: string; // Base64url-encoded key ID
    k: string; // Base64url-encoded key value
  }>;
  type: 'temporary' | 'persistent-license';
}

interface LicenseContext {
  clientIp: string;
  userAgent: string;
  token?: string;
}

/**
 * Process a ClearKey license request and return the appropriate keys
 */
export async function handleClearKeyRequest(
  request: ClearKeyRequest,
  context: LicenseContext
): Promise<ClearKeyResponse> {
  const db = getDb();
  const responseKeys: ClearKeyResponse['keys'] = [];

  logger.info({ kids: request.kids, type: request.type }, 'Processing ClearKey request');

  for (const kidBase64 of request.kids) {
    // Convert base64url kid to hex for database lookup
    const kidHex = base64UrlToHex(kidBase64);

    // Look up the key in the database
    const keyRecord = await db
      .select()
      .from(keys)
      .where(eq(keys.keyId, kidHex))
      .limit(1);

    if (keyRecord.length === 0) {
      logger.warn({ kid: kidHex }, 'Key not found');
      continue;
    }

    const key = keyRecord[0];

    // Check if key is active
    if (key.status !== 'active') {
      logger.warn({ kid: kidHex, status: key.status }, 'Key is not active');
      continue;
    }

    // Check if key has expired
    if (key.expiresAt && new Date(key.expiresAt) < new Date()) {
      logger.warn({ kid: kidHex, expiresAt: key.expiresAt }, 'Key has expired');
      continue;
    }

    // Decrypt the key value
    const encryptedKey = Buffer.from(key.keyValue, 'base64');
    const decryptedKey = decryptKey(encryptedKey);

    // Add to response
    responseKeys.push({
      kty: 'oct',
      kid: kidBase64,
      k: decryptedKey.toString('base64url'),
    });

    logger.debug({ kid: kidHex }, 'Key found and decrypted');
  }

  // Log the license request for analytics
  // Note: We'd need to look up content by key to properly log this
  await db.insert(licenseRequests).values({
    drmType: 'clearkey',
    clientIp: context.clientIp,
    userAgent: context.userAgent,
    granted: responseKeys.length > 0,
  });

  return {
    keys: responseKeys,
    type: request.type,
  };
}

/**
 * Validate a ClearKey license request format
 */
export function validateClearKeyRequest(body: unknown): ClearKeyRequest | null {
  if (!body || typeof body !== 'object') {
    return null;
  }

  const obj = body as Record<string, unknown>;

  if (!Array.isArray(obj.kids) || obj.kids.length === 0) {
    return null;
  }

  // Validate each kid is a valid base64url string
  for (const kid of obj.kids) {
    if (typeof kid !== 'string' || !/^[A-Za-z0-9_-]+$/.test(kid)) {
      return null;
    }
  }

  const type = obj.type === 'persistent-license' ? 'persistent-license' : 'temporary';

  return {
    kids: obj.kids as string[],
    type,
  };
}
