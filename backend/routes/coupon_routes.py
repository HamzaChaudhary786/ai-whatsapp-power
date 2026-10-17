from typing import List
from fastapi import APIRouter, Depends, HTTPException, Request, status
from controllers.coupon_controller import coupon_controller
from models.coupon_model import CouponCreate, CouponValidateRequest, CouponValidateResponse
from utils.dependencies import require_staff
from utils.rate_limiter import rate_limiter

router = APIRouter(prefix="/coupons", tags=["Coupons & Vouchers"])


@router.post("/validate", response_model=CouponValidateResponse)
async def validate_coupon(data: CouponValidateRequest, request: Request):
    """Validate a promo voucher code against current cart subtotal (Public)."""
    rate_limiter.check(request, action_name="validate_coupon", max_requests=100, window_seconds=60)
    return await coupon_controller.validate_coupon(data)


@router.get("/")
async def list_coupons():
    """List all available boutique discount vouchers (Public)."""
    return await coupon_controller.list_coupons()


@router.post("/")
async def create_coupon(data: CouponCreate, _staff: dict = Depends(require_staff)):
    """Create a new promotional discount voucher (Staff/Admin access only)."""
    return await coupon_controller.create_coupon(data)


@router.delete("/{coupon_id}")
async def delete_coupon(coupon_id: str, _staff: dict = Depends(require_staff)):
    """Delete a promotional voucher (Staff/Admin access only)."""
    success = await coupon_controller.delete_coupon(coupon_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coupon not found")
    return {"status": "success", "message": "Coupon deleted"}
