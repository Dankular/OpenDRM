import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { config } from './config.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 16;

/**
 * Derives an encryption key from the master secret using scrypt
 */
function deriveKey(salt: Buffer): Buffer {
  return scryptSync(config.keyEncryptionSecret, salt, 32);
}

/**
 * Encrypts a DRM key for storage at rest
 */
export function encryptKey(plainKey: Buffer): Buffer {
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const derivedKey = deriveKey(salt);

  const cipher = createCipheriv(ALGORITHM, derivedKey, iv);
  const encrypted = Buffer.concat([cipher.update(plainKey), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Format: salt (16) | iv (16) | authTag (16) | encrypted
  return Buffer.concat([salt, iv, authTag, encrypted]);
}

/**
 * Decrypts a stored DRM key
 */
export function decryptKey(encryptedData: Buffer): Buffer {
  const salt = encryptedData.subarray(0, SALT_LENGTH);
  const iv = encryptedData.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = encryptedData.subarray(
    SALT_LENGTH + IV_LENGTH,
    SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
  );
  const encrypted = encryptedData.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

  const derivedKey = deriveKey(salt);

  const decipher = createDecipheriv(ALGORITHM, derivedKey, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

/**
 * Generates a random DRM key (16 bytes for AES-128)
 */
export function generateDrmKey(): Buffer {
  return randomBytes(16);
}

/**
 * Generates a random Key ID (16 bytes)
 */
export function generateKeyId(): string {
  return randomBytes(16).toString('hex');
}

/**
 * Converts a hex string to a base64url-encoded string (for ClearKey)
 */
export function hexToBase64Url(hex: string): string {
  const buffer = Buffer.from(hex, 'hex');
  return buffer.toString('base64url');
}

/**
 * Converts a base64url string to hex
 */
export function base64UrlToHex(base64url: string): string {
  const buffer = Buffer.from(base64url, 'base64url');
  return buffer.toString('hex');
}
