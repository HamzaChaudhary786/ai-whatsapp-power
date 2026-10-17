from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class ConsentStatus(str, Enum):
    OPTED_IN = "OPTED_IN"
    OPTED_OUT = "OPTED_OUT"
    PENDING = "PENDING"


class CustomerModel(BaseModel):
    """MongoDB Customer Document Representation."""
    id: Optional[str] = Field(default=None, alias="_id")
    whatsapp_id: str = Field(..., description="Unique WhatsApp phone number or ID", index=True)
    phone: Optional[str] = None
    name: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    consent_status: ConsentStatus = ConsentStatus.PENDING
    marketing_opt_in: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = ConfigDict(
        populate_by_name=True,
        use_enum_values=True,
        json_schema_extra={
            "example": {
                "whatsapp_id": "+923001234567",
                "phone": "+923001234567",
                "name": "Jane Doe",
                "email": "jane@example.com",
                "address": "House 12, Street 4, Sector F-7",
                "city": "Islamabad",
                "consent_status": "OPTED_IN",
                "marketing_opt_in": True,
            }
        },
    )


class CustomerCreate(BaseModel):
    whatsapp_id: str
    phone: Optional[str] = None
    name: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    consent_status: Optional[ConsentStatus] = ConsentStatus.PENDING
    marketing_opt_in: Optional[bool] = True


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    consent_status: Optional[ConsentStatus] = None
    marketing_opt_in: Optional[bool] = None


class CustomerResponse(BaseModel):
    id: str
    whatsapp_id: str
    phone: Optional[str] = None
    name: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    consent_status: ConsentStatus
    marketing_opt_in: bool = True
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
