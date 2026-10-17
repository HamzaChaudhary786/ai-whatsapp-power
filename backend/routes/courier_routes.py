from typing import Any, Dict, List
from fastapi import APIRouter, Depends, Path, Request
from controllers.courier_controller import courier_controller
from utils.dependencies import require_staff
from models.courier_model import CourierBookingRequest, CourierShipmentResponse, TrackingDetailsResponse

router = APIRouter(prefix="/courier", tags=["Courier & Logistics"])


@router.get("/partners", response_model=List[Dict[str, Any]])
def get_courier_partners():
    """Returns list of supported courier logistics carriers (Trax, TCS, Leopards, PostEx, etc.) with SLAs."""
    return courier_controller.get_supported_partners()


@router.post("/book", response_model=CourierShipmentResponse)
async def book_shipment(
    request: CourierBookingRequest,
    current_user: dict = Depends(require_staff),
):
    """
    Staff/Admin only: Books courier shipment for an order.
    Generates Airway Bill (AWB) Consignment Tracking Number, sets order to SHIPPED,
    and dispatches automated WhatsApp & Email tracking notifications to the customer.
    """
    actor_id = current_user.get("user_id") or current_user.get("id")
    return await courier_controller.book_shipment(request, actor_user_id=actor_id)


@router.get("/track/{identifier}", response_model=TrackingDetailsResponse)
async def track_shipment(
    identifier: str = Path(..., description="Consignment Tracking Number (e.g. TRX-...) or Order Number (ORD-...)"),
):
    """
    Public Endpoint: Track order/consignment status in real-time with visual checkpoints.
    Used by storefront customer tracking widget, WhatsApp AI, and tracking links.
    """
    return await courier_controller.track_shipment(identifier)


@router.get("/slip/{order_id}")
async def get_shipping_slip(
    order_id: str = Path(..., description="Order ID or Order Number"),
    current_user: dict = Depends(require_staff),
):
    """Staff/Admin only: Generates printable AWB Shipping Slip data for parcel label printing."""
    return await courier_controller.get_shipping_slip(order_id)


@router.post("/webhook")
async def courier_webhook(request: Request):
    """Inbound webhook listener for third-party courier partner status updates."""
    payload = await request.json()
    return await courier_controller.handle_courier_webhook(payload)
