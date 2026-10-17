from datetime import datetime, timezone
from typing import Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class ReviewModel(BaseModel):
    """MongoDB Customer Product Review Document."""
    id: Optional[str] = Field(default=None, alias="_id")
    product_id: str = Field(..., description="Target Product _id reference", index=True)
    customer_name: str = Field(..., description="Customer Display Name")
    rating: int = Field(..., ge=1, le=5, description="Star rating between 1 and 5")
    comment: str = Field(..., min_length=3, description="Customer review text")
    city: Optional[str] = Field(default="Lahore", description="Customer city in Pakistan")
    verified_purchase: bool = Field(default=True)
    is_approved: bool = Field(default=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = ConfigDict(
        populate_by_name=True,
        json_schema_extra={
            "example": {
                "product_id": "60d5ecb8b487343568912345",
                "customer_name": "Ayesha Khan",
                "rating": 5,
                "comment": "Fabric quality is pure luxury! The embroidery and stitching are perfection. Fitting was 10/10.",
                "city": "Karachi",
                "verified_purchase": True,
            }
        },
    )


class ReviewCreate(BaseModel):
    customer_name: str = Field(..., min_length=2)
    rating: int = Field(..., ge=1, le=5)
    comment: str = Field(..., min_length=5)
    city: Optional[str] = "Lahore"
    verified_purchase: Optional[bool] = True


class ProductReviewsSummary(BaseModel):
    product_id: str
    average_rating: float
    total_reviews: int
    rating_breakdown: Dict[int, int]
    reviews: List[dict]
