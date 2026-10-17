from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class ConversationChannel(str, Enum):
    WHATSAPP = "whatsapp"
    WEB_CHAT = "web_chat"
    INSTAGRAM = "instagram"


class ConversationStatus(str, Enum):
    ACTIVE = "ACTIVE"
    WAITING_HUMAN = "WAITING_HUMAN"
    RESOLVED = "RESOLVED"
    CLOSED = "CLOSED"


class ConversationModel(BaseModel):
    """MongoDB Conversation Document Representation."""
    id: Optional[str] = Field(default=None, alias="_id")
    customer_id: str = Field(..., description="Reference to Customer _id", index=True)
    channel: ConversationChannel = Field(default=ConversationChannel.WHATSAPP, description="Communication channel")
    status: ConversationStatus = Field(default=ConversationStatus.ACTIVE, description="Status of the dialogue", index=True)
    assigned_user_id: Optional[str] = Field(default=None, description="Human agent/staff User _id if handed off", index=True)
    last_message_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="Timestamp of the latest message", index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="Conversation start timestamp")

    model_config = ConfigDict(
        populate_by_name=True,
        use_enum_values=True,
        json_schema_extra={
            "example": {
                "customer_id": "60d5ecb8b487343568912345",
                "channel": "whatsapp",
                "status": "ACTIVE",
                "assigned_user_id": None,
            }
        },
    )


class ConversationCreate(BaseModel):
    customer_id: str
    channel: ConversationChannel = ConversationChannel.WHATSAPP
    status: ConversationStatus = ConversationStatus.ACTIVE
    assigned_user_id: Optional[str] = None


class ConversationUpdate(BaseModel):
    status: Optional[ConversationStatus] = None
    assigned_user_id: Optional[str] = None
    last_message_at: Optional[datetime] = None


class ConversationResponse(BaseModel):
    id: str
    customer_id: str
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_address: Optional[str] = None
    customer_city: Optional[str] = None
    customer_email: Optional[str] = None
    active_product_id: Optional[str] = None
    active_product_name: Optional[str] = None
    last_message_text: Optional[str] = None
    channel: ConversationChannel = ConversationChannel.WHATSAPP
    status: ConversationStatus = ConversationStatus.ACTIVE
    assigned_user_id: Optional[str] = None
    last_message_at: datetime
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

