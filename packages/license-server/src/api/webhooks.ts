import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import * as webhookService from '../services/webhook-service.js';

const createWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(
    z.enum([
      'key.created',
      'key.revoked',
      'license.issued',
      'license.denied',
      'content.registered',
      'content.updated',
    ])
  ).min(1),
  secret: z.string().min(16).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function webhookRoutes(app: FastifyInstance) {
  // Create webhook
  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const result = createWebhookSchema.safeParse(request.body);

    if (!result.success) {
      return reply.status(400).send({
        error: 'Invalid request',
        details: result.error.format(),
      });
    }

    const webhook = await webhookService.createWebhook(result.data);

    return reply.status(201).send({
      id: webhook.id,
      url: webhook.url,
      events: webhook.events,
      secret: webhook.secret, // Only shown on creation
      status: webhook.status,
      createdAt: webhook.createdAt,
    });
  });

  // List webhooks
  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const webhooks = await webhookService.listWebhooks();

    return webhooks.map((w) => ({
      id: w.id,
      url: w.url,
      events: w.events,
      status: w.status,
      createdAt: w.createdAt,
      lastDeliveryAt: w.lastDeliveryAt,
    }));
  });

  // Get webhook
  app.get<{ Params: { webhookId: string } }>(
    '/:webhookId',
    async (request, reply) => {
      const webhook = await webhookService.getWebhook(request.params.webhookId);

      if (!webhook) {
        return reply.status(404).send({ error: 'Webhook not found' });
      }

      return {
        id: webhook.id,
        url: webhook.url,
        events: webhook.events,
        status: webhook.status,
        createdAt: webhook.createdAt,
        lastDeliveryAt: webhook.lastDeliveryAt,
      };
    }
  );

  // Delete webhook
  app.delete<{ Params: { webhookId: string } }>(
    '/:webhookId',
    async (request, reply) => {
      await webhookService.deleteWebhook(request.params.webhookId);
      return { message: 'Webhook deleted' };
    }
  );

  // Test webhook (sends a test event)
  app.post<{ Params: { webhookId: string } }>(
    '/:webhookId/test',
    async (request, reply) => {
      const webhook = await webhookService.getWebhook(request.params.webhookId);

      if (!webhook) {
        return reply.status(404).send({ error: 'Webhook not found' });
      }

      // Dispatch a test event
      await webhookService.dispatchEvent('key.created', {
        test: true,
        message: 'This is a test webhook delivery',
        timestamp: new Date().toISOString(),
      });

      return { message: 'Test event dispatched' };
    }
  );
}
