from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Request
from controllers.order_controller import order_controller
from models.order_model import (
    OrderCancelRequest,
    OrderCreate,
    OrderResponse,
    OrderReturnRequest,
    OrderReturnReview,
    OrderStatus,
    OrderUpdateStatus,
)
from utils.dependencies import require_staff
from utils.rate_limiter import rate_limiter

router = APIRouter(prefix="/orders", tags=["Orders"])


@router.post("/", response_model=OrderResponse)
async def create_order(data: OrderCreate, request: Request):
    """Create a new customer order with snapshot details."""
    rate_limiter.check(request, action_name="create_order", max_requests=25, window_seconds=3600)
    return await order_controller.create_order(data)


@router.get("/", response_model=List[OrderResponse])
async def list_orders(
    customer_id: Optional[str] = Query(None, description="Filter by customer ID"),
    status: Optional[OrderStatus] = Query(None, description="Filter by status"),
    limit: int = Query(50, ge=1, le=100),
    skip: int = Query(0, ge=0),
    _staff: dict = Depends(require_staff),
):
    """List orders with filtering and pagination (Staff/Admin access only)."""
    return await order_controller.list_orders(customer_id=customer_id, order_status=status, limit=limit, skip=skip)


@router.get("/by-phone/{phone}", response_model=List[OrderResponse])
async def get_customer_orders_by_phone(phone: str, request: Request):
    """Public customer order history lookup by phone number."""
    rate_limiter.check(request, action_name="customer_orders", max_requests=60, window_seconds=60)
    return await order_controller.get_customer_orders_by_phone(phone=phone)


@router.post("/{identifier}/cancel", response_model=OrderResponse)
async def cancel_customer_order(identifier: str, data: OrderCancelRequest, request: Request):
    """Customer self-service cancellation for PENDING orders with phone verification."""
    rate_limiter.check(request, action_name="cancel_order", max_requests=20, window_seconds=3600)
    return await order_controller.cancel_customer_order(
        order_id_or_number=identifier,
        phone=data.phone,
        reason=data.reason,
    )


@router.post("/{identifier}/return-request", response_model=OrderResponse)
async def request_order_return(identifier: str, data: OrderReturnRequest, request: Request):
    """Customer 7-day return / exchange request submission for DELIVERED orders."""
    rate_limiter.check(request, action_name="return_order", max_requests=20, window_seconds=3600)
    return await order_controller.request_order_return(
        order_id_or_number=identifier,
        phone=data.phone,
        reason=data.reason,
        details=data.details,
    )


@router.post("/{order_id}/review-return", response_model=OrderResponse)
async def review_order_return(order_id: str, data: OrderReturnReview, _staff: dict = Depends(require_staff)):
    """Staff review & approval/rejection of customer return request (Staff/Admin access only)."""
    return await order_controller.review_order_return(
        order_id=order_id,
        approve=data.approve,
        note=data.note,
        actor_user_id=_staff.get("id"),
    )


@router.get("/{identifier}", response_model=OrderResponse)
async def get_order(identifier: str):
    """Get single order by order_number or ObjectId (Public for customer tracking)."""
    return await order_controller.get_order(identifier)


@router.patch("/{order_id}/status", response_model=OrderResponse)
async def update_order_status(order_id: str, data: OrderUpdateStatus, _staff: dict = Depends(require_staff)):
    """Update order status and append to timeline history (Staff/Admin access only)."""
    return await order_controller.update_status(order_id, data, actor_user_id=_staff.get("id"))


@router.post("/{identifier}/resend-confirmation")
async def resend_order_confirmation(identifier: str):
    """Re-dispatch order confirmation via WhatsApp and Email for an existing order."""
    return await order_controller.resend_order_confirmation(identifier)

