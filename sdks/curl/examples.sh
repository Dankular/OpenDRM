#!/bin/bash
# OpenDRM cURL Examples
# Quick reference for API integration

# Configuration
BASE_URL="${OPENDRM_URL:-http://localhost:3000}"
API_KEY="${OPENDRM_API_KEY:-sk_live_your_api_key}"

# ====================
# Keys API
# ====================

# Create a new encryption key
create_key() {
  curl -X POST "$BASE_URL/api/v1/keys" \
    -H "X-API-Key: $API_KEY" \
    -H "Content-Type: application/json" \
    -d '{}'
}

# Create key with expiration
create_key_with_expiry() {
  curl -X POST "$BASE_URL/api/v1/keys" \
    -H "X-API-Key: $API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"expiresAt": "2025-12-31T23:59:59Z"}'
}

# Get key metadata
get_key() {
  local KEY_ID="$1"
  curl -X GET "$BASE_URL/api/v1/keys/$KEY_ID" \
    -H "X-API-Key: $API_KEY"
}

# List all keys
list_keys() {
  curl -X GET "$BASE_URL/api/v1/keys?limit=50&offset=0" \
    -H "X-API-Key: $API_KEY"
}

# Revoke a key
revoke_key() {
  local KEY_ID="$1"
  curl -X DELETE "$BASE_URL/api/v1/keys/$KEY_ID" \
    -H "X-API-Key: $API_KEY"
}

# ====================
# Content API
# ====================

# Register content
register_content() {
  curl -X POST "$BASE_URL/api/v1/content" \
    -H "X-API-Key: $API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "contentId": "video-001",
      "title": "My Video",
      "keyId": "abc123..."
    }'
}

# Get content
get_content() {
  local CONTENT_ID="$1"
  curl -X GET "$BASE_URL/api/v1/content/$CONTENT_ID" \
    -H "X-API-Key: $API_KEY"
}

# ====================
# Auth API
# ====================

# Generate playback token
generate_token() {
  curl -X POST "$BASE_URL/api/v1/auth/token" \
    -H "X-API-Key: $API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "subject": "user-123",
      "contentId": "video-001",
      "expiresIn": "24h"
    }'
}

# Validate token
validate_token() {
  local TOKEN="$1"
  curl -X POST "$BASE_URL/api/v1/auth/validate" \
    -H "X-API-Key: $API_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"token\": \"$TOKEN\"}"
}

# ====================
# License API
# ====================

# ClearKey license request (EME format)
get_clearkey_license() {
  local TOKEN="$1"
  local KEY_IDS="$2"  # Base64url encoded key IDs
  curl -X POST "$BASE_URL/api/v1/license/clearkey" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"kids\": [\"$KEY_IDS\"],
      \"type\": \"temporary\"
    }"
}

# ====================
# Webhooks API
# ====================

# Create webhook
create_webhook() {
  curl -X POST "$BASE_URL/api/v1/webhooks" \
    -H "X-API-Key: $API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "url": "https://your-server.com/webhook",
      "events": ["key.created", "license.issued", "license.denied"]
    }'
}

# List webhooks
list_webhooks() {
  curl -X GET "$BASE_URL/api/v1/webhooks" \
    -H "X-API-Key: $API_KEY"
}

# Delete webhook
delete_webhook() {
  local WEBHOOK_ID="$1"
  curl -X DELETE "$BASE_URL/api/v1/webhooks/$WEBHOOK_ID" \
    -H "X-API-Key: $API_KEY"
}

# ====================
# API Keys
# ====================

# Create API key
create_api_key() {
  curl -X POST "$BASE_URL/api/v1/apikeys" \
    -H "X-API-Key: $API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Production API Key",
      "scopes": ["keys:read", "keys:write", "license:issue"]
    }'
}

# List API keys
list_api_keys() {
  curl -X GET "$BASE_URL/api/v1/apikeys" \
    -H "X-API-Key: $API_KEY"
}

# ====================
# Health & Info
# ====================

# Health check
health_check() {
  curl -X GET "$BASE_URL/health"
}

# Get DRM capabilities
get_capabilities() {
  curl -X GET "$BASE_URL/api/v1/license/capabilities"
}

# Get OpenAPI spec
get_openapi_spec() {
  curl -X GET "$BASE_URL/openapi.json"
}

# ====================
# Example Workflow
# ====================

full_workflow_example() {
  echo "=== OpenDRM Full Workflow Example ==="

  echo -e "\n1. Creating encryption key..."
  KEY_RESPONSE=$(create_key)
  echo "$KEY_RESPONSE" | jq .

  KEY_ID=$(echo "$KEY_RESPONSE" | jq -r '.keyId')
  KEY_VALUE=$(echo "$KEY_RESPONSE" | jq -r '.keyValue')

  echo -e "\n2. Registering content..."
  register_content | jq .

  echo -e "\n3. Generating playback token..."
  TOKEN_RESPONSE=$(generate_token)
  echo "$TOKEN_RESPONSE" | jq .

  TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.token')

  echo -e "\n4. Token ready for player:"
  echo "   Token: $TOKEN"
  echo "   Key ID (for packager): $KEY_ID"
  echo "   Key Value (for packager): $KEY_VALUE"
}

# Run if script is executed directly
case "$1" in
  create-key) create_key ;;
  get-key) get_key "$2" ;;
  list-keys) list_keys ;;
  revoke-key) revoke_key "$2" ;;
  register-content) register_content ;;
  generate-token) generate_token ;;
  validate-token) validate_token "$2" ;;
  create-webhook) create_webhook ;;
  list-webhooks) list_webhooks ;;
  health) health_check ;;
  capabilities) get_capabilities ;;
  workflow) full_workflow_example ;;
  *)
    echo "OpenDRM CLI Examples"
    echo "Usage: $0 <command> [args]"
    echo ""
    echo "Commands:"
    echo "  create-key              Create new encryption key"
    echo "  get-key <keyId>         Get key metadata"
    echo "  list-keys               List all keys"
    echo "  revoke-key <keyId>      Revoke a key"
    echo "  register-content        Register content"
    echo "  generate-token          Generate playback token"
    echo "  validate-token <token>  Validate a token"
    echo "  create-webhook          Create a webhook"
    echo "  list-webhooks           List webhooks"
    echo "  health                  Health check"
    echo "  capabilities            Get DRM capabilities"
    echo "  workflow                Run full workflow example"
    ;;
esac
