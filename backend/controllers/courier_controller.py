import asyncio
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from bson import ObjectId
from fastapi import HTTPException, status
from db.mongodb import get_database
from integrations.courier_service import courier_service
from models.courier_model import (
    CourierBookingRequest,
    CourierShipmentResponse,
    TrackingDetailsResponse,
)
from models.order_model import OrderStatus


class CourierController:
    """Business logic for Courier Consignment Booking, Tracking, and Shipping Slip Generation."""

    @staticmethod
    async def book_shipment(data: CourierBookingRequest, actor_user_id: Optional[str] = None) -> Dict[str, Any]:
        db = get_database()
        order_query = {"order_number": data.order_id}
        if ObjectId.is_valid(data.order_id):
            order_query = {"$or": [{"_id": ObjectId(data.order_id)}, {"order_number": data.order_id}]}

        order = await db["orders"].find_one(order_query)
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Order '{data.order_id}' not found.",
            )

        if str(order.get("status", "")).upper() == "CANCELLED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Order #{order.get('order_number')} is cancelled and cannot be booked for shipping.",
            )

        now = datetime.now(timezone.utc)
        tracking_number = courier_service.generate_tracking_number(data.courier_partner)
        tracking_url = courier_service.generate_tracking_url(data.courier_partner, tracking_number)

        dest_city = (order.get("address_snapshot") or {}).get("city")
        estimated_delivery = courier_service.calculate_estimated_delivery(dest_city)
        booking_id = f"BK-{uuid.uuid4().hex[:8].upper()}"

        status_note = (
            f"Consignment booked with {data.courier_partner}. "
            f"Tracking #{tracking_number}. Est Delivery: {estimated_delivery}"
        )

        history_entry = {
            "status": OrderStatus.SHIPPED.value,
            "timestamp": now,
            "note": status_note,
        }

        update_payload = {
            "status": OrderStatus.SHIPPED.value,
            "courier_partner": data.courier_partner,
            "tracking_number": tracking_number,
            "tracking_url": tracking_url,
            "courier_status": "BOOKED",
            "shipped_at": now,
            "estimated_delivery": estimated_delivery,
            "parcel_weight_kg": data.parcel_weight_kg,
            "courier_booking_id": booking_id,
            "courier_notes": data.instructions,
            "updated_at": now,
        }

        await db["orders"].update_one(
            {"_id": order["_id"]},
            {
                "$set": update_payload,
                "$push": {"status_history": history_entry},
            },
        )

        # Audit Log
        await db["audit_logs"].insert_one({
            "actor_user_id": actor_user_id,
            "action": "COURIER_SHIPMENT_BOOKED",
            "entity_type": "orders",
            "entity_id": str(order["_id"]),
            "created_at": now,
            "metadata": {
                "order_number": order.get("order_number"),
                "courier_partner": data.courier_partner,
                "tracking_number": tracking_number,
                "booking_id": booking_id,
            },
        })

        # Enrich order doc for notification
        enriched_order = {**order, **update_payload}

        # Dispatch automated WhatsApp & Email notifications with tracking details
        try:
            from controllers.order_controller import OrderController
            asyncio.create_task(
                OrderController.dispatch_status_notifications(
                    order=enriched_order,
                    new_status="SHIPPED",
                    note=f"Dispatched via {data.courier_partner}. Tracking No: {tracking_number} (Track: {tracking_url})",
                )
            )
        except Exception as e:
            print(f"[WARNING] Could not queue status notification: {e}")

        addr = order.get("address_snapshot") or {}
        return {
            "booking_id": booking_id,
            "order_id": str(order["_id"]),
            "order_number": order.get("order_number"),
            "courier_partner": data.courier_partner,
            "tracking_number": tracking_number,
            "tracking_url": tracking_url,
            "status": "BOOKED",
            "estimated_delivery": estimated_delivery,
            "parcel_weight_kg": data.parcel_weight_kg,
            "cod_amount": float(order.get("total", 0.0)),
            "currency": order.get("currency", "PKR"),
            "recipient_name": addr.get("full_name") or "Valued Customer",
            "recipient_phone": addr.get("phone") or "N/A",
            "recipient_address": f"{addr.get('street_address', '')}, {addr.get('city', '')}".strip(", "),
            "created_at": now,
        }

    @staticmethod
    async def track_shipment(identifier: str) -> Dict[str, Any]:
        """Looks up an order by Tracking Number, Order Number, or MongoDB _id, and returns live checkpoints."""
        db = get_database()
        clean_id = identifier.strip().replace("#", "")

        query: Dict[str, Any] = {
            "$or": [
                {"tracking_number": {"$regex": f"^{clean_id}$", "$options": "i"}},
                {"order_number": {"$regex": f"^{clean_id}$", "$options": "i"}},
                {"tracking_number": clean_id},
                {"order_number": clean_id},
            ]
        }

        if ObjectId.is_valid(clean_id):
            query["$or"].append({"_id": ObjectId(clean_id)})

        order = await db["orders"].find_one(query)
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No active shipment found with tracking / order identifier '{identifier}'.",
            )

        checkpoints = courier_service.generate_tracking_checkpoints(order)
        dest_city = (order.get("address_snapshot") or {}).get("city")
        est_del = order.get("estimated_delivery") or courier_service.calculate_estimated_delivery(dest_city)
        status_val = str(order.get("status", "PENDING")).upper()

        status_labels = {
            "PENDING": "Order Received - Awaiting Atelier Packaging",
            "CONFIRMED": "Confirmed - Scheduled for Courier Dispatch",
            "PROCESSING": "Packaging & Quality Inspection in Progress",
            "SHIPPED": "Dispatched with Courier Express",
            "IN_TRANSIT": "In Transit to Destination Delivery Hub",
            "OUT_FOR_DELIVERY": "Out for Delivery with Courier Rider",
            "DELIVERED": "Delivered to Customer",
            "RETURNED": "Returned to Atelier (RTO)",
            "CANCELLED": "Order Cancelled",
        }

        tracking_num = order.get("tracking_number") or "NOT_ASSIGNED_YET"
        courier_name = order.get("courier_partner") or "Express Logistics"
        tracking_url = order.get("tracking_url") or courier_service.generate_tracking_url(courier_name, tracking_num)

        addr = order.get("address_snapshot") or {}
        items = order.get("items") or []

        return {
            "order_number": order.get("order_number"),
            "tracking_number": tracking_num,
            "courier_partner": courier_name,
            "current_status": status_val,
            "status_label": status_labels.get(status_val, status_val),
            "estimated_delivery": est_del,
            "tracking_url": tracking_url,
            "cod_amount": float(order.get("total", 0.0)),
            "currency": order.get("currency", "PKR"),
            "recipient": {
                "name": addr.get("full_name") or "Valued Customer",
                "phone": addr.get("phone") or "N/A",
                "city": addr.get("city") or "Pakistan",
                "address": addr.get("street_address") or "Customer Address",
            },
            "items": [
                {
                    "name": it.get("name"),
                    "quantity": it.get("quantity", 1),
                    "price": it.get("unit_price") or it.get("price") or 0.0,
                    "image_url": it.get("image_url"),
                }
                for it in items
            ],
            "checkpoints": [c.model_dump() for c in checkpoints],
            "is_delivered": status_val == "DELIVERED",
            "is_shipped": status_val in ["SHIPPED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED"],
        }

    @staticmethod
    def get_supported_partners() -> List[Dict[str, Any]]:
        return courier_service.get_supported_partners()

    @staticmethod
    async def get_shipping_slip(order_id: str) -> Dict[str, Any]:
        db = get_database()
        q = {"order_number": order_id}
        if ObjectId.is_valid(order_id):
            q = {"$or": [{"_id": ObjectId(order_id)}, {"order_number": order_id}]}

        order = await db["orders"].find_one(q)
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Order '{order_id}' not found.",
            )

        return courier_service.generate_shipping_slip(order)

    @staticmethod
    async def handle_courier_webhook(payload: Dict[str, Any]) -> Dict[str, Any]:
        """Webhook listener for status updates pushed by courier systems (Trax/TCS/etc.)."""
        db = get_database()
        cn = payload.get("tracking_number") or payload.get("consignment_number") or payload.get("awb")
        new_status = payload.get("status")

        if not cn or not new_status:
            return {"status": "ignored", "reason": "missing tracking_number or status"}

        order = await db["orders"].find_one({"tracking_number": cn})
        if not order:
            return {"status": "not_found"}

        now = datetime.now(timezone.utc)
        mapped_order_status = None
        st_upper = str(new_status).upper()

        if "DELIVER" in st_upper:
            mapped_order_status = OrderStatus.DELIVERED.value
        elif "OUT" in st_upper:
            mapped_order_status = OrderStatus.OUT_FOR_DELIVERY.value
        elif "TRANSIT" in st_upper or "DISPATCH" in st_upper:
            mapped_order_status = OrderStatus.IN_TRANSIT.value
        elif "RETURN" in st_upper or "RTO" in st_upper:
            mapped_order_status = OrderStatus.RETURNED.value

        update_fields: Dict[str, Any] = {
            "courier_status": st_upper,
            "updated_at": now,
        }
        if mapped_order_status:
            update_fields["status"] = mapped_order_status

        await db["orders"].update_one(
            {"_id": order["_id"]},
            {
                "$set": update_fields,
                "$push": {
                    "status_history": {
                        "status": mapped_order_status or order.get("status"),
                        "timestamp": now,
                        "note": f"Courier Webhook Update: {st_upper}",
                    }
                },
            },
        )

        return {"status": "updated", "order_number": order.get("order_number")}


courier_controller = CourierController()
