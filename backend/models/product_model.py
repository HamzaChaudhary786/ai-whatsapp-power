from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class ProductModel(BaseModel):
    """MongoDB Product Document Representation."""
    id: Optional[str] = Field(default=None, alias="_id")
    name: str = Field(..., description="Product name")
    slug: str = Field(..., description="URL-friendly unique product slug", index=True)
    category: str = Field(..., description="Category (e.g. Dresses, Tops, Accessories)")
    description: Optional[str] = Field(default=None, description="Detailed product description")
    image_urls: List[str] = Field(default_factory=list, description="Array of product image URLs")
    is_active: bool = Field(default=True, description="Whether the product is active in the catalog")
    is_on_sale: bool = Field(default=False, description="Whether the product has an active sale discount")
    sale_price: Optional[float] = Field(default=None, description="Discounted sale price")
    discount_percent: Optional[int] = Field(default=None, description="Discount percentage e.g. 20 for 20% off")
    promo_code: Optional[str] = Field(default=None, description="Promotional voucher code e.g. SUMMER20")
    sale_tag: Optional[str] = Field(default=None, description="Promotional sale badge text")
    season: Optional[str] = Field(default="Summer", description="Season collection (e.g. Summer, Spring, All-Season)")
    is_trending: bool = Field(default=False, description="Flag for trending / bestselling showcase")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = ConfigDict(
        populate_by_name=True,
        json_schema_extra={
            "example": {
                "name": "Silk Floral Midi Dress",
                "slug": "silk-floral-midi-dress",
                "category": "Dresses",
                "description": "Elegant silk floral dress suitable for evening parties.",
                "image_urls": [
                    "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1",
                    "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446"
                ],
                "is_active": True,
                "is_on_sale": True,
                "sale_price": 69.99,
                "discount_percent": 22,
                "promo_code": "SUMMER22",
                "sale_tag": "Summer Flash Sale",
                "season": "Summer",
                "is_trending": True,
            }
        },
    )


class ProductCreate(BaseModel):
    name: str
    slug: Optional[str] = None
    category: str
    description: Optional[str] = None
    image_urls: List[str] = Field(default_factory=list)
    is_active: bool = True
    is_on_sale: bool = False
    sale_price: Optional[float] = None
    discount_percent: Optional[int] = None
    promo_code: Optional[str] = None
    sale_tag: Optional[str] = None
    season: Optional[str] = "Summer"
    is_trending: bool = False


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    image_urls: Optional[List[str]] = None
    is_active: Optional[bool] = None
    is_on_sale: Optional[bool] = None
    sale_price: Optional[float] = None
    discount_percent: Optional[int] = None
    promo_code: Optional[str] = None
    sale_tag: Optional[str] = None
    season: Optional[str] = None
    is_trending: Optional[bool] = None


class ProductResponse(BaseModel):
    id: str
    name: str
    slug: str
    category: str
    description: Optional[str] = None
    image_urls: List[str] = Field(default_factory=list)
    is_active: bool
    is_on_sale: bool = False
    sale_price: Optional[float] = None
    discount_percent: Optional[int] = None
    promo_code: Optional[str] = None
    sale_tag: Optional[str] = None
    season: Optional[str] = "Summer"
    is_trending: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
