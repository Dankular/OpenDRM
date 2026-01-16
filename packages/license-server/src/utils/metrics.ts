import type { FastifyInstance } from 'fastify';
import client from 'prom-client';

// Create a Registry
const register = new client.Registry();

// Add default metrics (CPU, memory, etc.)
client.collectDefaultMetrics({ register });

// Custom metrics
export const licenseRequestsTotal = new client.Counter({
  name: 'opendrm_license_requests_total',
  help: 'Total number of license requests',
  labelNames: ['drm_type', 'status'],
  registers: [register],
});

export const licenseRequestDuration = new client.Histogram({
  name: 'opendrm_license_request_duration_seconds',
  help: 'Duration of license requests in seconds',
  labelNames: ['drm_type'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

export const activeKeysGauge = new client.Gauge({
  name: 'opendrm_active_keys',
  help: 'Number of active encryption keys',
  registers: [register],
});

export const contentRegisteredGauge = new client.Gauge({
  name: 'opendrm_content_registered',
  help: 'Number of registered content items',
  registers: [register],
});

export const keyOperationsTotal = new client.Counter({
  name: 'opendrm_key_operations_total',
  help: 'Total number of key operations',
  labelNames: ['operation'],
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

/**
 * Record a license request metric
 */
export function recordLicenseRequest(drmType: string, granted: boolean, duration: number) {
  licenseRequestsTotal.inc({
    drm_type: drmType,
    status: granted ? 'granted' : 'denied',
  });
  licenseRequestDuration.observe({ drm_type: drmType }, duration);
}

/**
 * Record a key operation metric
 */
export function recordKeyOperation(operation: 'create' | 'revoke' | 'retrieve') {
  keyOperationsTotal.inc({ operation });
}
