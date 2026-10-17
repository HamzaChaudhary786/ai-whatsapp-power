from datetime import datetime, timezone
from typing import Any, Dict, Optional
from pydantic import BaseModel, ConfigDict, Field


class AuditLogModel(BaseModel):
    """MongoDB Audit Log Document Representation for Tracking Activity & Security."""
    id: Optional[str] = Field(default=None, alias="_id")
    actor_user_id: Optional[str] = Field(default=None, description="User _id who performed the action (None if automated system action)", index=True)
    action: str = Field(..., description="Action performed (e.g. USER_LOGIN, ORDER_STATUS_UPDATE, PRODUCT_CREATED)", index=True)
    entity_type: str = Field(..., description="Entity type affected (e.g. orders, products, customers, users)", index=True)
    entity_id: Optional[str] = Field(default=None, description="Identifier of the modified entity", index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="Action timestamp", index=True)
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Arbitrary context data (IP address, payload changes, diffs)")

    model_config = ConfigDict(
        populate_by_name=True,
        json_schema_extra={
            "example": {
                "actor_user_id": "60d5ecb8b487343568912345",
                "action": "ORDER_STATUS_UPDATE",
                "entity_type": "orders",
                "entity_id": "60d5ecb8b487343568999999",
                "created_at": "2026-10-11T21:05:00Z",
                "metadata": {
                    "previous_status": "PENDING",
                    "new_status": "CONFIRMED",
                    "ip_address": "192.168.1.1",
                },
            }
        },
    )


class AuditLogCreate(BaseModel):
    actor_user_id: Optional[str] = None
    action: str
    entity_type: str
    entity_id: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class AuditLogResponse(BaseModel):
    id: str
    actor_user_id: Optional[str] = None
    action: str
    entity_type: str
    entity_id: Optional[str] = None
    created_at: datetime
    metadata: Dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(from_attributes=True)
