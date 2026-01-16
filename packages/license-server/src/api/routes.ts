import type { FastifyInstance } from 'fastify';
import { keyRoutes } from './keys.js';
import { licenseRoutes } from './licenses.js';
import { contentRoutes } from './content.js';
import { authRoutes } from './auth.js';
import { webhookRoutes } from './webhooks.js';
import { apiKeyRoutes } from './apikeys.js';
import { openApiSpec } from './openapi.js';

export async function registerRoutes(app: FastifyInstance) {
  // Health check
  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // OpenAPI spec
  app.get('/openapi.json', async () => openApiSpec);

  // Swagger UI redirect
  app.get('/docs', async (request, reply) => {
    reply.redirect('https://petstore.swagger.io/?url=' +
      encodeURIComponent(`${request.protocol}://${request.hostname}/openapi.json`));
  });

  // API routes
  app.register(keyRoutes, { prefix: '/api/v1/keys' });
  app.register(licenseRoutes, { prefix: '/api/v1/license' });
  app.register(contentRoutes, { prefix: '/api/v1/content' });
  app.register(authRoutes, { prefix: '/api/v1/auth' });
  app.register(webhookRoutes, { prefix: '/api/v1/webhooks' });
  app.register(apiKeyRoutes, { prefix: '/api/v1/apikeys' });
}
