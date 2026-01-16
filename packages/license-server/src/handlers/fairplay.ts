import { config } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import { getDb } from '../db/connection.js';
import { licenseRequests } from '../db/schema.js';
import { readFile } from 'fs/promises';

interface FairPlayProxyContext {
  clientIp: string;
  userAgent: string;
  token?: string;
}

/**
 * Proxies a FairPlay license request to an external license server
 *
 * Enterprise feature: Requires FAIRPLAY_LICENSE_SERVER_URL to be configured
 */
export async function handleFairPlayRequest(
  spcMessage: Buffer,
  context: FairPlayProxyContext
): Promise<Buffer> {
  if (!config.fairplayLicenseServerUrl) {
    throw new Error('FairPlay license server not configured');
  }

  logger.info({ ip: context.clientIp }, 'Proxying FairPlay license request');

  try {
    // Forward the SPC (Server Playback Context) to the external FairPlay server
    const response = await fetch(config.fairplayLicenseServerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      body: spcMessage,
    });

    if (!response.ok) {
      throw new Error(`FairPlay server returned ${response.status}`);
    }

    const ckcMessage = Buffer.from(await response.arrayBuffer());

    // Log successful license request
    const db = getDb();
    await db.insert(licenseRequests).values({
      drmType: 'fairplay',
      clientIp: context.clientIp,
      userAgent: context.userAgent,
      granted: true,
    });

    logger.info({ ip: context.clientIp }, 'FairPlay CKC issued');

    return ckcMessage;
  } catch (error) {
    // Log failed license request
    const db = getDb();
    await db.insert(licenseRequests).values({
      drmType: 'fairplay',
      clientIp: context.clientIp,
      userAgent: context.userAgent,
      granted: false,
    });

    logger.error({ error, ip: context.clientIp }, 'FairPlay license request failed');
    throw error;
  }
}

/**
 * Get the FairPlay certificate for client initialization
 */
export async function getFairPlayCertificate(): Promise<Buffer> {
  if (!config.fairplayCertificatePath) {
    throw new Error('FairPlay certificate not configured');
  }

  const certificate = await readFile(config.fairplayCertificatePath);
  return certificate;
}

/**
 * Check if FairPlay is configured
 */
export function isFairPlayConfigured(): boolean {
  return !!config.fairplayLicenseServerUrl && !!config.fairplayCertificatePath;
}
