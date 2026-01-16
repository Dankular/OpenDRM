"""
OpenDRM Python Client
"""

import json
import hmac
import hashlib
from typing import Optional, List, Dict, Any
from urllib.request import Request, urlopen
from urllib.error import HTTPError

from .models import Key, Content, Token, Webhook, ApiKey


class OpenDRMError(Exception):
    """Base exception for OpenDRM errors"""

    def __init__(self, message: str, status_code: int = 0, response: Optional[Dict] = None):
        self.message = message
        self.status_code = status_code
        self.response = response
        super().__init__(message)


class KeysResource:
    """Keys API resource"""

    def __init__(self, client: "OpenDRM"):
        self._client = client

    def create(self, expires_at: Optional[str] = None) -> Key:
        """Create a new encryption key"""
        data = {}
        if expires_at:
            data["expiresAt"] = expires_at
        response = self._client._request("POST", "/api/v1/keys", data)
        return Key.from_dict(response)

    def get(self, key_id: str) -> Key:
        """Get key metadata"""
        response = self._client._request("GET", f"/api/v1/keys/{key_id}")
        return Key.from_dict(response)

    def list(self, limit: int = 50, offset: int = 0) -> List[Key]:
        """List all keys"""
        response = self._client._request("GET", f"/api/v1/keys?limit={limit}&offset={offset}")
        return [Key.from_dict(k) for k in response.get("keys", [])]

    def revoke(self, key_id: str) -> bool:
        """Revoke a key"""
        self._client._request("DELETE", f"/api/v1/keys/{key_id}")
        return True


class ContentResource:
    """Content API resource"""

    def __init__(self, client: "OpenDRM"):
        self._client = client

    def register(
        self,
        content_id: str,
        title: Optional[str] = None,
        key_id: Optional[str] = None,
        policy_id: Optional[str] = None,
    ) -> Content:
        """Register new content"""
        data = {"contentId": content_id}
        if title:
            data["title"] = title
        if key_id:
            data["keyId"] = key_id
        if policy_id:
            data["policyId"] = policy_id
        response = self._client._request("POST", "/api/v1/content", data)
        return Content.from_dict(response)

    def get(self, content_id: str) -> Content:
        """Get content by ID"""
        response = self._client._request("GET", f"/api/v1/content/{content_id}")
        return Content.from_dict(response)


class AuthResource:
    """Auth API resource"""

    def __init__(self, client: "OpenDRM"):
        self._client = client

    def generate_token(
        self,
        subject: str,
        content_id: Optional[str] = None,
        key_ids: Optional[List[str]] = None,
        expires_in: str = "1h",
    ) -> Token:
        """Generate a playback token"""
        data = {"subject": subject, "expiresIn": expires_in}
        if content_id:
            data["contentId"] = content_id
        if key_ids:
            data["keyIds"] = key_ids
        response = self._client._request("POST", "/api/v1/auth/token", data)
        return Token.from_dict(response)

    def validate_token(self, token: str) -> Dict[str, Any]:
        """Validate a token"""
        response = self._client._request("POST", "/api/v1/auth/validate", {"token": token})
        return response


class WebhooksResource:
    """Webhooks API resource"""

    def __init__(self, client: "OpenDRM"):
        self._client = client

    def create(
        self,
        url: str,
        events: List[str],
        secret: Optional[str] = None,
    ) -> Webhook:
        """Create a webhook"""
        data = {"url": url, "events": events}
        if secret:
            data["secret"] = secret
        response = self._client._request("POST", "/api/v1/webhooks", data)
        return Webhook.from_dict(response)

    def list(self) -> List[Webhook]:
        """List all webhooks"""
        response = self._client._request("GET", "/api/v1/webhooks")
        return [Webhook.from_dict(w) for w in response]

    def delete(self, webhook_id: str) -> bool:
        """Delete a webhook"""
        self._client._request("DELETE", f"/api/v1/webhooks/{webhook_id}")
        return True

    @staticmethod
    def verify_signature(payload: str, signature: str, secret: str) -> bool:
        """Verify a webhook signature"""
        expected = "sha256=" + hmac.new(
            secret.encode(), payload.encode(), hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(expected, signature)


class ApiKeysResource:
    """API Keys resource"""

    def __init__(self, client: "OpenDRM"):
        self._client = client

    def create(
        self,
        name: str,
        scopes: Optional[List[str]] = None,
        expires_at: Optional[str] = None,
    ) -> ApiKey:
        """Create an API key"""
        data = {"name": name}
        if scopes:
            data["scopes"] = scopes
        if expires_at:
            data["expiresAt"] = expires_at
        response = self._client._request("POST", "/api/v1/apikeys", data)
        return ApiKey.from_dict(response)

    def list(self) -> List[ApiKey]:
        """List all API keys"""
        response = self._client._request("GET", "/api/v1/apikeys")
        return [ApiKey.from_dict(k) for k in response]

    def revoke(self, key_id: str) -> bool:
        """Revoke an API key"""
        self._client._request("DELETE", f"/api/v1/apikeys/{key_id}")
        return True


class OpenDRM:
    """
    OpenDRM API Client

    Usage:
        client = OpenDRM(api_key="sk_live_xxx", base_url="https://api.example.com")
        key = client.keys.create()
    """

    def __init__(
        self,
        api_key: str,
        base_url: str = "http://localhost:3000",
        timeout: int = 30,
    ):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

        # Initialize resources
        self.keys = KeysResource(self)
        self.content = ContentResource(self)
        self.auth = AuthResource(self)
        self.webhooks = WebhooksResource(self)
        self.apikeys = ApiKeysResource(self)

    def _request(
        self,
        method: str,
        path: str,
        data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Make an API request"""
        url = f"{self.base_url}{path}"

        headers = {
            "X-API-Key": self.api_key,
            "Content-Type": "application/json",
            "User-Agent": "OpenDRM-Python/0.1.0",
        }

        body = json.dumps(data).encode() if data else None

        request = Request(url, data=body, headers=headers, method=method)

        try:
            with urlopen(request, timeout=self.timeout) as response:
                response_data = response.read().decode()
                return json.loads(response_data) if response_data else {}
        except HTTPError as e:
            error_body = e.read().decode()
            try:
                error_data = json.loads(error_body)
                message = error_data.get("error", str(e))
            except json.JSONDecodeError:
                message = error_body or str(e)
            raise OpenDRMError(message, e.code, error_data if "error_data" in dir() else None)
