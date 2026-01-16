import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import * as contentService from '../services/content-service.js';

const registerContentSchema = z.object({
  contentId: z.string().min(1),
  title: z.string().optional(),
  keyId: z.string().optional(),
  policyId: z.string().uuid().optional(),
});

const createPolicySchema = z.object({
  name: z.string().min(1),
  rules: z.object({
    allowedCountries: z.array(z.string()).optional(),
    blockedCountries: z.array(z.string()).optional(),
    allowedDeviceTypes: z.array(z.string()).optional(),
    validFrom: z.string().datetime().optional(),
    validUntil: z.string().datetime().optional(),
    maxConcurrentStreams: z.number().int().positive().optional(),
    requireSecureConnection: z.boolean().optional(),
  }),
});

const updatePolicySchema = z.object({
  policyId: z.string().uuid(),
});

export async function contentRoutes(app: FastifyInstance) {
  // Register new content
  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const result = registerContentSchema.safeParse(request.body);

    if (!result.success) {
      return reply.status(400).send({
        error: 'Invalid request',
        details: result.error.format(),
      });
    }

    try {
      const content = await contentService.registerContent(result.data);
      return reply.status(201).send(content);
    } catch (error) {
      if (error instanceof Error) {
        return reply.status(400).send({ error: error.message });
      }
      throw error;
    }
  });

  // Get content by ID
  app.get<{ Params: { contentId: string } }>(
    '/:contentId',
    async (request, reply) => {
      const { contentId } = request.params;

      const content = await contentService.getContent(contentId);

      if (!content) {
        return reply.status(404).send({ error: 'Content not found' });
      }

      return content;
    }
  );

  // Update content policy
  app.put<{ Params: { contentId: string } }>(
    '/:contentId/policy',
    async (request, reply) => {
      const { contentId } = request.params;

      const result = updatePolicySchema.safeParse(request.body);

      if (!result.success) {
        return reply.status(400).send({
          error: 'Invalid request',
          details: result.error.format(),
        });
      }

      const content = await contentService.updateContentPolicy(
        contentId,
        result.data.policyId
      );

      if (!content) {
        return reply.status(404).send({ error: 'Content not found' });
      }

      return content;
    }
  );

  // Create a new policy
  app.post('/policies', async (request: FastifyRequest, reply: FastifyReply) => {
    const result = createPolicySchema.safeParse(request.body);

    if (!result.success) {
      return reply.status(400).send({
        error: 'Invalid request',
        details: result.error.format(),
      });
    }

    const policy = await contentService.createPolicy(result.data.name, result.data.rules);
    return reply.status(201).send(policy);
  });
}
