import { z } from 'zod';

const configSchema = z.object({
  // Server
  host: z.string().default('0.0.0.0'),
  port: z.coerce.number().default(3000),
  grpcPort: z.coerce.number().default(50051),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),

  // Database
  databaseUrl: z.string(),

  // Redis
  redisUrl: z.string(),

  // Security
  keyEncryptionSecret: z.string().min(32),
  jwtSecret: z.string().min(16),
  jwtExpiry: z.string().default('1h'),

  // Enterprise DRM (optional)
  widevineLicenseServerUrl: z.string().optional(),
  widevineSigningKey: z.string().optional(),
  widevineSigningIv: z.string().optional(),

  fairplayLicenseServerUrl: z.string().optional(),
  fairplayAsk: z.string().optional(),
  fairplayCertificatePath: z.string().optional(),

  // CORS
  corsOrigins: z.string().default('*').transform((v) => (v === '*' ? true : v.split(','))),

  // Logging
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

function loadConfig() {
  const env = {
    host: process.env.LICENSE_SERVER_HOST,
    port: process.env.LICENSE_SERVER_PORT,
    grpcPort: process.env.LICENSE_SERVER_GRPC_PORT,
    nodeEnv: process.env.NODE_ENV,
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    keyEncryptionSecret: process.env.KEY_ENCRYPTION_SECRET,
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiry: process.env.JWT_EXPIRY,
    widevineLicenseServerUrl: process.env.WIDEVINE_LICENSE_SERVER_URL,
    widevineSigningKey: process.env.WIDEVINE_SIGNING_KEY,
    widevineSigningIv: process.env.WIDEVINE_SIGNING_IV,
    fairplayLicenseServerUrl: process.env.FAIRPLAY_LICENSE_SERVER_URL,
    fairplayAsk: process.env.FAIRPLAY_ASK,
    fairplayCertificatePath: process.env.FAIRPLAY_CERTIFICATE_PATH,
    corsOrigins: process.env.CORS_ORIGINS,
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
