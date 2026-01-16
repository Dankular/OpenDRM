# OpenDRM

An open-source, enterprise-ready Digital Rights Management (DRM) solution supporting ClearKey, Widevine, and FairPlay.

## Features

- **Community Tier (ClearKey)**: Free, self-hosted DRM using the W3C EME ClearKey standard
- **Enterprise Tier**: Proxy support for Widevine and FairPlay license servers
- **Content Packaging**: Shaka Packager integration for DASH + HLS output
- **High-Performance CDN**: Caddy + Varnish + NGINX stack
- **Player SDK**: Unified API for Shaka Player and Video.js
- **Monitoring**: Prometheus metrics + Grafana dashboards
- **Multi-Backend Storage**: Local, S3, GCS, Azure Blob support

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CONTENT PIPELINE                          │
│  Source Media → Shaka Packager → Encrypted DASH/HLS → Storage   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                         DELIVERY STACK                           │
│  Client → Caddy (Edge/TLS) → Varnish (Cache) → NGINX (Origin)   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        LICENSE SERVER                            │
│  ClearKey Handler ←→ PostgreSQL (Keys/Policies)                 │
│  Widevine Proxy   ←→ External License Servers                   │
│  FairPlay Proxy   ←→ External License Servers                   │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker & Docker Compose

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/opendrm.git
cd opendrm

# Install dependencies
pnpm install

# Copy environment file
cp .env.example .env

# Generate secrets (Linux/macOS)
echo "KEY_ENCRYPTION_SECRET=$(openssl rand -hex 32)" >> .env
echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env

# Start all services
docker compose up -d

# Run database migrations
pnpm db:migrate
```

### Verify Installation

```bash
# Check service health
curl http://localhost:3000/health

# Check DRM capabilities
curl http://localhost:3000/api/v1/license/capabilities
```

## Usage

### 1. Create an Encryption Key

```bash
curl -X POST http://localhost:3000/api/v1/keys \
  -H "Content-Type: application/json"
```

Response:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "keyId": "a]b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5",
  "keyValue": "1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d",
  "status": "active"
}
```

### 2. Package Content

```bash
curl -X POST http://localhost:3001/api/v1/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "contentId": "my-video-001",
    "inputPath": "/data/input/video.mp4",
    "keyId": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
    "outputFormats": ["dash", "hls"],
    "drmSystems": ["clearkey"]
  }'
```

### 3. Generate Playback Token

```bash
curl -X POST http://localhost:3000/api/v1/auth/token \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "user-123",
    "contentId": "my-video-001",
    "expiresIn": "24h"
  }'
```

### 4. Play Content (Browser)

```html
<script src="https://cdn.jsdelivr.net/npm/shaka-player/dist/shaka-player.compiled.js"></script>
<script src="@opendrm/player-sdk"></script>

<div id="video-container"></div>

<script>
const player = new OpenDRMPlayer({
  container: '#video-container',
  licenseServer: 'http://localhost:3000',
  playerType: 'shaka'
});

await player.load({
  manifestUrl: 'http://localhost/content/my-video-001/manifest.mpd',
  token: 'your-playback-token'
});

await player.play();
</script>
```

## API Reference

### License Server (Port 3000)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/keys` | POST | Create encryption key |
| `/api/v1/keys/:keyId` | GET | Get key metadata |
| `/api/v1/keys/:keyId` | DELETE | Revoke key |
| `/api/v1/license/clearkey` | POST | ClearKey license request (EME) |
| `/api/v1/license/widevine` | POST | Widevine license proxy |
| `/api/v1/license/fairplay` | POST | FairPlay license proxy |
| `/api/v1/content` | POST | Register content |
| `/api/v1/content/:contentId` | GET | Get content info |
| `/api/v1/auth/token` | POST | Generate playback token |
| `/api/v1/auth/validate` | POST | Validate token |
| `/metrics` | GET | Prometheus metrics |
| `/health` | GET | Health check |

### Packager Service (Port 3001)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/jobs` | POST | Submit packaging job |
| `/api/v1/jobs/:jobId` | GET | Get job status |
| `/api/v1/jobs/:jobId/output` | GET | Get output URLs |
| `/api/v1/jobs/:jobId` | DELETE | Cancel job |
| `/metrics` | GET | Prometheus metrics |
| `/health` | GET | Health check |

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `REDIS_URL` | Redis connection string | Required |
| `KEY_ENCRYPTION_SECRET` | 32-byte hex secret for key encryption | Required |
| `JWT_SECRET` | Secret for JWT signing | Required |
| `JWT_EXPIRY` | Token expiration time | `1h` |
| `STORAGE_BACKEND` | Storage type: local, s3, gcs, azure | `local` |
| `WIDEVINE_LICENSE_SERVER_URL` | External Widevine server | Optional |
| `FAIRPLAY_LICENSE_SERVER_URL` | External FairPlay server | Optional |

See `.env.example` for full configuration options.

## Enterprise DRM Setup

### Widevine

1. Obtain Widevine credentials from Google
2. Configure environment:
   ```bash
   WIDEVINE_LICENSE_SERVER_URL=https://your-widevine-server.com/license
   WIDEVINE_SIGNING_KEY=your-signing-key
   WIDEVINE_SIGNING_IV=your-signing-iv
   ```

### FairPlay

1. Obtain FairPlay credentials from Apple
2. Configure environment:
   ```bash
   FAIRPLAY_LICENSE_SERVER_URL=https://your-fairplay-server.com/license
   FAIRPLAY_CERTIFICATE_PATH=/path/to/certificate.der
   FAIRPLAY_ASK=your-application-secret-key
   ```

## Monitoring

### Grafana Dashboards

Access Grafana at `http://localhost:3030` (default: admin/admin)

Pre-configured dashboards:
- **License Server**: Request rates, latencies, error rates
- **CDN Performance**: Cache hit ratios, bandwidth, response times

### Prometheus Metrics

Access Prometheus at `http://localhost:9090`

Key metrics:
- `opendrm_license_requests_total` - License request counter
- `opendrm_license_request_duration_seconds` - Request latency histogram
- `opendrm_active_keys` - Active encryption keys gauge
- `opendrm_packaging_jobs_total` - Packaging job counter

## Development

```bash
# Start in development mode
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# Run individual service
pnpm --filter @opendrm/license-server dev

# Run tests
pnpm test

# Build all packages
pnpm build
```

## Project Structure

```
opendrm/
├── packages/
│   ├── license-server/    # DRM license server
│   ├── packager-service/  # Shaka Packager wrapper
│   ├── player-sdk/        # Browser player SDK
│   └── admin-ui/          # Admin dashboard (planned)
├── infrastructure/
│   ├── caddy/             # Edge server config
│   ├── varnish/           # Cache config
│   ├── nginx/             # Origin server config
│   └── prometheus/        # Monitoring config
├── grafana/               # Dashboards
├── proto/                 # gRPC definitions
└── docker-compose.yml     # Orchestration
```

## Security Considerations

- Encryption keys are encrypted at rest using AES-256-GCM
- Playback tokens are short-lived JWTs
- All internal communication uses gRPC with optional TLS
- Rate limiting on license endpoints
- Audit logging for key operations

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details.

## Support

- Documentation: [docs/](docs/)
- Issues: [GitHub Issues](https://github.com/your-org/opendrm/issues)
- Discussions: [GitHub Discussions](https://github.com/your-org/opendrm/discussions)
