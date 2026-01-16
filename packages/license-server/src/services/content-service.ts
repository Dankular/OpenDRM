import { eq } from 'drizzle-orm';
import { getDb } from '../db/connection.js';
import { content, keys, policies, PolicyRules } from '../db/schema.js';
import { logger } from '../utils/logger.js';

export interface RegisterContentOptions {
  contentId: string;
  title?: string;
  keyId?: string;
  policyId?: string;
}

export interface ContentInfo {
  id: string;
  contentId: string;
  title: string | null;
  keyId: string | null;
  policyId: string | null;
  createdAt: Date;
}

/**
 * Registers new content in the system
 */
export async function registerContent(options: RegisterContentOptions): Promise<ContentInfo> {
  const db = getDb();

  // Verify key exists if provided
  if (options.keyId) {
    const [keyRecord] = await db
      .select({ id: keys.id })
      .from(keys)
      .where(eq(keys.keyId, options.keyId))
      .limit(1);

    if (!keyRecord) {
      throw new Error(`Key not found: ${options.keyId}`);
    }
  }

  const [record] = await db
    .insert(content)
    .values({
      contentId: options.contentId,
      title: options.title,
      // Need to look up the UUID for the key
      keyId: options.keyId
        ? (
            await db
              .select({ id: keys.id })
              .from(keys)
              .where(eq(keys.keyId, options.keyId))
              .limit(1)
          )[0]?.id
        : undefined,
      policyId: options.policyId,
    })
    .returning();

  logger.info({ contentId: options.contentId }, 'Content registered');

  return {
    id: record.id,
    contentId: record.contentId,
    title: record.title,
    keyId: record.keyId,
    policyId: record.policyId,
    createdAt: record.createdAt,
  };
}

/**
 * Gets content information by content ID
 */
export async function getContent(contentId: string): Promise<ContentInfo | null> {
  const db = getDb();

  const [record] = await db
    .select()
    .from(content)
    .where(eq(content.contentId, contentId))
    .limit(1);

  return record || null;
}

/**
 * Updates content policy
 */
export async function updateContentPolicy(
  contentId: string,
  policyId: string
): Promise<ContentInfo | null> {
  const db = getDb();

  const [record] = await db
    .update(content)
    .set({ policyId })
    .where(eq(content.contentId, contentId))
    .returning();

  if (record) {
    logger.info({ contentId, policyId }, 'Content policy updated');
  }

  return record || null;
}

/**
 * Creates a new access policy
 */
export async function createPolicy(
  name: string,
  rules: PolicyRules
): Promise<{ id: string; name: string; rules: PolicyRules }> {
  const db = getDb();

  const [record] = await db
    .insert(policies)
    .values({ name, rules })
    .returning();

  logger.info({ policyId: record.id, name }, 'Policy created');

  return {
    id: record.id,
    name: record.name,
    rules: record.rules,
  };
}

/**
 * Validates if a request meets policy requirements
 */
export async function validatePolicy(
  policyId: string,
  context: {
    country?: string;
    deviceType?: string;
    isSecure?: boolean;
  }
): Promise<{ allowed: boolean; reason?: string }> {
  const db = getDb();

  const [policy] = await db
    .select()
    .from(policies)
    .where(eq(policies.id, policyId))
    .limit(1);

  if (!policy) {
    return { allowed: false, reason: 'Policy not found' };
  }

  const rules = policy.rules;

  // Check country restrictions
  if (context.country) {
    if (rules.allowedCountries && !rules.allowedCountries.includes(context.country)) {
      return { allowed: false, reason: 'Country not allowed' };
    }
    if (rules.blockedCountries && rules.blockedCountries.includes(context.country)) {
      return { allowed: false, reason: 'Country blocked' };
    }
  }

  // Check device type
  if (context.deviceType && rules.allowedDeviceTypes) {
    if (!rules.allowedDeviceTypes.includes(context.deviceType)) {
      return { allowed: false, reason: 'Device type not allowed' };
    }
  }

  // Check time restrictions
  const now = new Date();
  if (rules.validFrom && new Date(rules.validFrom) > now) {
    return { allowed: false, reason: 'Content not yet available' };
  }
  if (rules.validUntil && new Date(rules.validUntil) < now) {
    return { allowed: false, reason: 'Content no longer available' };
  }

  // Check secure connection requirement
  if (rules.requireSecureConnection && !context.isSecure) {
    return { allowed: false, reason: 'Secure connection required' };
  }

  return { allowed: true };
}
