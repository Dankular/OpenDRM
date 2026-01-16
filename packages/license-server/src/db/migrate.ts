import pg from 'pg';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

const migrations = [
  {
    name: '001_initial_schema',
    up: `
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

      CREATE TABLE IF NOT EXISTS keys (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        key_id VARCHAR(32) NOT NULL UNIQUE,
        key_value TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        expires_at TIMESTAMP,
        status VARCHAR(20) DEFAULT 'active' NOT NULL
      );

      CREATE INDEX IF NOT EXISTS keys_key_id_idx ON keys(key_id);
      CREATE INDEX IF NOT EXISTS keys_status_idx ON keys(status);

      CREATE TABLE IF NOT EXISTS policies (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        rules JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS content (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        content_id VARCHAR(255) NOT NULL UNIQUE,
        title VARCHAR(500),
        key_id UUID REFERENCES keys(id),
        policy_id UUID REFERENCES policies(id),
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE INDEX IF NOT EXISTS content_content_id_idx ON content(content_id);

      CREATE TABLE IF NOT EXISTS license_requests (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        content_id UUID REFERENCES content(id),
        drm_type VARCHAR(20) NOT NULL,
        client_ip INET,
        user_agent TEXT,
        granted BOOLEAN NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE INDEX IF NOT EXISTS license_requests_created_at_idx ON license_requests(created_at);
      CREATE INDEX IF NOT EXISTS license_requests_drm_type_idx ON license_requests(drm_type);

      CREATE TABLE IF NOT EXISTS migrations (
        name VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `,
  },
];

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const client = await pool.connect();

  try {
    // Ensure migrations table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        name VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);

    // Get applied migrations
    const { rows } = await client.query('SELECT name FROM migrations');
    const appliedMigrations = new Set(rows.map((r) => r.name));

    // Apply new migrations
    for (const migration of migrations) {
      if (!appliedMigrations.has(migration.name)) {
        logger.info(`Applying migration: ${migration.name}`);
        await client.query('BEGIN');
        try {
          await client.query(migration.up);
          await client.query('INSERT INTO migrations (name) VALUES ($1)', [migration.name]);
          await client.query('COMMIT');
          logger.info(`Migration ${migration.name} applied successfully`);
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        }
      }
    }

    logger.info('All migrations applied');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
