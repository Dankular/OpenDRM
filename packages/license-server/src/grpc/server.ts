import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import { fileURLToPath } from 'url';
import * as keyService from '../services/key-service.js';
import { decryptKey } from '../utils/crypto.js';
import { getDb } from '../db/connection.js';
import { keys } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load proto definitions
const PROTO_PATH = path.join(__dirname, '../../../../proto/license.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as any;

/**
 * gRPC service implementations
 */
const keyServiceImpl = {
  // Get a key by ID (returns the decrypted key for packaging)
  async GetKey(
    call: grpc.ServerUnaryCall<{ key_id: string }, any>,
    callback: grpc.sendUnaryData<any>
  ) {
    try {
      const db = getDb();
      const { key_id } = call.request;

      const [record] = await db
        .select()
        .from(keys)
        .where(eq(keys.keyId, key_id))
        .limit(1);

      if (!record) {
        callback({
          code: grpc.status.NOT_FOUND,
          message: 'Key not found',
        });
        return;
      }

      // Decrypt the key
      const encryptedKey = Buffer.from(record.keyValue, 'base64');
      const decryptedKey = decryptKey(encryptedKey);

      callback(null, {
        key_id: record.keyId,
        key_value: decryptedKey.toString('hex'),
        status: record.status,
        expires_at: record.expiresAt?.toISOString() || '',
      });
    } catch (error) {
      logger.error({ error }, 'gRPC GetKey error');
      callback({
        code: grpc.status.INTERNAL,
        message: 'Internal error',
      });
    }
  },

  // Create a new key
  async CreateKey(
    call: grpc.ServerUnaryCall<{ expires_at?: string }, any>,
    callback: grpc.sendUnaryData<any>
  ) {
    try {
      const { expires_at } = call.request;

      const key = await keyService.createKey({
        expiresAt: expires_at ? new Date(expires_at) : undefined,
      });

      callback(null, {
        key_id: key.keyId,
        key_value: key.keyValue,
        status: key.status,
        expires_at: key.expiresAt?.toISOString() || '',
      });
    } catch (error) {
      logger.error({ error }, 'gRPC CreateKey error');
      callback({
        code: grpc.status.INTERNAL,
        message: 'Internal error',
      });
    }
  },

  // Revoke a key
  async RevokeKey(
    call: grpc.ServerUnaryCall<{ key_id: string }, any>,
    callback: grpc.sendUnaryData<any>
  ) {
    try {
      const { key_id } = call.request;

      const revoked = await keyService.revokeKey(key_id);

      if (!revoked) {
        callback({
          code: grpc.status.NOT_FOUND,
          message: 'Key not found',
        });
        return;
      }

      callback(null, {});
    } catch (error) {
      logger.error({ error }, 'gRPC RevokeKey error');
      callback({
        code: grpc.status.INTERNAL,
        message: 'Internal error',
      });
    }
  },
};

/**
 * Create and configure the gRPC server
 */
export async function createGrpcServer(): Promise<grpc.Server> {
  const server = new grpc.Server();

  // Add KeyService
  if (protoDescriptor.opendrm?.KeyService) {
    server.addService(protoDescriptor.opendrm.KeyService.service, keyServiceImpl);
    logger.info('KeyService registered');
  } else {
    logger.warn('KeyService proto not found, creating minimal server');
  }

  return server;
}
