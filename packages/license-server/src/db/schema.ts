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
