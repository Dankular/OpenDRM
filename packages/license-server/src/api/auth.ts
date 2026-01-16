import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import * as authService from '../services/auth-service.js';

const generateTokenSchema = z.object({
  subject: z.string().min(1),
  contentId: z.string().optional(),
  keyIds: z.array(z.string()).optional(),
  expiresIn: z.string().optional(),
});

const validateTokenSchema = z.object({
  token: z.string().min(1),
});

export async function authRoutes(app: FastifyInstance) {
  // Generate a playback token
  app.post('/token', async (request: FastifyRequest, reply: FastifyReply) => {
    const result = generateTokenSchema.safeParse(request.body);

    if (!result.success) {
      return reply.status(400).send({
        error: 'Invalid request',
        details: result.error.format(),
      });
    }

    const token = await authService.generatePlaybackToken(result.data);

    return {
      token,
      expiresIn: result.data.expiresIn || '1h',
    };
  });

  // Validate a token
  app.post('/validate', async (request: FastifyRequest, reply: FastifyReply) => {
    const result = validateTokenSchema.safeParse(request.body);

    if (!result.success) {
      return reply.status(400).send({
        error: 'Invalid request',
        details: result.error.format(),
      });
    }

    const payload = await authService.validateToken(result.data.token);

    if (!payload) {
      return reply.status(401).send({ valid: false, error: 'Invalid token' });
    }

    return {
      valid: true,
      payload: {
        subject: payload.sub,
        contentId: payload.contentId,
        keyIds: payload.keyIds,
        issuedAt: payload.iat ? new Date(payload.iat * 1000).toISOString() : undefined,
        expiresAt: payload.exp ? new Date(payload.exp * 1000).toISOString() : undefined,
      },
    };
  });
}
