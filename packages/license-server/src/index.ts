import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { registerRoutes } from './api/routes.js';
import { registerMetrics } from './utils/metrics.js';
import { createGrpcServer } from './grpc/server.js';
import { initializeDatabase } from './db/connection.js';
import { logger } from './utils/logger.js';
import { config } from './utils/config.js';

async function main() {
  // Initialize database
  await initializeDatabase();

  // Create Fastify instance
  const app = Fastify({
    logger: logger,
  });

  // Register plugins
  await app.register(cors, {
    origin: config.corsOrigins,
    credentials: true,
  });

  await app.register(helmet, {
    contentSecurityPolicy: false,
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
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

  logger.info(`HTTP server listening on ${config.host}:${config.port}`);

  // Start gRPC server
  const grpcServer = await createGrpcServer();
  grpcServer.bindAsync(
    `${config.host}:${config.grpcPort}`,
    (await import('@grpc/grpc-js')).ServerCredentials.createInsecure(),
    (err, port) => {
      if (err) {
        logger.error({ err }, 'Failed to bind gRPC server');
        process.exit(1);
      }
      logger.info(`gRPC server listening on port ${port}`);
    }
  );

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down...');
    await app.close();
    grpcServer.forceShutdown();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
