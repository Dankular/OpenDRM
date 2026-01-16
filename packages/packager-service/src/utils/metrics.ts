import type { FastifyInstance } from 'fastify';
import client from 'prom-client';

// Create a Registry
const register = new client.Registry();

// Add default metrics
client.collectDefaultMetrics({ register });

// Custom metrics
export const packagingJobsTotal = new client.Counter({
  name: 'opendrm_packaging_jobs_total',
  help: 'Total number of packaging jobs',
  labelNames: ['status'],
  registers: [register],
});

export const packagingJobDuration = new client.Histogram({
  name: 'opendrm_packaging_job_duration_seconds',
  help: 'Duration of packaging jobs in seconds',
  labelNames: ['format'],
  buckets: [10, 30, 60, 120, 300, 600, 1200, 3600],
  registers: [register],
});

export const packagingQueueSize = new client.Gauge({
  name: 'opendrm_packaging_queue_size',
  help: 'Current number of jobs in the packaging queue',
  registers: [register],
});

export const storageOperationsTotal = new client.Counter({
  name: 'opendrm_storage_operations_total',
  help: 'Total number of storage operations',
  labelNames: ['operation', 'backend'],
  registers: [register],
});

/**
 * Register metrics endpoint with Fastify
 */
export async function registerMetrics(app: FastifyInstance) {
  app.get('/metrics', async (request, reply) => {
    reply.header('Content-Type', register.contentType);
    return register.metrics();
  });
}
