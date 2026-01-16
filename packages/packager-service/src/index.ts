import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { registerRoutes } from './api/routes.js';
import { initializeQueue, closeQueue } from './workers/queue.js';
import { registerMetrics } from './utils/metrics.js';
import { logger } from './utils/logger.js';
import { config } from './utils/config.js';

async function main() {
  // Initialize job queue
  await initializeQueue();

  // Create Fastify instance
  const app = Fastify({
    logger: logger,
  });

  // Register plugins
  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024 * 1024, // 10GB max file size
    },
  });

  // Register routes
  await registerRoutes(app);

  // Register metrics endpoint
  await registerMetrics(app);

  // Start HTTP server
  await app.listen({
    host: config.host,
    port: config.port,
  });

  logger.info(`Packager service listening on ${config.host}:${config.port}`);

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down...');
    await app.close();
    await closeQueue();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('Failed to start packager service:', err);
  process.exit(1);
});
