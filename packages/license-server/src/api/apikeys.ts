import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import * as apiKeyService from '../services/apikey-service.js';

const createApiKeySchema = z.object({
  name: z.string().min(1).max(255),
  scopes: z.array(z.string()).optional(),
  expiresAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function apiKeyRoutes(app: FastifyInstance) {
  // Create API key
  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const result = createApiKeySchema.safeParse(request.body);

    if (!result.success) {
      return reply.status(400).send({
        error: 'Invalid request',
        details: result.error.format(),
      });
    }

    const apiKey = await apiKeyService.createApiKey({
      name: result.data.name,
      scopes: result.data.scopes,
      expiresAt: result.data.expiresAt ? new Date(result.data.expiresAt) : undefined,
      metadata: result.data.metadata,
    });

    return reply.status(201).send({
      id: apiKey.id,
      name: apiKey.name,
      key: apiKey.key, // Only shown on creation!
      keyPrefix: apiKey.keyPrefix,
      scopes: apiKey.scopes,
      status: apiKey.status,
      expiresAt: apiKey.expiresAt,
      createdAt: apiKey.createdAt,
      _warning: 'Store this key securely. It will not be shown again.',
    });
  });

  // List API keys
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const keys = await apiKeyService.listApiKeys();

    return keys.map((k) => ({
      id: k.id,
      name: k.name,
      keyPrefix: k.keyPrefix,
      scopes: k.scopes,
      status: k.status,
      lastUsedAt: k.lastUsedAt,
      expiresAt: k.expiresAt,
      createdAt: k.createdAt,
    }));
  });

  // Revoke API key
  app.delete<{ Params: { keyId: string } }>(
    '/:keyId',
    async (request, reply) => {
      const revoked = await apiKeyService.revokeApiKey(request.params.keyId);

      if (!revoked) {
        return reply.status(404).send({ error: 'API key not found' });
      }

      return { message: 'API key revoked' };
    }
  );
}
