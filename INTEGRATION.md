# OpenDRM Integration Guide

This guide covers how to integrate OpenDRM into your existing infrastructure.

## Quick Start (5 Minutes)

### 1. Get an API Key

```bash
# Create your first API key
curl -X POST http://localhost:3000/api/v1/apikeys \
  -H "Content-Type: application/json" \
  -d '{"name": "My App"}'

# Response: {"key": "sk_live_abc123...", ...}
# Save this key securely!
```

### 2. Create an Encryption Key

```bash
curl -X POST http://localhost:3000/api/v1/keys \
  -H "X-API-Key: sk_live_abc123..."

# Response: {"keyId": "a1b2c3...", "keyValue": "d4e5f6...", ...}
# Use keyId and keyValue for packaging your content
```

### 3. Package Your Content

```bash
# Using Shaka Packager directly
packager \
  in=input.mp4,stream=video,out=video.mp4 \
  in=input.mp4,stream=audio,out=audio.mp4 \
  --mpd_output manifest.mpd \
  --enable_raw_key_encryption \
  --keys key_id=a1b2c3...:key=d4e5f6...
```

### 4. Generate Playback Token

```bash
curl -X POST http://localhost:3000/api/v1/auth/token \
  -H "X-API-Key: sk_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{"subject": "user-123", "expiresIn": "4h"}'

# Response: {"token": "eyJ...", ...}
```

### 5. Play Content

```html
<div id="player"
     data-opendrm-player
     data-manifest="https://cdn.example.com/video/manifest.mpd"
     data-license-server="http://localhost:3000"
     data-token="eyJ...">
</div>
<script src="https://cdn.opendrm.io/embed.js"></script>
```

---

## SDK Installation

### Python

```bash
pip install opendrm
```

```python
from opendrm import OpenDRM

client = OpenDRM(api_key="sk_live_...", base_url="https://drm.example.com")

# Create key
key = client.keys.create()
print(f"Key ID: {key.key_id}")

# Generate token
token = client.auth.generate_token(subject="user-123")
```

### Go

```bash
go get github.com/TheKhosa/OpenDRM/sdks/go
```

```go
import "github.com/TheKhosa/OpenDRM/sdks/go"

client := opendrm.New("sk_live_...", "https://drm.example.com")

// Create key
key, _ := client.Keys.Create(nil)
fmt.Println("Key ID:", key.KeyID)

// Generate token
token, _ := client.Auth.GenerateToken(&opendrm.TokenRequest{
    Subject: "user-123",
})
```

### PHP

```php
require_once 'vendor/autoload.php';

use OpenDRM\Client;

$client = new Client('sk_live_...', 'https://drm.example.com');

// Create key
$key = $client->keys->create();
echo "Key ID: " . $key->keyId;

// Generate token
$token = $client->auth->generateToken(['subject' => 'user-123']);
```

### JavaScript/Node.js

```javascript
// Server-side
const response = await fetch('https://drm.example.com/api/v1/auth/token', {
  method: 'POST',
  headers: {
    'X-API-Key': 'sk_live_...',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    subject: 'user-123',
    contentId: 'video-001',
  }),
});

const { token } = await response.json();
```

---

## Webhooks

Receive real-time notifications for DRM events.

### Setup

```bash
curl -X POST http://localhost:3000/api/v1/webhooks \
  -H "X-API-Key: sk_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-server.com/webhooks/drm",
    "events": ["license.issued", "license.denied", "key.created"]
  }'
```

### Available Events

| Event | Description |
|-------|-------------|
| `key.created` | New encryption key created |
| `key.revoked` | Key was revoked |
| `license.issued` | License successfully issued |
| `license.denied` | License request denied |
| `content.registered` | New content registered |

### Webhook Payload

```json
{
  "id": "evt_abc123",
  "event": "license.issued",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "contentId": "video-001",
    "drmType": "clearkey",
    "clientIp": "192.168.1.1"
  }
}
```

### Signature Verification

All webhooks are signed with HMAC-SHA256. Verify the signature:

```python
import hmac
import hashlib

def verify_webhook(payload: str, signature: str, secret: str) -> bool:
    expected = 'sha256=' + hmac.new(
        secret.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)
```

---

## Player Integration

### Option 1: Drop-in Embed

```html
<div data-opendrm-player
     data-manifest="..."
     data-license-server="..."
     data-token="...">
</div>
<script src="https://cdn.opendrm.io/embed.js"></script>
```

### Option 2: SDK (Full Control)

```javascript
import { OpenDRMPlayer } from '@opendrm/player-sdk';

const player = new OpenDRMPlayer({
  container: '#video',
  licenseServer: 'https://drm.example.com',
  token: 'eyJ...',
});

await player.load({
  manifestUrl: 'https://cdn.example.com/video/manifest.mpd',
});

player.on('licenseAcquired', (drmType) => {
  console.log('DRM license acquired:', drmType);
});

await player.play();
```

### Option 3: Direct Shaka/Video.js

```javascript
// Shaka Player
const player = new shaka.Player(videoElement);

player.configure({
  drm: {
    servers: {
      'org.w3.clearkey': 'https://drm.example.com/api/v1/license/clearkey',
    },
  },
});

player.getNetworkingEngine().registerRequestFilter((type, request) => {
  if (type === shaka.net.NetworkingEngine.RequestType.LICENSE) {
    request.headers['Authorization'] = 'Bearer ' + token;
  }
});

await player.load(manifestUrl);
```

---

## Architecture Patterns

### Pattern 1: Backend Token Generation

```
User Request → Your Backend → OpenDRM API → Token
                                             ↓
                                         Your Backend → User
                                                        ↓
                                                     Player → OpenDRM License
```

### Pattern 2: Edge Token (Serverless)

```
User → Edge Function → OpenDRM API → Token → Player → OpenDRM License
```

### Pattern 3: Pre-signed URLs

```
Your Backend → Generate tokens for all content
                        ↓
                   Cache tokens
                        ↓
User Request → Cached Token → Player → OpenDRM License
```

---

## API Reference

See full OpenAPI spec at: `GET /openapi.json`

Interactive docs: `GET /docs`

### Authentication

```
X-API-Key: sk_live_...        # For server-to-server
Authorization: Bearer <jwt>    # For playback tokens
```

### Rate Limits

- License endpoints: 1000 req/min per IP
- Management endpoints: 100 req/min per API key

---

## Troubleshooting

### License Request Fails

1. Check token is valid: `POST /api/v1/auth/validate`
2. Verify key is active: `GET /api/v1/keys/{keyId}`
3. Check DRM capabilities: `GET /api/v1/license/capabilities`

### CORS Issues

Ensure your Caddy/NGINX config includes:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Headers: Authorization, Content-Type
```

### Key Not Found

The key ID in your manifest must match exactly (hex format, 32 characters).

---

## Support

- GitHub Issues: https://github.com/TheKhosa/OpenDRM/issues
- API Status: `GET /health`
