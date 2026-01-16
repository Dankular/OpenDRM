"""
OpenDRM Python SDK

A simple, plug-and-play client for the OpenDRM API.

Usage:
    from opendrm import OpenDRM

    client = OpenDRM(api_key="sk_live_xxx", base_url="https://api.example.com")

    # Create a key
    key = client.keys.create()
    print(f"Key ID: {key.key_id}, Key Value: {key.key_value}")

    # Generate a playback token
    token = client.auth.generate_token(subject="user-123", content_id="video-001")

    # Register a webhook
    webhook = client.webhooks.create(
        url="https://your-server.com/webhook",
        events=["license.issued", "key.created"]
    )
"""

from .client import OpenDRM
from .models import Key, Content, Token, Webhook, ApiKey

__version__ = "0.1.0"
__all__ = ["OpenDRM", "Key", "Content", "Token", "Webhook", "ApiKey"]
