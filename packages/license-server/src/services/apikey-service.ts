/**
 * API Key service for external integrations
 */

import { createHash, randomBytes } from 'crypto';
import { eq, and } from 'drizzle-orm';
import { getDb } from '../db/connection.js';
import { apiKeys } from '../db/schema.js';
import { logger } from '../utils/logger.js';

export interface CreateApiKeyOptions {
  name: string;
  scopes?: string[];
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface ApiKeyInfo {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  status: string;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
}

const DEFAULT_SCOPES = ['keys:read', 'keys:write', 'content:read', 'content:write', 'license:issue'];

/**
 * Generate a new API key
 */
export async function createApiKey(options: CreateApiKeyOptions): Promise<ApiKeyInfo & { key: string }> {
  const db = getDb();

  // Generate key: sk_live_<32 random chars>
  const keyBytes = randomBytes(24);
  const keyValue = keyBytes.toString('base64url');
  const fullKey = `sk_live_${keyValue}`;
  const keyPrefix = fullKey.substring(0, 12);

  // Hash the key for storage
  const keyHash = hashApiKey(fullKey);

  const [record] = await db
    .insert(apiKeys)
    .values({
      name: options.name,
      keyHash,
      keyPrefix,
      scopes: options.scopes || DEFAULT_SCOPES,
      expiresAt: options.expiresAt,
      metadata: options.metadata,
    })
    .returning();

  logger.info({ apiKeyId: record.id, name: options.name }, 'API key created');

  return {
    id: record.id,
    name: record.name,
    key: fullKey, // Only returned on creation
    keyPrefix: record.keyPrefix,
    scopes: record.scopes as string[],
    status: record.status,
    lastUsedAt: record.lastUsedAt,
    expiresAt: record.expiresAt,
    createdAt: record.createdAt,
  };
}

/**
 * Validate an API key and return its info
 */
export async function validateApiKey(key: string): Promise<ApiKeyInfo | null> {
  const db = getDb();

  const keyHash = hashApiKey(key);

  const [record] = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.status, 'active')))
    .limit(1);

  if (!record) {
    return null;
  }

  // Check expiration
  if (record.expiresAt && new Date(record.expiresAt) < new Date()) {
    return null;
  }

  // Update last used timestamp (async, don't await)
  db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, record.id))
    .catch(() => {});

  return {
    id: record.id,
    name: record.name,
    keyPrefix: record.keyPrefix,
    scopes: record.scopes as string[],
    status: record.status,
    lastUsedAt: record.lastUsedAt,
    expiresAt: record.expiresAt,
    createdAt: record.createdAt,
  };
}

/**
 * Check if an API key has a specific scope
 */
export function hasScope(apiKey: ApiKeyInfo, scope: string): boolean {
  return apiKey.scopes.includes(scope) || apiKey.scopes.includes('*');
}

/**
 * List all API keys (without the actual key values)
 */
export async function listApiKeys(): Promise<ApiKeyInfo[]> {
  const db = getDb();

  const records = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.status, 'active'));

  return records.map((r) => ({
    id: r.id,
    name: r.name,
    keyPrefix: r.keyPrefix,
    scopes: r.scopes as string[],
    status: r.status,
    lastUsedAt: r.lastUsedAt,
    expiresAt: r.expiresAt,
    createdAt: r.createdAt,
  }));
}

/**
 * Revoke an API key
 */
export async function revokeApiKey(id: string): Promise<boolean> {
  const db = getDb();

  const result = await db
    .update(apiKeys)
    .set({ status: 'revoked' })
    .where(eq(apiKeys.id, id))
    .returning({ id: apiKeys.id });

  if (result.length > 0) {
    logger.info({ apiKeyId: id }, 'API key revoked');
    return true;
  }

  return false;
}

/**
 * Hash an API key for secure storage
 */
function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}
