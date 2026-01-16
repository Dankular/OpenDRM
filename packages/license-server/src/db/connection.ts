import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';
import { config } from '../utils/config.js';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

let pool: pg.Pool | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export async function initializeDatabase() {
  pool = new Pool({
    connectionString: config.databaseUrl,
    max: 10,
  });

  // Test connection
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    logger.info('Database connection established');
  } catch (error) {
    logger.error({ error }, 'Failed to connect to database');
    throw error;
  }

  db = drizzle(pool, { schema });
  return db;
}

export function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

export function getPool() {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initializeDatabase() first.');
  }
  return pool;
}
