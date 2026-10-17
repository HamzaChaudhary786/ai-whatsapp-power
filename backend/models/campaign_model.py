from datetime import datetime, timezone
from enum import Enum
from typing import Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class CampaignStatus(str, Enum):
    DRAFT = "DRAFT"
    SENDING = "SENDING"
    SENT = "SENT"


class CampaignModel(BaseModel):
    """MongoDB Promotional Campaign & Broadcast Document."""
    id: Optional[str] = Field(default=None, alias="_id")
    title: str = Field(..., description="Campaign headline (e.g. Mega Spring Gala Sale)")
    promo_code: Optional[str] = Field(default="SALE25", description="Promotional voucher code")
    discount_percent: Optional[int] = Field(default=25, description="Discount percentage")
    description: str = Field(..., description="Promotional message copy")
    store_url: str = Field(default="http://localhost:3000", description="Store website URL")
    channels: List[str] = Field(default=["WHATSAPP", "EMAIL"], description="Channels to dispatch")
    is_active_banner: bool = Field(default=True, description="Display on Storefront banner")
    status: CampaignStatus = Field(default=CampaignStatus.DRAFT)
    stats: Dict[str, int] = Field(
        default_factory=lambda: {
            "total_targets": 0,
            "whatsapp_sent": 0,
            "whatsapp_failed": 0,
            "email_sent": 0,
            "email_failed": 0,
            "skipped_opted_out": 0,
        }
    )
    valid_from: Optional[datetime] = Field(default=None, description="Start date/time when promotional offer becomes valid")
    valid_until: Optional[datetime] = Field(default=None, description="Expiry date/time when promotional offer expires")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    sent_at: Optional[datetime] = None

    model_config = ConfigDict(
        populate_by_name=True,
        use_enum_values=True,
        json_schema_extra={
            "example": {
                "title": "Exclusive Flash Sale - 30% OFF Everything!",
                "promo_code": "FLASH30",
                "discount_percent": 30,
                "description": "Discover our newest luxury chiffon & linen arrivals with 30% off.",
                "store_url": "http://localhost:5173",
                "channels": ["WHATSAPP", "EMAIL"],
                "is_active_banner": True,
                "valid_until": "2026-10-31T23:59:59Z",
            }
        },
    )


class CampaignCreate(BaseModel):
    title: str
    promo_code: Optional[str] = "FLASH25"
    discount_percent: Optional[int] = 25
    description: str
    store_url: Optional[str] = "http://localhost:3000"
    channels: Optional[List[str]] = ["WHATSAPP", "EMAIL"]
    is_active_banner: Optional[bool] = True
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None


class CampaignResponse(BaseModel):
    id: str
    title: str
    promo_code: Optional[str] = None
    discount_percent: Optional[int] = None
    description: str
    store_url: str
    channels: List[str]
    is_active_banner: bool
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None
    status: CampaignStatus
    stats: Dict[str, int]
    created_at: datetime
    sent_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

