import { Queue, Worker, Job } from 'bullmq';
import { config } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import { processPackagingJob, type PackagingJobData, type PackagingJobResult } from './packager.js';

const QUEUE_NAME = 'packaging';

let queue: Queue<PackagingJobData, PackagingJobResult> | null = null;
let worker: Worker<PackagingJobData, PackagingJobResult> | null = null;

/**
 * Initialize the job queue and worker
 */
export async function initializeQueue() {
  const connection = {
    host: new URL(config.redisUrl).hostname,
    port: parseInt(new URL(config.redisUrl).port || '6379', 10),
  };

  // Create the queue
  queue = new Queue<PackagingJobData, PackagingJobResult>(QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: {
        age: 24 * 3600, // Keep completed jobs for 24 hours
        count: 1000,
      },
      removeOnFail: {
        age: 7 * 24 * 3600, // Keep failed jobs for 7 days
      },
    },
  });

  // Create the worker
  worker = new Worker<PackagingJobData, PackagingJobResult>(
    QUEUE_NAME,
    async (job: Job<PackagingJobData, PackagingJobResult>) => {
      logger.info({ jobId: job.id, contentId: job.data.contentId }, 'Processing packaging job');

      try {
        const result = await processPackagingJob(job.data, (progress) => {
          job.updateProgress(progress);
        });

        logger.info({ jobId: job.id, contentId: job.data.contentId }, 'Packaging job completed');

        return result;
      } catch (error) {
        logger.error({ jobId: job.id, error }, 'Packaging job failed');
        throw error;
      }
    },
    {
      connection,
      concurrency: 2, // Process 2 jobs at a time
    }
  );

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Job completed');
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, error: err.message }, 'Job failed');
  });

  logger.info('Packaging queue initialized');
}

/**
 * Close the queue and worker
 */
export async function closeQueue() {
  if (worker) {
    await worker.close();
  }
  if (queue) {
    await queue.close();
  }
}

/**
 * Add a packaging job to the queue
 */
export async function addPackagingJob(data: PackagingJobData): Promise<string> {
  if (!queue) {
    throw new Error('Queue not initialized');
  }

  const job = await queue.add('package', data, {
    jobId: data.jobId,
  });

  return job.id!;
}

/**
 * Get job status
 */
export async function getJobStatus(jobId: string) {
  if (!queue) {
    throw new Error('Queue not initialized');
  }

  const job = await queue.getJob(jobId);

  if (!job) {
    return null;
  }

  const state = await job.getState();
  const progress = job.progress;

  return {
    id: job.id,
    state,
    progress,
    data: job.data,
    result: job.returnvalue,
    failedReason: job.failedReason,
    createdAt: job.timestamp,
    processedAt: job.processedOn,
    finishedAt: job.finishedOn,
  };
}

/**
 * Cancel a job
 */
export async function cancelJob(jobId: string): Promise<boolean> {
  if (!queue) {
    throw new Error('Queue not initialized');
  }

  const job = await queue.getJob(jobId);

  if (!job) {
    return false;
  }

  const state = await job.getState();

  if (state === 'waiting' || state === 'delayed') {
    await job.remove();
    return true;
  }

  return false;
}
