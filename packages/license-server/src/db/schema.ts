import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  boolean,
  jsonb,
  inet,
  text,
  index,
  integer,
} from 'drizzle-orm/pg-core';

export const keys = pgTable(
  'keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    keyId: varchar('key_id', { length: 32 }).notNull().unique(),
    keyValue: text('key_value').notNull(), // Encrypted, stored as base64
    createdAt: timestamp('created_at').defaultNow().notNull(),
    expiresAt: timestamp('expires_at'),
    status: varchar('status', { length: 20 }).default('active').notNull(),
  },
  (table) => ({
    keyIdIdx: index('keys_key_id_idx').on(table.keyId),
    statusIdx: index('keys_status_idx').on(table.status),
  })
);

export const policies = pgTable('policies', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  rules: jsonb('rules').notNull().$type<PolicyRules>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const content = pgTable(
  'content',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    contentId: varchar('content_id', { length: 255 }).notNull().unique(),
    title: varchar('title', { length: 500 }),
    keyId: uuid('key_id').references(() => keys.id),
    policyId: uuid('policy_id').references(() => policies.id),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    contentIdIdx: index('content_content_id_idx').on(table.contentId),
  })
);

export const licenseRequests = pgTable(
  'license_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    contentId: uuid('content_id').references(() => content.id),
    drmType: varchar('drm_type', { length: 20 }).notNull(),
    clientIp: inet('client_ip'),
    userAgent: text('user_agent'),
    granted: boolean('granted').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    createdAtIdx: index('license_requests_created_at_idx').on(table.createdAt),
    drmTypeIdx: index('license_requests_drm_type_idx').on(table.drmType),
  })
);

// Webhooks for external integrations
export const webhooks = pgTable(
  'webhooks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    url: text('url').notNull(),
    events: jsonb('events').notNull().$type<string[]>(),
    secret: text('secret').notNull(),
    status: varchar('status', { length: 20 }).default('active').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    lastDeliveryAt: timestamp('last_delivery_at'),
  },
  (table) => ({
    statusIdx: index('webhooks_status_idx').on(table.status),
  })
);

// Webhook delivery log
export const webhookDeliveries = pgTable(
  'webhook_deliveries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    webhookId: uuid('webhook_id').references(() => webhooks.id).notNull(),
    event: varchar('event', { length: 50 }).notNull(),
    payload: jsonb('payload').notNull(),
    responseStatus: integer('response_status'),
    responseBody: text('response_body'),
    duration: integer('duration'), // ms
    attempt: integer('attempt').default(1).notNull(),
    success: boolean('success').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    webhookIdIdx: index('webhook_deliveries_webhook_id_idx').on(table.webhookId),
    createdAtIdx: index('webhook_deliveries_created_at_idx').on(table.createdAt),
  })
);

// API Keys for external integrations
export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    keyHash: text('key_hash').notNull(), // Hashed API key
    keyPrefix: varchar('key_prefix', { length: 12 }).notNull(), // e.g., "sk_live_abc"
    scopes: jsonb('scopes').notNull().$type<string[]>(),
    status: varchar('status', { length: 20 }).default('active').notNull(),
    lastUsedAt: timestamp('last_used_at'),
    expiresAt: timestamp('expires_at'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    keyPrefixIdx: index('api_keys_key_prefix_idx').on(table.keyPrefix),
    statusIdx: index('api_keys_status_idx').on(table.status),
  })
);

// Type definitions for policy rules
export interface PolicyRules {
  allowedCountries?: string[];
  blockedCountries?: string[];
  allowedDeviceTypes?: string[];
  validFrom?: string;
  validUntil?: string;
  maxConcurrentStreams?: number;
  requireSecureConnection?: boolean;
}
