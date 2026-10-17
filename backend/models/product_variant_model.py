from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class ProductVariantModel(BaseModel):
    """MongoDB Product Variant Document Representation."""
    id: Optional[str] = Field(default=None, alias="_id")
    product_id: str = Field(..., description="Reference to parent Product _id", index=True)
    sku: str = Field(..., description="Stock Keeping Unit (Unique)", index=True)
    size: Optional[str] = Field(default=None, description="Variant size (e.g. XS, S, M, L, XL)")
    color: Optional[str] = Field(default=None, description="Variant color (e.g. Red, Emerald Green)")
    price: float = Field(..., ge=0, description="Variant unit price")
    currency: str = Field(default="PKR", description="Currency code (e.g. PKR, USD, EUR)")
    available_quantity: int = Field(default=0, ge=0, description="Available inventory count")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = ConfigDict(
        populate_by_name=True,
        json_schema_extra={
            "example": {
                "product_id": "60d5ecb8b487343568912345",
                "sku": "DRS-FLR-RED-M",
                "size": "M",
                "color": "Red",
                "price": 79.99,
                "currency": "PKR",
                "available_quantity": 25,
            }
        },
    )


class ProductVariantCreate(BaseModel):
    product_id: str
    sku: str
    size: Optional[str] = None
    color: Optional[str] = None
    price: float = Field(..., ge=0)
    currency: str = "PKR"
    available_quantity: int = Field(default=0, ge=0)


class ProductVariantUpdate(BaseModel):
    sku: Optional[str] = None
    size: Optional[str] = None
    color: Optional[str] = None
    price: Optional[float] = Field(default=None, ge=0)
    currency: Optional[str] = None
    available_quantity: Optional[int] = Field(default=None, ge=0)


class ProductVariantResponse(BaseModel):
    id: str
    product_id: str
    sku: str
    size: Optional[str] = None
    color: Optional[str] = None
    price: float
    currency: str
    available_quantity: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
