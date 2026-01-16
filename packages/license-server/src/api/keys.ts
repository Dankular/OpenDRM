import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import * as keyService from '../services/key-service.js';
import { logger } from '../utils/logger.js';

const createKeySchema = z.object({
  expiresAt: z.string().datetime().optional(),
});

export async function keyRoutes(app: FastifyInstance) {
  // Create a new encryption key
  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createKeySchema.safeParse(request.body);

    const options: keyService.CreateKeyOptions = {};
    if (body.success && body.data.expiresAt) {
      options.expiresAt = new Date(body.data.expiresAt);
    }

    const key = await keyService.createKey(options);

    // Return the key value only on creation (it won't be retrievable later)
    return reply.status(201).send({
      id: key.id,
      keyId: key.keyId,
      keyValue: key.keyValue, // Hex-encoded, use for packaging
      createdAt: key.createdAt,
      expiresAt: key.expiresAt,
      status: key.status,
    });
  });

  // Get key metadata (not the actual key)
  app.get<{ Params: { keyId: string } }>(
    '/:keyId',
    async (request, reply) => {
      const { keyId } = request.params;

      const key = await keyService.getKeyInfo(keyId);

      if (!key) {
        return reply.status(404).send({ error: 'Key not found' });
      }

      return {
        id: key.id,
        keyId: key.keyId,
        createdAt: key.createdAt,
        expiresAt: key.expiresAt,
        status: key.status,
      };
    }
  );

  // Revoke a key
  app.delete<{ Params: { keyId: string } }>(
    '/:keyId',
    async (request, reply) => {
      const { keyId } = request.params;

      const revoked = await keyService.revokeKey(keyId);

      if (!revoked) {
        return reply.status(404).send({ error: 'Key not found' });
      }

      return { message: 'Key revoked' };
    }
  );

  // List keys
  app.get('/', async (request: FastifyRequest<{
    Querystring: { limit?: string; offset?: string }
  }>, reply) => {
    const limit = parseInt(request.query.limit || '50', 10);
    const offset = parseInt(request.query.offset || '0', 10);

    const result = await keyService.listKeys(limit, offset);

    return {
      keys: result.keys,
      total: result.total,
      limit,
      offset,
    };
  });
}
