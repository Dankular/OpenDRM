import * as jose from 'jose';
import { config } from '../utils/config.js';
import { logger } from '../utils/logger.js';

export interface TokenPayload {
  sub: string; // Subject (user ID or content ID)
  contentId?: string;
  keyIds?: string[];
  exp?: number;
  iat?: number;
}

const secretKey = new TextEncoder().encode(config.jwtSecret);

/**
 * Generates a playback token for content access
 */
export async function generatePlaybackToken(payload: {
  subject: string;
  contentId?: string;
  keyIds?: string[];
  expiresIn?: string;
}): Promise<string> {
  const token = await new jose.SignJWT({
    contentId: payload.contentId,
    keyIds: payload.keyIds,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.subject)
    .setIssuedAt()
    .setExpirationTime(payload.expiresIn || config.jwtExpiry)
    .sign(secretKey);

  logger.debug({ subject: payload.subject }, 'Playback token generated');

  return token;
}

/**
 * Validates a playback token and returns the payload
 */
export async function validateToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jose.jwtVerify(token, secretKey);

    return {
      sub: payload.sub as string,
      contentId: payload.contentId as string | undefined,
      keyIds: payload.keyIds as string[] | undefined,
      exp: payload.exp,
      iat: payload.iat,
    };
  } catch (error) {
    logger.debug({ error }, 'Token validation failed');
    return null;
  }
}

/**
 * Extracts token from Authorization header
 */
export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null;
  }

  return parts[1];
}
