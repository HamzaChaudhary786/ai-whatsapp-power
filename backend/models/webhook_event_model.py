from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, Optional
from pydantic import BaseModel, ConfigDict, Field


class WebhookProcessingStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class WebhookEventModel(BaseModel):
    """MongoDB Webhook Event Document Representation for Idempotency & Retries."""
    id: Optional[str] = Field(default=None, alias="_id")
    provider_event_id: str = Field(..., description="Unique event identifier from WhatsApp/Meta", index=True)
    received_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="Timestamp event was received")
    processing_status: WebhookProcessingStatus = Field(default=WebhookProcessingStatus.PENDING, description="Current processing state", index=True)
    attempts: int = Field(default=0, ge=0, description="Processing attempt count")
    last_error: Optional[str] = Field(default=None, description="Last recorded error message if processing failed")
    payload: Optional[Dict[str, Any]] = Field(default=None, description="Raw incoming webhook payload for auditing/replay")

    model_config = ConfigDict(
        populate_by_name=True,
        use_enum_values=True,
        json_schema_extra={
            "example": {
                "provider_event_id": "evt_meta_981729381203",
                "received_at": "2026-10-11T21:03:00Z",
                "processing_status": "completed",
                "attempts": 1,
                "last_error": None,
                "payload": {"entry": [{"id": "12345"}]},
            }
        },
    )


class WebhookEventCreate(BaseModel):
    provider_event_id: str
    received_at: Optional[datetime] = None
    processing_status: WebhookProcessingStatus = WebhookProcessingStatus.PENDING
    attempts: int = 0
    last_error: Optional[str] = None
    payload: Optional[Dict[str, Any]] = None


class WebhookEventUpdate(BaseModel):
    processing_status: Optional[WebhookProcessingStatus] = None
    attempts: Optional[int] = None
    last_error: Optional[str] = None


class WebhookEventResponse(BaseModel):
    id: str
    provider_event_id: str
    received_at: datetime
    processing_status: WebhookProcessingStatus
    attempts: int
    last_error: Optional[str] = None
    payload: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True)
