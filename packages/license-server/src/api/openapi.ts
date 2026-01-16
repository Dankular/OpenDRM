/**
 * OpenAPI/Swagger specification for OpenDRM API
 */

export const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'OpenDRM API',
    version: '1.0.0',
    description: `
# OpenDRM API

Enterprise-ready DRM license server API supporting ClearKey, Widevine, and FairPlay.

## Quick Start

1. Create an API key in the dashboard or use the \`/api/v1/apikeys\` endpoint
2. Include the API key in requests: \`X-API-Key: your-api-key\`
3. Create encryption keys, register content, and issue licenses

## Authentication

All API requests require authentication via one of:
- **API Key**: \`X-API-Key: sk_live_xxx\` header
- **Bearer Token**: \`Authorization: Bearer <jwt>\` header

## Rate Limits

- License endpoints: 1000 req/min
- Management endpoints: 100 req/min
- Webhook deliveries: 3 retries with exponential backoff
    `,
    contact: {
      name: 'OpenDRM Support',
      url: 'https://github.com/TheKhosa/OpenDRM',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url: '{protocol}://{host}',
      variables: {
        protocol: {
          default: 'https',
          enum: ['http', 'https'],
        },
        host: {
          default: 'api.opendrm.io',
          description: 'API host',
        },
      },
    },
  ],
  tags: [
    { name: 'Keys', description: 'Encryption key management' },
    { name: 'Licenses', description: 'DRM license acquisition' },
    { name: 'Content', description: 'Content registration and policies' },
    { name: 'Auth', description: 'Authentication and tokens' },
    { name: 'Webhooks', description: 'Event webhooks' },
    { name: 'API Keys', description: 'API key management' },
  ],
  paths: {
    '/api/v1/keys': {
      post: {
        tags: ['Keys'],
        summary: 'Create encryption key',
        description: 'Creates a new AES-128 encryption key for content protection',
        operationId: 'createKey',
        security: [{ apiKey: [] }, { bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateKeyRequest' },
            },
          },
        },
        responses: {
          201: {
            description: 'Key created successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/KeyWithValue' },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
        },
      },
      get: {
        tags: ['Keys'],
        summary: 'List keys',
        operationId: 'listKeys',
        security: [{ apiKey: [] }, { bearerAuth: [] }],
        parameters: [
          { $ref: '#/components/parameters/Limit' },
          { $ref: '#/components/parameters/Offset' },
        ],
        responses: {
          200: {
            description: 'List of keys',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/KeyList' },
              },
            },
          },
        },
      },
    },
    '/api/v1/keys/{keyId}': {
      get: {
        tags: ['Keys'],
        summary: 'Get key metadata',
        operationId: 'getKey',
        security: [{ apiKey: [] }, { bearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/KeyId' }],
        responses: {
          200: {
            description: 'Key metadata',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Key' },
              },
            },
          },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        tags: ['Keys'],
        summary: 'Revoke key',
        operationId: 'revokeKey',
        security: [{ apiKey: [] }, { bearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/KeyId' }],
        responses: {
          200: { description: 'Key revoked' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/v1/license/clearkey': {
      post: {
        tags: ['Licenses'],
        summary: 'ClearKey license request',
        description: 'EME-compatible ClearKey license endpoint',
        operationId: 'getClearKeyLicense',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ClearKeyRequest' },
            },
          },
        },
        responses: {
          200: {
            description: 'License response',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ClearKeyResponse' },
              },
            },
          },
        },
      },
    },
    '/api/v1/license/widevine': {
      post: {
        tags: ['Licenses'],
        summary: 'Widevine license proxy',
        description: 'Proxies license request to configured Widevine server',
        operationId: 'getWidevineLicense',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/octet-stream': {
              schema: { type: 'string', format: 'binary' },
            },
          },
        },
        responses: {
          200: {
            description: 'License response',
            content: {
              'application/octet-stream': {
                schema: { type: 'string', format: 'binary' },
              },
            },
          },
          501: { description: 'Widevine not configured' },
        },
      },
    },
    '/api/v1/license/fairplay': {
      post: {
        tags: ['Licenses'],
        summary: 'FairPlay license proxy',
        operationId: 'getFairPlayLicense',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/octet-stream': {
              schema: { type: 'string', format: 'binary' },
            },
          },
        },
        responses: {
          200: {
            description: 'CKC response',
            content: {
              'application/octet-stream': {
                schema: { type: 'string', format: 'binary' },
              },
            },
          },
          501: { description: 'FairPlay not configured' },
        },
      },
    },
    '/api/v1/content': {
      post: {
        tags: ['Content'],
        summary: 'Register content',
        operationId: 'registerContent',
        security: [{ apiKey: [] }, { bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RegisterContentRequest' },
            },
          },
        },
        responses: {
          201: {
            description: 'Content registered',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Content' },
              },
            },
          },
        },
      },
    },
    '/api/v1/content/{contentId}': {
      get: {
        tags: ['Content'],
        summary: 'Get content',
        operationId: 'getContent',
        security: [{ apiKey: [] }, { bearerAuth: [] }],
        parameters: [{ $ref: '#/components/parameters/ContentId' }],
        responses: {
          200: {
            description: 'Content details',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Content' },
              },
            },
          },
        },
      },
    },
    '/api/v1/auth/token': {
      post: {
        tags: ['Auth'],
        summary: 'Generate playback token',
        description: 'Creates a short-lived JWT for content playback',
        operationId: 'generateToken',
        security: [{ apiKey: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/GenerateTokenRequest' },
            },
          },
        },
        responses: {
          200: {
            description: 'Token generated',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/TokenResponse' },
              },
            },
          },
        },
      },
    },
    '/api/v1/webhooks': {
      post: {
        tags: ['Webhooks'],
        summary: 'Register webhook',
        operationId: 'createWebhook',
        security: [{ apiKey: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateWebhookRequest' },
            },
          },
        },
        responses: {
          201: {
            description: 'Webhook created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Webhook' },
              },
            },
          },
        },
      },
      get: {
        tags: ['Webhooks'],
        summary: 'List webhooks',
        operationId: 'listWebhooks',
        security: [{ apiKey: [] }],
        responses: {
          200: {
            description: 'List of webhooks',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Webhook' },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/apikeys': {
      post: {
        tags: ['API Keys'],
        summary: 'Create API key',
        operationId: 'createApiKey',
        security: [{ apiKey: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateApiKeyRequest' },
            },
          },
        },
        responses: {
          201: {
            description: 'API key created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiKeyWithSecret' },
              },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      apiKey: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'API key for server-to-server calls',
      },
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token for playback authorization',
      },
    },
    parameters: {
      KeyId: {
        name: 'keyId',
        in: 'path',
        required: true,
        schema: { type: 'string' },
        description: '32-character hex key ID',
      },
      ContentId: {
        name: 'contentId',
        in: 'path',
        required: true,
        schema: { type: 'string' },
      },
      Limit: {
        name: 'limit',
        in: 'query',
        schema: { type: 'integer', default: 50, maximum: 100 },
      },
      Offset: {
        name: 'offset',
        in: 'query',
        schema: { type: 'integer', default: 0 },
      },
    },
    responses: {
      Unauthorized: {
        description: 'Authentication required',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
      NotFound: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          code: { type: 'string' },
          details: { type: 'object' },
        },
      },
      CreateKeyRequest: {
        type: 'object',
        properties: {
          expiresAt: {
            type: 'string',
            format: 'date-time',
            description: 'Optional expiration time',
          },
          metadata: {
            type: 'object',
            description: 'Custom metadata',
          },
        },
      },
      Key: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          keyId: { type: 'string', description: '32-char hex' },
          status: { type: 'string', enum: ['active', 'revoked', 'expired'] },
          createdAt: { type: 'string', format: 'date-time' },
          expiresAt: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      KeyWithValue: {
        allOf: [
          { $ref: '#/components/schemas/Key' },
          {
            type: 'object',
            properties: {
              keyValue: {
                type: 'string',
                description: 'Hex-encoded key (only returned on creation)',
              },
            },
          },
        ],
      },
      KeyList: {
        type: 'object',
        properties: {
          keys: {
            type: 'array',
            items: { $ref: '#/components/schemas/Key' },
          },
          total: { type: 'integer' },
          limit: { type: 'integer' },
          offset: { type: 'integer' },
        },
      },
      ClearKeyRequest: {
        type: 'object',
        required: ['kids'],
        properties: {
          kids: {
            type: 'array',
            items: { type: 'string' },
            description: 'Base64url-encoded key IDs',
          },
          type: {
            type: 'string',
            enum: ['temporary', 'persistent-license'],
            default: 'temporary',
          },
        },
      },
      ClearKeyResponse: {
        type: 'object',
        properties: {
          keys: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                kty: { type: 'string', const: 'oct' },
                kid: { type: 'string' },
                k: { type: 'string' },
              },
            },
          },
          type: { type: 'string' },
        },
      },
      RegisterContentRequest: {
        type: 'object',
        required: ['contentId'],
        properties: {
          contentId: { type: 'string' },
          title: { type: 'string' },
          keyId: { type: 'string' },
          policyId: { type: 'string', format: 'uuid' },
          metadata: { type: 'object' },
        },
      },
      Content: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          contentId: { type: 'string' },
          title: { type: 'string' },
          keyId: { type: 'string' },
          policyId: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      GenerateTokenRequest: {
        type: 'object',
        required: ['subject'],
        properties: {
          subject: { type: 'string', description: 'User or session ID' },
          contentId: { type: 'string' },
          keyIds: { type: 'array', items: { type: 'string' } },
          expiresIn: { type: 'string', default: '1h', example: '24h' },
          metadata: { type: 'object' },
        },
      },
      TokenResponse: {
        type: 'object',
        properties: {
          token: { type: 'string' },
          expiresIn: { type: 'string' },
          expiresAt: { type: 'string', format: 'date-time' },
        },
      },
      CreateWebhookRequest: {
        type: 'object',
        required: ['url', 'events'],
        properties: {
          url: { type: 'string', format: 'uri' },
          events: {
            type: 'array',
            items: {
              type: 'string',
              enum: [
                'key.created',
                'key.revoked',
                'license.issued',
                'license.denied',
                'content.registered',
              ],
            },
          },
          secret: {
            type: 'string',
            description: 'HMAC secret for signature verification',
          },
        },
      },
      Webhook: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          url: { type: 'string' },
          events: { type: 'array', items: { type: 'string' } },
          status: { type: 'string', enum: ['active', 'disabled'] },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      CreateApiKeyRequest: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          scopes: {
            type: 'array',
            items: { type: 'string' },
            description: 'Permission scopes',
          },
          expiresAt: { type: 'string', format: 'date-time' },
        },
      },
      ApiKeyWithSecret: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          key: { type: 'string', description: 'Only shown once' },
          prefix: { type: 'string', example: 'sk_live_' },
          scopes: { type: 'array', items: { type: 'string' } },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
};
