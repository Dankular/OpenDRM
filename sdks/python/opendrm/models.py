"""
OpenDRM API Models
"""

from dataclasses import dataclass
from typing import Optional, List, Dict, Any
from datetime import datetime


@dataclass
class Key:
    id: str
    key_id: str
    status: str
    created_at: datetime
    expires_at: Optional[datetime] = None
    key_value: Optional[str] = None  # Only on creation

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Key":
        return cls(
            id=data["id"],
            key_id=data["keyId"],
            status=data["status"],
            created_at=datetime.fromisoformat(data["createdAt"].replace("Z", "+00:00")),
            expires_at=datetime.fromisoformat(data["expiresAt"].replace("Z", "+00:00")) if data.get("expiresAt") else None,
            key_value=data.get("keyValue"),
        )


@dataclass
class Content:
    id: str
    content_id: str
    title: Optional[str]
    key_id: Optional[str]
    policy_id: Optional[str]
    created_at: datetime

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Content":
        return cls(
            id=data["id"],
            content_id=data["contentId"],
            title=data.get("title"),
            key_id=data.get("keyId"),
            policy_id=data.get("policyId"),
            created_at=datetime.fromisoformat(data["createdAt"].replace("Z", "+00:00")),
        )


@dataclass
class Token:
    token: str
    expires_in: str
    expires_at: Optional[datetime] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Token":
        return cls(
            token=data["token"],
            expires_in=data["expiresIn"],
            expires_at=datetime.fromisoformat(data["expiresAt"].replace("Z", "+00:00")) if data.get("expiresAt") else None,
        )


@dataclass
class Webhook:
    id: str
    url: str
    events: List[str]
    status: str
    created_at: datetime
    secret: Optional[str] = None  # Only on creation

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Webhook":
        return cls(
            id=data["id"],
            url=data["url"],
            events=data["events"],
            status=data["status"],
            created_at=datetime.fromisoformat(data["createdAt"].replace("Z", "+00:00")),
            secret=data.get("secret"),
        )


@dataclass
class ApiKey:
    id: str
    name: str
    key_prefix: str
    scopes: List[str]
    status: str
    created_at: datetime
    key: Optional[str] = None  # Only on creation
    expires_at: Optional[datetime] = None
    last_used_at: Optional[datetime] = None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ApiKey":
        return cls(
            id=data["id"],
            name=data["name"],
            key_prefix=data["keyPrefix"],
            scopes=data["scopes"],
            status=data["status"],
            created_at=datetime.fromisoformat(data["createdAt"].replace("Z", "+00:00")),
            key=data.get("key"),
            expires_at=datetime.fromisoformat(data["expiresAt"].replace("Z", "+00:00")) if data.get("expiresAt") else None,
            last_used_at=datetime.fromisoformat(data["lastUsedAt"].replace("Z", "+00:00")) if data.get("lastUsedAt") else None,
        )
