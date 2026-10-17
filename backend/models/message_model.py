from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class MessageDirection(str, Enum):
    INBOUND = "inbound"
    OUTBOUND = "outbound"


class DeliveryStatus(str, Enum):
    RECEIVED = "received"
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"
    FAILED = "failed"


class MessageModel(BaseModel):
    """MongoDB Message Document Representation."""
    id: Optional[str] = Field(default=None, alias="_id")
    conversation_id: str = Field(..., description="Reference to parent Conversation _id", index=True)
    external_message_id: Optional[str] = Field(default=None, description="WhatsApp message ID (wamid...)", index=True)
    direction: MessageDirection = Field(..., description="Message direction: inbound (from user) or outbound (from bot/agent)")
    text: str = Field(..., description="Message text body")
    image_url: Optional[str] = Field(default=None, description="Optional image/photo URL attached to message")
    intent: Optional[str] = Field(default=None, description="NLP predicted intent for customer message")
    confidence: Optional[float] = Field(default=None, ge=0.0, le=1.0, description="Intent confidence score (0.0 to 1.0)")
    delivery_status: DeliveryStatus = Field(default=DeliveryStatus.RECEIVED, description="Delivery receipt status")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="Timestamp of message", index=True)

    model_config = ConfigDict(
        populate_by_name=True,
        use_enum_values=True,
        json_schema_extra={
            "example": {
                "conversation_id": "60d5ecb8b487343568912345",
                "external_message_id": "wamid.HBgLMjM0OTk5OTk5OQ==",
                "direction": "inbound",
                "text": "Show me summer dresses",
                "image_url": None,
                "intent": "browse_catalog",
                "confidence": 0.94,
                "delivery_status": "received",
            }
        },
    )


class MessageCreate(BaseModel):
    conversation_id: str
    external_message_id: Optional[str] = None
    direction: MessageDirection
    text: str
    image_url: Optional[str] = None
    intent: Optional[str] = None
    confidence: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    delivery_status: DeliveryStatus = DeliveryStatus.RECEIVED


class MessageUpdateDelivery(BaseModel):
    delivery_status: DeliveryStatus


class MessageResponse(BaseModel):
    id: str
    conversation_id: str
    external_message_id: Optional[str] = None
    direction: MessageDirection
    text: str
    image_url: Optional[str] = None
    intent: Optional[str] = None
    confidence: Optional[float] = None
    delivery_status: DeliveryStatus
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
