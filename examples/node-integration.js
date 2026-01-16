/**
 * OpenDRM Node.js Integration Example
 *
 * This example shows how to integrate OpenDRM into an Express.js backend
 * for generating playback tokens and managing content.
 */

const express = require('express');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// Configuration
const OPENDRM_URL = process.env.OPENDRM_URL || 'http://localhost:3000';
const OPENDRM_API_KEY = process.env.OPENDRM_API_KEY || 'sk_live_xxx';
const WEBHOOK_SECRET = process.env.OPENDRM_WEBHOOK_SECRET || 'your-webhook-secret';

/**
 * Simple OpenDRM client
 */
class OpenDRMClient {
  constructor(baseUrl, apiKey) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  async request(method, path, body) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Keys
  async createKey(options = {}) {
    return this.request('POST', '/api/v1/keys', options);
  }

  async getKey(keyId) {
    return this.request('GET', `/api/v1/keys/${keyId}`);
  }

  async revokeKey(keyId) {
    return this.request('DELETE', `/api/v1/keys/${keyId}`);
  }

  // Content
  async registerContent(data) {
    return this.request('POST', '/api/v1/content', data);
  }

  async getContent(contentId) {
    return this.request('GET', `/api/v1/content/${contentId}`);
  }

  // Auth
  async generateToken(data) {
    return this.request('POST', '/api/v1/auth/token', data);
  }

  // Webhooks
  async createWebhook(data) {
    return this.request('POST', '/api/v1/webhooks', data);
  }
}

const drm = new OpenDRMClient(OPENDRM_URL, OPENDRM_API_KEY);

// ===================
// API Routes
// ===================

/**
 * Generate a playback token for a user
 * POST /api/play
 * Body: { contentId: string, userId: string }
 */
app.post('/api/play', async (req, res) => {
  try {
    const { contentId, userId } = req.body;

    // Validate user has access (your business logic)
    // const hasAccess = await checkUserAccess(userId, contentId);
    // if (!hasAccess) {
    //   return res.status(403).json({ error: 'Access denied' });
    // }

    // Generate playback token
    const tokenResponse = await drm.generateToken({
      subject: userId,
      contentId: contentId,
      expiresIn: '4h', // Token valid for 4 hours
    });

    // Get content info
    const content = await drm.getContent(contentId);

    res.json({
      token: tokenResponse.token,
      expiresIn: tokenResponse.expiresIn,
      manifestUrl: `https://cdn.example.com/content/${contentId}/manifest.mpd`,
      licenseServer: OPENDRM_URL,
    });
  } catch (error) {
    console.error('Error generating playback token:', error);
    res.status(500).json({ error: 'Failed to generate playback token' });
  }
});

/**
 * Upload and register new content
 * POST /api/content
 * Body: { title: string, sourceUrl: string }
 */
app.post('/api/content', async (req, res) => {
  try {
    const { title, sourceUrl } = req.body;

    // 1. Create encryption key
    const key = await drm.createKey();
    console.log(`Created key: ${key.keyId}`);

    // 2. Generate content ID
    const contentId = `content-${Date.now()}`;

    // 3. Register content with OpenDRM
    const content = await drm.registerContent({
      contentId,
      title,
      keyId: key.keyId,
    });

    // 4. Submit packaging job (would call packager-service)
    // const job = await packager.submitJob({
    //   contentId,
    //   inputPath: sourceUrl,
    //   keyId: key.keyId,
    //   keyValue: key.keyValue,
    //   outputFormats: ['dash', 'hls'],
    // });

    res.status(201).json({
      contentId,
      title,
      keyId: key.keyId,
      // Save key.keyValue securely for packaging!
      status: 'processing',
    });
  } catch (error) {
    console.error('Error registering content:', error);
    res.status(500).json({ error: 'Failed to register content' });
  }
});

/**
 * Webhook handler for OpenDRM events
 * POST /webhooks/opendrm
 */
app.post('/webhooks/opendrm', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-opendrm-signature'];
  const event = req.headers['x-opendrm-event'];
  const payload = req.body.toString();

  // Verify signature
  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    console.error('Invalid webhook signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Parse payload
  const data = JSON.parse(payload);
  console.log(`Received webhook: ${event}`, data);

  // Handle different events
  switch (event) {
    case 'license.issued':
      // Track successful playback start
      console.log(`License issued for content: ${data.data.contentId}`);
      // await analytics.trackPlaybackStart(data.data);
      break;

    case 'license.denied':
      // Track failed playback attempt
      console.log(`License denied: ${data.data.reason}`);
      // await analytics.trackPlaybackDenied(data.data);
      break;

    case 'key.created':
      console.log(`New key created: ${data.data.keyId}`);
      break;

    case 'key.revoked':
      console.log(`Key revoked: ${data.data.keyId}`);
      // Invalidate cached content
      break;

    default:
      console.log(`Unknown event: ${event}`);
  }

  res.json({ received: true });
});

/**
 * Get player configuration
 * GET /api/player-config
 */
app.get('/api/player-config', (req, res) => {
  res.json({
    licenseServer: OPENDRM_URL,
    playerScript: 'https://cdn.jsdelivr.net/npm/shaka-player@4.7.0/dist/shaka-player.compiled.min.js',
    sdkScript: 'https://cdn.example.com/opendrm-sdk.js',
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`OpenDRM URL: ${OPENDRM_URL}`);
});
