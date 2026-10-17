from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class CategoryModel(BaseModel):
    """MongoDB Category Document Representation."""
    id: Optional[str] = Field(default=None, alias="_id")
    name: str = Field(..., description="Category name (e.g. Dresses, Outerwear, Tops)")
    slug: str = Field(..., description="Unique URL-friendly slug", index=True)
    description: Optional[str] = Field(default=None, description="Category description for customer storefront & AI assistant")
    image_url: Optional[str] = Field(default=None, description="Cover image URL for category card")
    icon: Optional[str] = Field(default="Sparkles", description="Lucide icon name")
    display_order: int = Field(default=0, description="Order for display sorting")
    is_active: bool = Field(default=True, description="Whether active")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = ConfigDict(
        populate_by_name=True,
        json_schema_extra={
            "example": {
                "name": "Luxury Evening Dresses",
                "slug": "luxury-evening-dresses",
                "description": "Handcrafted silk and satin evening wear for formal galas.",
                "image_url": "https://images.unsplash.com/photo-1566174053879-31528523f8ae",
                "icon": "Sparkles",
                "display_order": 1,
                "is_active": True,
            }
        },
    )


class CategoryCreate(BaseModel):
    name: str
    slug: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    icon: Optional[str] = "Sparkles"
    display_order: int = 0
    is_active: bool = True


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    icon: Optional[str] = None
    display_order: Optional[int] = None
    is_active: Optional[bool] = None


class CategoryResponse(BaseModel):
    id: str
    name: str
    slug: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    icon: Optional[str] = "Sparkles"
    display_order: int = 0
    is_active: bool
    product_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
