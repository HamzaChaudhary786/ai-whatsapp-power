from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field


class CourierPartner(str, Enum):
    TRAX = "Trax Logistics"
    TCS = "TCS Express"
    LEOPARDS = "Leopards Courier"
    POSTEX = "PostEx"
    BLUEEX = "BlueEx"
    CALL_COURIER = "Call Courier"
    DHL = "DHL Express"
    FEDEX = "FedEx International"


class CourierStatus(str, Enum):
    BOOKED = "BOOKED"
    PICKED_UP = "PICKED_UP"
    IN_TRANSIT = "IN_TRANSIT"
    OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY"
    DELIVERED = "DELIVERED"
    RETURNED = "RETURNED"
    FAILED = "FAILED"


class TrackingCheckpoint(BaseModel):
    stage: str
    title: str
    description: str
    location: str
    timestamp: datetime
    is_completed: bool = True
    is_current: bool = False


class CourierBookingRequest(BaseModel):
    order_id: str = Field(..., description="Target Order _id or order_number to book shipment for")
    courier_partner: str = Field(default="Trax Logistics", description="Courier company name")
    parcel_weight_kg: float = Field(default=0.5, ge=0.1, le=50.0, description="Gross parcel weight in kg")
    instructions: Optional[str] = Field(
        default="Handle with care. Luxury designer apparel.",
        description="Delivery / rider handling instructions",
    )
    origin_warehouse: Optional[str] = Field(
        default="Luxe Atelier Central Warehouse, Lahore",
        description="Pickup dispatch hub location",
    )


class CourierShipmentResponse(BaseModel):
    booking_id: str
    order_id: str
    order_number: str
    courier_partner: str
    tracking_number: str
    tracking_url: str
    status: str
    estimated_delivery: str
    parcel_weight_kg: float
    cod_amount: float
    currency: str
    recipient_name: str
    recipient_phone: str
    recipient_address: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TrackingDetailsResponse(BaseModel):
    order_number: str
    tracking_number: str
    courier_partner: str
    current_status: str
    status_label: str
    estimated_delivery: str
    tracking_url: str
    cod_amount: float
    currency: str
    recipient: Dict[str, Any]
    items: List[Dict[str, Any]]
    checkpoints: List[TrackingCheckpoint]
    is_delivered: bool
    is_shipped: bool
