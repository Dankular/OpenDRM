import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { addPackagingJob, getJobStatus, cancelJob } from '../workers/queue.js';
import { createKeyViaLicenseServer } from '../utils/grpc-client.js';
import { logger } from '../utils/logger.js';

const createJobSchema = z.object({
  contentId: z.string().min(1),
  inputPath: z.string().min(1),
  keyId: z.string().optional(),
  createNewKey: z.boolean().optional(),
  outputFormats: z.array(z.enum(['dash', 'hls'])).min(1),
  drmSystems: z.array(z.enum(['clearkey', 'widevine', 'fairplay'])).optional(),
  videoTracks: z
    .array(
      z.object({
        resolution: z.string().optional(),
        bitrate: z.number().optional(),
      })
    )
    .optional(),
  audioTracks: z
    .array(
      z.object({
        language: z.string().optional(),
        bitrate: z.number().optional(),
      })
    )
    .optional(),
});

export async function jobRoutes(app: FastifyInstance) {
  // Create a new packaging job
  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const result = createJobSchema.safeParse(request.body);

    if (!result.success) {
      return reply.status(400).send({
        error: 'Invalid request',
        details: result.error.format(),
      });
    }

    const data = result.data;
    const jobId = uuidv4();

    // Create a new key if requested
    let keyId = data.keyId;
    if (data.createNewKey && !keyId) {
      try {
        const key = await createKeyViaLicenseServer();
        keyId = key.keyId;
        logger.info({ keyId }, 'Created new encryption key for packaging');
      } catch (error) {
        logger.error({ error }, 'Failed to create encryption key');
        return reply.status(500).send({ error: 'Failed to create encryption key' });
      }
    }

    try {
      await addPackagingJob({
        jobId,
        contentId: data.contentId,
        inputPath: data.inputPath,
        keyId,
        outputFormats: data.outputFormats,
        drmSystems: data.drmSystems,
        videoTracks: data.videoTracks,
        audioTracks: data.audioTracks,
      });

      return reply.status(202).send({
        jobId,
        contentId: data.contentId,
        keyId,
        status: 'queued',
      });
    } catch (error) {
      logger.error({ error }, 'Failed to queue packaging job');
      return reply.status(500).send({ error: 'Failed to queue job' });
    }
  });

  // Get job status
  app.get<{ Params: { jobId: string } }>('/:jobId', async (request, reply) => {
    const { jobId } = request.params;

    const status = await getJobStatus(jobId);

    if (!status) {
      return reply.status(404).send({ error: 'Job not found' });
    }

    return {
      jobId: status.id,
      state: status.state,
      progress: status.progress,
      contentId: status.data.contentId,
      result: status.result,
      error: status.failedReason,
      createdAt: status.createdAt,
      processedAt: status.processedAt,
      finishedAt: status.finishedAt,
    };
  });

  // Get job output (when completed)
  app.get<{ Params: { jobId: string } }>('/:jobId/output', async (request, reply) => {
    const { jobId } = request.params;

    const status = await getJobStatus(jobId);

    if (!status) {
      return reply.status(404).send({ error: 'Job not found' });
    }

    if (status.state !== 'completed') {
      return reply.status(400).send({
        error: 'Job not completed',
        state: status.state,
      });
    }

    return status.result;
  });

  // Cancel a job
  app.delete<{ Params: { jobId: string } }>('/:jobId', async (request, reply) => {
    const { jobId } = request.params;

    const cancelled = await cancelJob(jobId);

    if (!cancelled) {
      return reply.status(400).send({
        error: 'Cannot cancel job (not found or already processing)',
      });
    }

    return { message: 'Job cancelled' };
  });
}
