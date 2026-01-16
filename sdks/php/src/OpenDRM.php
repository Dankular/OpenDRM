<?php

namespace OpenDRM;

/**
 * OpenDRM PHP SDK
 *
 * Usage:
 *     $client = new OpenDRM\Client('sk_live_xxx', 'https://api.example.com');
 *
 *     // Create a key
 *     $key = $client->keys->create();
 *     echo "Key ID: " . $key->keyId;
 *
 *     // Generate a playback token
 *     $token = $client->auth->generateToken([
 *         'subject' => 'user-123',
 *         'contentId' => 'video-001'
 *     ]);
 */

class OpenDRMException extends \Exception
{
    public int $statusCode;
    public ?array $response;

    public function __construct(string $message, int $statusCode = 0, ?array $response = null)
    {
        parent::__construct($message);
        $this->statusCode = $statusCode;
        $this->response = $response;
    }
}

class Client
{
    private string $apiKey;
    private string $baseUrl;
    private int $timeout;

    public KeysResource $keys;
    public ContentResource $content;
    public AuthResource $auth;
    public WebhooksResource $webhooks;
    public ApiKeysResource $apikeys;

    public function __construct(string $apiKey, string $baseUrl = 'http://localhost:3000', int $timeout = 30)
    {
        $this->apiKey = $apiKey;
        $this->baseUrl = rtrim($baseUrl, '/');
        $this->timeout = $timeout;

        $this->keys = new KeysResource($this);
        $this->content = new ContentResource($this);
        $this->auth = new AuthResource($this);
        $this->webhooks = new WebhooksResource($this);
        $this->apikeys = new ApiKeysResource($this);
    }

    public function request(string $method, string $path, ?array $data = null): mixed
    {
        $url = $this->baseUrl . $path;

        $headers = [
            'X-API-Key: ' . $this->apiKey,
            'Content-Type: application/json',
            'User-Agent: OpenDRM-PHP/0.1.0',
        ];

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, $this->timeout);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);

        if ($data !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        }

        $response = curl_exec($ch);
        $statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            throw new OpenDRMException("cURL error: $error");
        }

        $decoded = json_decode($response, true);

        if ($statusCode >= 400) {
            $message = $decoded['error'] ?? $response;
            throw new OpenDRMException($message, $statusCode, $decoded);
        }

        return $decoded;
    }

    /**
     * Verify a webhook signature
     */
    public static function verifySignature(string $payload, string $signature, string $secret): bool
    {
        $expected = 'sha256=' . hash_hmac('sha256', $payload, $secret);
        return hash_equals($expected, $signature);
    }
}

class KeysResource
{
    private Client $client;

    public function __construct(Client $client)
    {
        $this->client = $client;
    }

    public function create(?string $expiresAt = null): object
    {
        $data = [];
        if ($expiresAt) {
            $data['expiresAt'] = $expiresAt;
        }
        return (object) $this->client->request('POST', '/api/v1/keys', $data ?: null);
    }

    public function get(string $keyId): object
    {
        return (object) $this->client->request('GET', "/api/v1/keys/$keyId");
    }

    public function list(int $limit = 50, int $offset = 0): array
    {
        $response = $this->client->request('GET', "/api/v1/keys?limit=$limit&offset=$offset");
        return array_map(fn($k) => (object) $k, $response['keys'] ?? []);
    }

    public function revoke(string $keyId): bool
    {
        $this->client->request('DELETE', "/api/v1/keys/$keyId");
        return true;
    }
}

class ContentResource
{
    private Client $client;

    public function __construct(Client $client)
    {
        $this->client = $client;
    }

    public function register(array $data): object
    {
        return (object) $this->client->request('POST', '/api/v1/content', $data);
    }

    public function get(string $contentId): object
    {
        return (object) $this->client->request('GET', "/api/v1/content/$contentId");
    }
}

class AuthResource
{
    private Client $client;

    public function __construct(Client $client)
    {
        $this->client = $client;
    }

    public function generateToken(array $data): object
    {
        return (object) $this->client->request('POST', '/api/v1/auth/token', $data);
    }

    public function validateToken(string $token): object
    {
        return (object) $this->client->request('POST', '/api/v1/auth/validate', ['token' => $token]);
    }
}

class WebhooksResource
{
    private Client $client;

    public function __construct(Client $client)
    {
        $this->client = $client;
    }

    public function create(array $data): object
    {
        return (object) $this->client->request('POST', '/api/v1/webhooks', $data);
    }

    public function list(): array
    {
        $response = $this->client->request('GET', '/api/v1/webhooks');
        return array_map(fn($w) => (object) $w, $response);
    }

    public function delete(string $webhookId): bool
    {
        $this->client->request('DELETE', "/api/v1/webhooks/$webhookId");
        return true;
    }
}

class ApiKeysResource
{
    private Client $client;

    public function __construct(Client $client)
    {
        $this->client = $client;
    }

    public function create(array $data): object
    {
        return (object) $this->client->request('POST', '/api/v1/apikeys', $data);
    }

    public function list(): array
    {
        $response = $this->client->request('GET', '/api/v1/apikeys');
        return array_map(fn($k) => (object) $k, $response);
    }

    public function revoke(string $keyId): bool
    {
        $this->client->request('DELETE', "/api/v1/apikeys/$keyId");
        return true;
    }
}
