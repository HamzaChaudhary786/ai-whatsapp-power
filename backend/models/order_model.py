from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class OrderStatus(str, Enum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    PROCESSING = "PROCESSING"
    SHIPPED = "SHIPPED"
    IN_TRANSIT = "IN_TRANSIT"
    OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY"
    DELIVERED = "DELIVERED"
    RETURNED = "RETURNED"
    CANCELLED = "CANCELLED"


class OrderItem(BaseModel):
    """Snapshot of a purchased product variant item."""
    product_id: str
    variant_id: Optional[str] = None
    name: str
    sku: Optional[str] = None
    unit_price: float = Field(..., ge=0)
    quantity: int = Field(default=1, ge=1)
    total_price: float = Field(..., ge=0)
    image_url: Optional[str] = None
    color: Optional[str] = None
    size: Optional[str] = None


class AddressSnapshot(BaseModel):
    """Snapshot of delivery address at order time."""
    full_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    street_address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = "Pakistan"


class StatusHistoryItem(BaseModel):
    """Record of status transition."""
    status: OrderStatus
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    note: Optional[str] = None


class OrderModel(BaseModel):
    """MongoDB Order Document Representation."""
    id: Optional[str] = Field(default=None, alias="_id")
    order_number: str = Field(..., description="Unique Order Number (e.g. #ORD-10024)", index=True)
    customer_id: str = Field(..., description="Reference to Customer _id", index=True)
    status: OrderStatus = Field(default=OrderStatus.PENDING, description="Current order state")
    items: List[OrderItem] = Field(default_factory=list, description="Array of purchased items")
    subtotal: float = Field(..., ge=0, description="Sum of item prices")
    delivery_fee: float = Field(default=0.0, ge=0, description="Delivery or shipping charge")
    coupon_code: Optional[str] = Field(default=None, description="Applied promotional voucher code")
    discount_amount: float = Field(default=0.0, ge=0, description="Deducted voucher discount in PKR")
    total: float = Field(..., ge=0, description="Final payable amount (subtotal - discount_amount + delivery_fee)")
    currency: str = Field(default="PKR", description="Currency code (e.g. PKR, USD, EUR)")
    address_snapshot: AddressSnapshot = Field(default_factory=AddressSnapshot, description="Delivery address snapshot")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    status_history: List[StatusHistoryItem] = Field(default_factory=list, description="Chronological log of status changes")
    cancellation_reason: Optional[str] = Field(default=None, description="Customer or store cancellation explanation")
    return_reason: Optional[str] = Field(default=None, description="Customer explanation for return or exchange")
    return_details: Optional[str] = Field(default=None, description="Further customer return comments")
    return_requested_at: Optional[datetime] = Field(default=None, description="Timestamp of return request")
    return_status: Optional[str] = Field(default=None, description="Return state: REQUESTED, APPROVED, REJECTED")
    courier_partner: Optional[str] = Field(default=None, description="Courier company name e.g. Trax, TCS, Leopards")
    tracking_number: Optional[str] = Field(default=None, description="Consignment tracking number / AWB", index=True)
    tracking_url: Optional[str] = Field(default=None, description="Public web tracking URL")
    courier_status: Optional[str] = Field(default=None, description="Current courier status stage")
    shipped_at: Optional[datetime] = Field(default=None, description="Timestamp when handed over to courier")
    estimated_delivery: Optional[str] = Field(default=None, description="Estimated delivery window")
    parcel_weight_kg: Optional[float] = Field(default=0.5, description="Weight in kg")
    courier_booking_id: Optional[str] = Field(default=None, description="Booking reference from courier gateway")
    courier_notes: Optional[str] = Field(default=None, description="Delivery or rider notes")
    inventory_deducted: bool = Field(default=False, description="Whether stock was decremented for this order")
    inventory_restored: bool = Field(default=False, description="Whether stock was replenished on cancellation or return")
    inventory_restored_at: Optional[datetime] = Field(default=None, description="Timestamp when inventory was restored")
    inventory_restored_reason: Optional[str] = Field(default=None, description="Reason for inventory restoration")

    model_config = ConfigDict(
        populate_by_name=True,
        use_enum_values=True,
        json_schema_extra={
            "example": {
                "order_number": "ORD-2026-9812",
                "customer_id": "60d5ecb8b487343568912345",
                "status": "PENDING",
                "items": [
                    {
                        "product_id": "60d5ecb8b487343568999999",
                        "variant_id": "60d5ecb8b487343568988888",
                        "name": "Silk Floral Midi Dress",
                        "sku": "DRS-FLR-RED-M",
                        "unit_price": 79.99,
                        "quantity": 1,
                        "total_price": 79.99,
                    }
                ],
                "subtotal": 79.99,
                "delivery_fee": 0.00,
                "total": 79.99,
                "currency": "PKR",
                "address_snapshot": {
                    "full_name": "Jane Doe",
                    "phone": "+923001234567",
                    "street_address": "House 12, Street 4, F-7",
                    "city": "Islamabad",
                    "country": "Pakistan",
                },
                "status_history": [
                    {
                        "status": "PENDING",
                        "note": "Order placed via WhatsApp Assistant",
                    }
                ],
            }
        },
    )


class OrderCreate(BaseModel):
    order_number: Optional[str] = None
    customer_id: Optional[str] = "guest"
    items: List[OrderItem]
    subtotal: float = Field(..., ge=0)
    delivery_fee: float = 0.0
    coupon_code: Optional[str] = None
    discount_amount: float = 0.0
    total: float = Field(..., ge=0)
    currency: str = "PKR"
    address_snapshot: AddressSnapshot
    status: OrderStatus = OrderStatus.PENDING
    status_history: List[StatusHistoryItem] = Field(default_factory=list)


class OrderCancelRequest(BaseModel):
    phone: str
    reason: str


class OrderReturnRequest(BaseModel):
    phone: str
    reason: str
    details: Optional[str] = None


class OrderReturnReview(BaseModel):
    approve: bool
    note: Optional[str] = None


class OrderUpdateStatus(BaseModel):
    status: OrderStatus
    note: Optional[str] = None


class OrderResponse(BaseModel):
    id: str
    order_number: str
    customer_id: str
    status: OrderStatus
    items: List[OrderItem]
    subtotal: float
    delivery_fee: float
    coupon_code: Optional[str] = None
    discount_amount: float = 0.0
    total: float
    currency: str
    address_snapshot: AddressSnapshot
    created_at: datetime
    status_history: List[StatusHistoryItem]
    cancellation_reason: Optional[str] = None
    return_reason: Optional[str] = None
    return_details: Optional[str] = None
    return_requested_at: Optional[datetime] = None
    return_status: Optional[str] = None
    courier_partner: Optional[str] = None
    tracking_number: Optional[str] = None
    tracking_url: Optional[str] = None
    courier_status: Optional[str] = None
    shipped_at: Optional[datetime] = None
    estimated_delivery: Optional[str] = None
    parcel_weight_kg: Optional[float] = 0.5
    courier_booking_id: Optional[str] = None
    courier_notes: Optional[str] = None
    inventory_deducted: Optional[bool] = False
    inventory_restored: Optional[bool] = False
    inventory_restored_at: Optional[datetime] = None
    inventory_restored_reason: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
