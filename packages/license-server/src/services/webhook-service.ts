/**
 * Webhook service for sending events to external systems
 */

import { createHmac } from 'crypto';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/connection.js';
import { webhooks, webhookDeliveries } from '../db/schema.js';
import { logger } from '../utils/logger.js';

export type WebhookEvent =
  | 'key.created'
  | 'key.revoked'
  | 'license.issued'
  | 'license.denied'
  | 'content.registered'
  | 'content.updated';

export interface WebhookPayload {
  id: string;
  event: WebhookEvent;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface CreateWebhookOptions {
  url: string;
  events: WebhookEvent[];
  secret?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Create a new webhook subscription
 */
export async function createWebhook(options: CreateWebhookOptions) {
  const db = getDb();

  // Generate secret if not provided
  const secret = options.secret || generateSecret();

  const [webhook] = await db
    .insert(webhooks)
    .values({
      url: options.url,
      events: options.events,
      secret,
      metadata: options.metadata,
    })
    .returning();

  logger.info({ webhookId: webhook.id, url: options.url }, 'Webhook created');

  return {
    ...webhook,
    secret, // Return secret only on creation
  };
}

/**
 * List all webhooks
 */
export async function listWebhooks() {
  const db = getDb();
  return db.select().from(webhooks).where(eq(webhooks.status, 'active'));
}

/**
 * Get webhook by ID
 */
export async function getWebhook(id: string) {
  const db = getDb();
  const [webhook] = await db.select().from(webhooks).where(eq(webhooks.id, id)).limit(1);
  return webhook;
}

/**
 * Delete/disable a webhook
 */
export async function deleteWebhook(id: string) {
  const db = getDb();
  await db.update(webhooks).set({ status: 'disabled' }).where(eq(webhooks.id, id));
}

/**
 * Dispatch an event to all subscribed webhooks
 */
export async function dispatchEvent(event: WebhookEvent, data: Record<string, unknown>) {
  const db = getDb();

  // Get all active webhooks subscribed to this event
  const subscribedWebhooks = await db
    .select()
    .from(webhooks)
    .where(eq(webhooks.status, 'active'));

  const matchingWebhooks = subscribedWebhooks.filter((w) =>
    (w.events as WebhookEvent[]).includes(event)
  );

  if (matchingWebhooks.length === 0) {
    return;
  }

  const payload: WebhookPayload = {
    id: crypto.randomUUID(),
    event,
    timestamp: new Date().toISOString(),
    data,
  };

  // Dispatch to all matching webhooks (async, don't await)
  for (const webhook of matchingWebhooks) {
    deliverWebhook(webhook, payload).catch((err) => {
      logger.error({ err, webhookId: webhook.id }, 'Webhook delivery failed');
    });
  }

  logger.info({ event, webhookCount: matchingWebhooks.length }, 'Event dispatched');
}

/**
 * Deliver a webhook with retries
 */
async function deliverWebhook(
  webhook: { id: string; url: string; secret: string },
  payload: WebhookPayload,
  attempt = 1
): Promise<void> {
  const maxAttempts = 3;
  const db = getDb();

  const body = JSON.stringify(payload);
  const signature = signPayload(body, webhook.secret);

  const startTime = Date.now();

  try {
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-OpenDRM-Signature': signature,
        'X-OpenDRM-Event': payload.event,
        'X-OpenDRM-Delivery': payload.id,
        'User-Agent': 'OpenDRM-Webhook/1.0',
      },
      body,
      signal: AbortSignal.timeout(30000), // 30s timeout
    });

    const duration = Date.now() - startTime;

    // Log delivery
    await db.insert(webhookDeliveries).values({
      webhookId: webhook.id,
      event: payload.event,
      payload,
      responseStatus: response.status,
      responseBody: await response.text().catch(() => ''),
      duration,
      attempt,
      success: response.ok,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    logger.debug(
      { webhookId: webhook.id, event: payload.event, duration },
      'Webhook delivered'
    );
  } catch (error) {
    const duration = Date.now() - startTime;

    // Log failed delivery
    await db.insert(webhookDeliveries).values({
      webhookId: webhook.id,
      event: payload.event,
      payload,
      responseStatus: 0,
      responseBody: error instanceof Error ? error.message : 'Unknown error',
      duration,
      attempt,
      success: false,
    });

    // Retry with exponential backoff
    if (attempt < maxAttempts) {
      const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
      logger.warn(
        { webhookId: webhook.id, attempt, delay },
        'Webhook delivery failed, retrying'
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      return deliverWebhook(webhook, payload, attempt + 1);
    }

    logger.error(
      { webhookId: webhook.id, event: payload.event },
      'Webhook delivery failed after max retries'
    );
  }
}

/**
 * Sign payload with HMAC-SHA256
 */
function signPayload(payload: string, secret: string): string {
  const hmac = createHmac('sha256', secret);
  hmac.update(payload);
  return `sha256=${hmac.digest('hex')}`;
}

/**
 * Verify webhook signature (for documentation/SDK)
 */
export function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expected = signPayload(payload, secret);
  return signature === expected;
}

/**
 * Generate a random webhook secret
 */
function generateSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
