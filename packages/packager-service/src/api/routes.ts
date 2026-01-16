import type { FastifyInstance } from 'fastify';
import { jobRoutes } from './jobs.js';

export async function registerRoutes(app: FastifyInstance) {
  // Health check
  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Job routes
  app.register(jobRoutes, { prefix: '/api/v1/jobs' });
}
