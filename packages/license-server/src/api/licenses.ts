import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { handleClearKeyRequest, validateClearKeyRequest } from '../handlers/clearkey.js';
import { handleWidevineRequest, isWidevineConfigured } from '../handlers/widevine.js';
import { handleFairPlayRequest, getFairPlayCertificate, isFairPlayConfigured } from '../handlers/fairplay.js';
import { extractBearerToken, validateToken } from '../services/auth-service.js';
import { logger } from '../utils/logger.js';

export async function licenseRoutes(app: FastifyInstance) {
  // ClearKey license endpoint (EME-compatible)
  app.post('/clearkey', async (request: FastifyRequest, reply: FastifyReply) => {
    const clearKeyRequest = validateClearKeyRequest(request.body);

    if (!clearKeyRequest) {
      return reply.status(400).send({ error: 'Invalid ClearKey request format' });
    }

    // Optional token validation
    const token = extractBearerToken(request.headers.authorization);
    if (token) {
      const payload = await validateToken(token);
      if (!payload) {
        return reply.status(401).send({ error: 'Invalid token' });
      }
      // Could validate that requested kids match token's keyIds
    }

    const clientIp = request.ip || request.headers['x-forwarded-for'] as string || 'unknown';
    const userAgent = request.headers['user-agent'] || 'unknown';

    const response = await handleClearKeyRequest(clearKeyRequest, {
      clientIp,
      userAgent,
      token: token || undefined,
    });

    // Return with correct content type for EME
    return reply
      .header('Content-Type', 'application/json')
      .send(response);
  });

  // Widevine license proxy endpoint (Enterprise)
  app.post('/widevine', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isWidevineConfigured()) {
      return reply.status(501).send({ error: 'Widevine not configured' });
    }

    // Validate token for enterprise endpoints
    const token = extractBearerToken(request.headers.authorization);
    if (!token) {
      return reply.status(401).send({ error: 'Authorization required' });
    }

    const payload = await validateToken(token);
    if (!payload) {
      return reply.status(401).send({ error: 'Invalid token' });
    }

    const clientIp = request.ip || request.headers['x-forwarded-for'] as string || 'unknown';
    const userAgent = request.headers['user-agent'] || 'unknown';

    // Get the raw license request body
    const licenseRequest = request.body as Buffer;

    try {
      const response = await handleWidevineRequest(licenseRequest, {
        clientIp,
        userAgent,
        token,
      });

      return reply
        .header('Content-Type', 'application/octet-stream')
        .send(response);
    } catch (error) {
      logger.error({ error }, 'Widevine license error');
      return reply.status(500).send({ error: 'License acquisition failed' });
    }
  });

  // FairPlay license proxy endpoint (Enterprise)
  app.post('/fairplay', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isFairPlayConfigured()) {
      return reply.status(501).send({ error: 'FairPlay not configured' });
    }

    // Validate token for enterprise endpoints
    const token = extractBearerToken(request.headers.authorization);
    if (!token) {
      return reply.status(401).send({ error: 'Authorization required' });
    }

    const payload = await validateToken(token);
    if (!payload) {
      return reply.status(401).send({ error: 'Invalid token' });
    }

    const clientIp = request.ip || request.headers['x-forwarded-for'] as string || 'unknown';
    const userAgent = request.headers['user-agent'] || 'unknown';

    // Get the SPC message
    const spcMessage = request.body as Buffer;

    try {
      const response = await handleFairPlayRequest(spcMessage, {
        clientIp,
        userAgent,
        token,
      });

      return reply
        .header('Content-Type', 'application/octet-stream')
        .send(response);
    } catch (error) {
      logger.error({ error }, 'FairPlay license error');
      return reply.status(500).send({ error: 'License acquisition failed' });
    }
  });

  // FairPlay certificate endpoint
  app.get('/fairplay/certificate', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isFairPlayConfigured()) {
      return reply.status(501).send({ error: 'FairPlay not configured' });
    }

    try {
      const certificate = await getFairPlayCertificate();
      return reply
        .header('Content-Type', 'application/octet-stream')
        .send(certificate);
    } catch (error) {
      logger.error({ error }, 'Failed to get FairPlay certificate');
      return reply.status(500).send({ error: 'Certificate not available' });
    }
  });

  // DRM capabilities endpoint
  app.get('/capabilities', async (request: FastifyRequest, reply: FastifyReply) => {
    return {
      clearkey: true,
      widevine: isWidevineConfigured(),
      fairplay: isFairPlayConfigured(),
    };
  });
}
