from fastapi import APIRouter, Request
from controllers.review_controller import review_controller
from models.review_model import ReviewCreate
from utils.rate_limiter import rate_limiter

router = APIRouter(prefix="/reviews", tags=["Product Reviews & Ratings"])


@router.get("/product/{product_id}")
async def get_product_reviews(product_id: str):
    """Get all approved reviews and rating breakdown for a product (Public)."""
    return await review_controller.get_product_reviews(product_id)


@router.post("/product/{product_id}")
async def submit_product_review(product_id: str, data: ReviewCreate, request: Request):
    """Submit a verified customer review and star rating for a product (Public)."""
    rate_limiter.check(request, action_name="submit_review", max_requests=10, window_seconds=3600)
    return await review_controller.add_review(product_id, data)
