import { config } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import { getDb } from '../db/connection.js';
import { licenseRequests } from '../db/schema.js';

interface WidevineProxyContext {
  clientIp: string;
  userAgent: string;
  token?: string;
}

/**
 * Proxies a Widevine license request to an external license server
 *
 * Enterprise feature: Requires WIDEVINE_LICENSE_SERVER_URL to be configured
 */
export async function handleWidevineRequest(
  licenseRequest: Buffer,
  context: WidevineProxyContext
): Promise<Buffer> {
  if (!config.widevineLicenseServerUrl) {
    throw new Error('Widevine license server not configured');
  }

  logger.info({ ip: context.clientIp }, 'Proxying Widevine license request');

  try {
    // Forward the license request to the external Widevine server
    const response = await fetch(config.widevineLicenseServerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        // Add any required authentication headers
        ...(config.widevineSigningKey && {
          'X-WidevineAuthToken': await signWidevineRequest(licenseRequest),
        }),
      },
      body: licenseRequest,
    });

    if (!response.ok) {
      throw new Error(`Widevine server returned ${response.status}`);
    }

    const licenseResponse = Buffer.from(await response.arrayBuffer());

    // Log successful license request
    const db = getDb();
    await db.insert(licenseRequests).values({
      drmType: 'widevine',
      clientIp: context.clientIp,
      userAgent: context.userAgent,
      granted: true,
    });

    logger.info({ ip: context.clientIp }, 'Widevine license issued');

    return licenseResponse;
  } catch (error) {
    // Log failed license request
    const db = getDb();
    await db.insert(licenseRequests).values({
      drmType: 'widevine',
      clientIp: context.clientIp,
      userAgent: context.userAgent,
      granted: false,
    });

    logger.error({ error, ip: context.clientIp }, 'Widevine license request failed');
    throw error;
  }
}

/**
 * Signs a Widevine request if signing credentials are configured
 */
async function signWidevineRequest(licenseRequest: Buffer): Promise<string> {
  if (!config.widevineSigningKey || !config.widevineSigningIv) {
    return '';
  }

  const { createCipheriv } = await import('crypto');

  const key = Buffer.from(config.widevineSigningKey, 'hex');
  const iv = Buffer.from(config.widevineSigningIv, 'hex');

  const cipher = createCipheriv('aes-256-cbc', key, iv);
  const hash = Buffer.concat([
    cipher.update(licenseRequest),
    cipher.final(),
  ]);

  return hash.toString('base64');
}

/**
 * Check if Widevine is configured
 */
export function isWidevineConfigured(): boolean {
  return !!config.widevineLicenseServerUrl;
}
