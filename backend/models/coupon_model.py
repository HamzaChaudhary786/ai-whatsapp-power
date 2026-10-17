from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class DiscountType(str, Enum):
    PERCENTAGE = "PERCENTAGE"
    FIXED_PKR = "FIXED_PKR"


class CouponModel(BaseModel):
    """MongoDB Coupon Document Representation."""
    id: Optional[str] = Field(default=None, alias="_id")
    code: str = Field(..., description="Unique coupon code (e.g. WELCOME10, FLASH25)", index=True)
    discount_type: DiscountType = Field(default=DiscountType.PERCENTAGE)
    discount_value: float = Field(..., ge=0, description="Percentage (e.g. 15 for 15%) or Fixed PKR (e.g. 500)")
    min_order_amount: float = Field(default=0.0, ge=0, description="Minimum order subtotal in PKR required")
    max_discount_amount: Optional[float] = Field(default=None, description="Maximum discount cap for percentage vouchers in PKR")
    description: Optional[str] = Field(default=None, description="Human friendly coupon description")
    is_active: bool = Field(default=True)
    expiry_date: Optional[datetime] = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = ConfigDict(
        populate_by_name=True,
        use_enum_values=True,
        json_schema_extra={
            "example": {
                "code": "FLASH25",
                "discount_type": "PERCENTAGE",
                "discount_value": 25.0,
                "min_order_amount": 2000.0,
                "description": "25% OFF Summer Flash Sale Voucher",
                "is_active": True,
            }
        },
    )


class CouponValidateRequest(BaseModel):
    code: str
    subtotal: float = Field(..., ge=0)


class CouponValidateResponse(BaseModel):
    valid: bool
    code: str
    discount_type: Optional[str] = None
    discount_value: Optional[float] = None
    discount_amount: float = 0.0
    final_subtotal: float
    message: str


class CouponCreate(BaseModel):
    code: str
    discount_type: DiscountType = DiscountType.PERCENTAGE
    discount_value: float = Field(..., ge=0)
    min_order_amount: float = Field(default=0.0, ge=0)
    max_discount_amount: Optional[float] = None
    description: Optional[str] = None
    is_active: bool = True
    expiry_date: Optional[datetime] = None
