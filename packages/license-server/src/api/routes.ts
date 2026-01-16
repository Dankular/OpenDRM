import type { FastifyInstance } from 'fastify';
import { keyRoutes } from './keys.js';
import { licenseRoutes } from './licenses.js';
import { contentRoutes } from './content.js';
import { authRoutes } from './auth.js';

export async function registerRoutes(app: FastifyInstance) {
  // Health check
  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // API routes
  app.register(keyRoutes, { prefix: '/api/v1/keys' });
  app.register(licenseRoutes, { prefix: '/api/v1/license' });
  app.register(contentRoutes, { prefix: '/api/v1/content' });
  app.register(authRoutes, { prefix: '/api/v1/auth' });
}
