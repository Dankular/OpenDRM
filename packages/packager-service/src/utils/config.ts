import { z } from 'zod';

const configSchema = z.object({
  // Server
  host: z.string().default('0.0.0.0'),
  port: z.coerce.number().default(3001),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),

  // Redis
  redisUrl: z.string(),

  // License Server (gRPC)
  licenseServerGrpcUrl: z.string().default('license-server:50051'),

  // Shaka Packager
  shakaPackagerPath: z.string().default('/usr/bin/packager'),

  // Storage
  storageBackend: z.enum(['local', 's3', 'gcs', 'azure']).default('local'),
  localStoragePath: z.string().default('/data/content'),

  // S3
  s3Bucket: z.string().optional(),
  s3Region: z.string().default('us-east-1'),
  s3AccessKey: z.string().optional(),
  s3SecretKey: z.string().optional(),
  s3Endpoint: z.string().optional(),

  // GCS
  gcsBucket: z.string().optional(),
  gcsProjectId: z.string().optional(),
  gcsKeyFile: z.string().optional(),

  // Azure
  azureStorageAccount: z.string().optional(),
  azureStorageKey: z.string().optional(),
  azureContainer: z.string().optional(),

  // Logging
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

function loadConfig() {
  const env = {
    host: process.env.PACKAGER_HOST,
    port: process.env.PACKAGER_PORT,
    nodeEnv: process.env.NODE_ENV,
    redisUrl: process.env.REDIS_URL,
    licenseServerGrpcUrl: process.env.LICENSE_SERVER_GRPC_URL,
    shakaPackagerPath: process.env.SHAKA_PACKAGER_PATH,
    storageBackend: process.env.STORAGE_BACKEND,
    localStoragePath: process.env.LOCAL_STORAGE_PATH,
    s3Bucket: process.env.S3_BUCKET,
    s3Region: process.env.S3_REGION,
    s3AccessKey: process.env.S3_ACCESS_KEY,
    s3SecretKey: process.env.S3_SECRET_KEY,
    s3Endpoint: process.env.S3_ENDPOINT,
    gcsBucket: process.env.GCS_BUCKET,
    gcsProjectId: process.env.GCS_PROJECT_ID,
    gcsKeyFile: process.env.GCS_KEY_FILE,
    azureStorageAccount: process.env.AZURE_STORAGE_ACCOUNT,
    azureStorageKey: process.env.AZURE_STORAGE_KEY,
    azureContainer: process.env.AZURE_CONTAINER,
    logLevel: process.env.LOG_LEVEL,
  };

  const result = configSchema.safeParse(env);

  if (!result.success) {
    console.error('Invalid configuration:');
    console.error(result.error.format());
    process.exit(1);
  }

  return result.data;
}

export const config = loadConfig();
export type Config = z.infer<typeof configSchema>;
