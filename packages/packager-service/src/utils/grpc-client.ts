import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { logger } from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load proto definitions
const PROTO_PATH = path.join(__dirname, '../../../../proto/license.proto');

let keyServiceClient: any = null;

/**
 * Get or create the KeyService gRPC client
 */
function getKeyServiceClient() {
  if (keyServiceClient) {
    return keyServiceClient;
  }

  const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });

  const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as any;

  if (!protoDescriptor.opendrm?.KeyService) {
    throw new Error('KeyService not found in proto definition');
  }

  keyServiceClient = new protoDescriptor.opendrm.KeyService(
    config.licenseServerGrpcUrl,
    grpc.credentials.createInsecure()
  );

  return keyServiceClient;
}

/**
 * Get a key from the license server
 */
export async function getKeyFromLicenseServer(
  keyId: string
): Promise<{ keyId: string; keyValue: string }> {
  const client = getKeyServiceClient();

  return new Promise((resolve, reject) => {
    client.GetKey({ key_id: keyId }, (err: any, response: any) => {
      if (err) {
        logger.error({ err, keyId }, 'Failed to get key from license server');
        reject(err);
        return;
      }

      resolve({
        keyId: response.key_id,
        keyValue: response.key_value,
      });
    });
  });
}

/**
 * Create a new key via the license server
 */
export async function createKeyViaLicenseServer(
  expiresAt?: string
): Promise<{ keyId: string; keyValue: string }> {
  const client = getKeyServiceClient();

  return new Promise((resolve, reject) => {
    client.CreateKey({ expires_at: expiresAt || '' }, (err: any, response: any) => {
      if (err) {
        logger.error({ err }, 'Failed to create key via license server');
        reject(err);
        return;
      }

      resolve({
        keyId: response.key_id,
        keyValue: response.key_value,
      });
    });
  });
}
