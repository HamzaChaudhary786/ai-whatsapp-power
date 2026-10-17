import random
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from models.courier_model import CourierPartner, CourierStatus, TrackingCheckpoint


class CourierService:
    """Universal Courier Logistics Integration Gateway.
    
    Provides unified integration with Pakistan & International logistics carriers:
    - Trax Logistics
    - TCS Express
    - Leopards Courier
    - PostEx
    - BlueEx
    - Call Courier
    - DHL Express
    - FedEx
    """

    PARTNERS = [
        {
            "id": "trax",
            "name": CourierPartner.TRAX.value,
            "prefix": "TRX",
            "sla": "2-3 Working Days",
            "cod_available": True,
            "tracking_url_template": "https://track.trax.pk/tracking?cn={cn}",
            "coverage": "All 450+ Cities in Pakistan",
            "rating": 4.8,
            "badge": "Recommended for COD",
        },
        {
            "id": "tcs",
            "name": CourierPartner.TCS.value,
            "prefix": "TCS",
            "sla": "1-2 Working Days (Express)",
            "cod_available": True,
            "tracking_url_template": "https://www.tcsexpress.com/track/{cn}",
            "coverage": "Nationwide & Overseas",
            "rating": 4.9,
            "badge": "Fastest Priority",
        },
        {
            "id": "leopards",
            "name": CourierPartner.LEOPARDS.value,
            "prefix": "LP",
            "sla": "2-3 Working Days",
            "cod_available": True,
            "tracking_url_template": "https://leopardscourier.com/track/{cn}",
            "coverage": "Nationwide Network",
            "rating": 4.7,
            "badge": "Reliable Network",
        },
        {
            "id": "postex",
            "name": CourierPartner.POSTEX.value,
            "prefix": "PEX",
            "sla": "2-3 Working Days",
            "cod_available": True,
            "tracking_url_template": "https://postex.pk/tracking/{cn}",
            "coverage": "E-Commerce Specialized",
            "rating": 4.8,
            "badge": "Instant Cash Settlements",
        },
        {
            "id": "blueex",
            "name": CourierPartner.BLUEEX.value,
            "prefix": "BLX",
            "sla": "2-4 Working Days",
            "cod_available": True,
            "tracking_url_template": "https://blue-ex.com/tracking?cn={cn}",
            "coverage": "Major Metros",
            "rating": 4.6,
            "badge": "Economical",
        },
        {
            "id": "dhl",
            "name": CourierPartner.DHL.value,
            "prefix": "DHL",
            "sla": "3-5 International Days",
            "cod_available": False,
            "tracking_url_template": "https://www.dhl.com/track?tracking-id={cn}",
            "coverage": "Global 220+ Countries",
            "rating": 5.0,
            "badge": "Global Luxury Export",
        },
    ]

    @classmethod
    def get_supported_partners(cls) -> List[Dict[str, Any]]:
        return cls.PARTNERS

    @classmethod
    def generate_tracking_number(cls, courier_partner: str) -> str:
        partner_lower = courier_partner.lower()
        prefix = "TRX"
        for p in cls.PARTNERS:
            if p["name"].lower() == partner_lower or p["id"] in partner_lower:
                prefix = p["prefix"]
                break

        now = datetime.now(timezone.utc)
        date_str = now.strftime("%Y%m%d")
        rand_suffix = random.randint(1000, 9999)
        return f"{prefix}-{date_str}-{rand_suffix}"

    @classmethod
    def generate_tracking_url(cls, courier_partner: str, tracking_number: str) -> str:
        partner_lower = courier_partner.lower()
        for p in cls.PARTNERS:
            if p["name"].lower() == partner_lower or p["id"] in partner_lower:
                return p["tracking_url_template"].format(cn=tracking_number)
        return f"https://track.trax.pk/tracking?cn={tracking_number}"

    @classmethod
    def calculate_estimated_delivery(cls, destination_city: Optional[str]) -> str:
        city_lower = (destination_city or "").lower().strip()
        now = datetime.now(timezone.utc)
        
        # Local delivery in Lahore: Next day delivery
        if "lahore" in city_lower:
            start_date = now + timedelta(days=1)
            end_date = now + timedelta(days=2)
            return f"{start_date.strftime('%b %d')} - {end_date.strftime('%b %d')} (1-2 Days Express)"
        # Major metropolitan cities
        elif any(c in city_lower for c in ["karachi", "islamabad", "rawalpindi", "faisalabad", "multan", "peshawar", "sialkot", "gujranwala"]):
            start_date = now + timedelta(days=2)
            end_date = now + timedelta(days=3)
            return f"{start_date.strftime('%b %d')} - {end_date.strftime('%b %d')} (2-3 Working Days)"
        # Rest of Pakistan
        else:
            start_date = now + timedelta(days=3)
            end_date = now + timedelta(days=4)
            return f"{start_date.strftime('%b %d')} - {end_date.strftime('%b %d')} (3-4 Working Days)"

    @classmethod
    def generate_tracking_checkpoints(cls, order_doc: Dict[str, Any]) -> List[TrackingCheckpoint]:
        """Builds chronological live tracking checkpoints based on the order's status history and destination."""
        status = str(order_doc.get("status", "PENDING")).upper()
        shipped_at = order_doc.get("shipped_at") or order_doc.get("created_at") or datetime.now(timezone.utc)
        if isinstance(shipped_at, str):
            try:
                shipped_at = datetime.fromisoformat(shipped_at)
            except Exception:
                shipped_at = datetime.now(timezone.utc)

        dest_addr = order_doc.get("address_snapshot", {}) or {}
        dest_city = dest_addr.get("city", "Customer City")
        courier_name = order_doc.get("courier_partner") or "Trax Logistics"
        tracking_num = order_doc.get("tracking_number") or "N/A"

        # Stages definitions
        stages = [
            {
                "stage": "BOOKED",
                "title": "Consignment Booked & Airway Bill Generated",
                "description": f"Shipment booked with {courier_name}. AWB Consignment #{tracking_num} registered in logistics system.",
                "location": "Luxe Atelier Central Fulfillment, Lahore",
                "delta_hours": 0,
            },
            {
                "stage": "PICKED_UP",
                "title": "Picked Up by Courier Rider",
                "description": f"Package safely handed over to {courier_name} dispatch team after luxury boutique inspection.",
                "location": "Gulberg Hub, Lahore",
                "delta_hours": 3,
            },
            {
                "stage": "IN_TRANSIT",
                "title": f"In Transit to {dest_city} Logistics Hub",
                "description": f"Consignment scanned and departed central processing warehouse towards {dest_city} sorting facility.",
                "location": "National Sorting Gateway Hub",
                "delta_hours": 12,
            },
            {
                "stage": "OUT_FOR_DELIVERY",
                "title": f"Out for Delivery in {dest_city}",
                "description": f"Consignment assigned to courier delivery rider. Rider will contact customer before door-step arrival.",
                "location": f"{dest_city} Delivery Station",
                "delta_hours": 28,
            },
            {
                "stage": "DELIVERED",
                "title": "Package Delivered & Payment Received",
                "description": f"Consignment successfully delivered to customer. Cash on Delivery (COD) payment received.",
                "location": f"Customer Address, {dest_city}",
                "delta_hours": 34,
            },
        ]

        # Determine completion state based on order status
        current_stage_idx = 0
        if status in ["PENDING", "CONFIRMED", "PROCESSING"]:
            current_stage_idx = 0
        elif status == "SHIPPED":
            current_stage_idx = 1
        elif status == "IN_TRANSIT":
            current_stage_idx = 2
        elif status == "OUT_FOR_DELIVERY":
            current_stage_idx = 3
        elif status == "DELIVERED":
            current_stage_idx = 4
        elif status == "RETURNED":
            current_stage_idx = 3
        else:
            current_stage_idx = 0

        checkpoints = []
        for idx, s in enumerate(stages):
            cp_time = shipped_at + timedelta(hours=s["delta_hours"])
            is_completed = idx <= current_stage_idx
            is_current = idx == current_stage_idx

            checkpoints.append(
                TrackingCheckpoint(
                    stage=s["stage"],
                    title=s["title"],
                    description=s["description"],
                    location=s["location"],
                    timestamp=cp_time,
                    is_completed=is_completed,
                    is_current=is_current,
                )
            )

        if status == "RETURNED":
            checkpoints.append(
                TrackingCheckpoint(
                    stage="RETURNED",
                    title="Package Returned to Origin (RTO)",
                    description="Delivery was unsuccessful after multiple attempts. Consignment returned to Luxe Atelier warehouse.",
                    location="Luxe Atelier Fulfillment Center, Lahore",
                    timestamp=shipped_at + timedelta(hours=48),
                    is_completed=True,
                    is_current=True,
                )
            )

        return checkpoints

    @classmethod
    def generate_shipping_slip(cls, order_doc: Dict[str, Any]) -> Dict[str, Any]:
        """Generates standard printable Airway Bill (AWB) Consignment Slip data."""
        addr = order_doc.get("address_snapshot", {}) or {}
        items = order_doc.get("items", []) or []
        order_number = order_doc.get("order_number", "ORD-UNKNOWN")
        tracking_number = order_doc.get("tracking_number") or cls.generate_tracking_number("Trax Logistics")
        courier_partner = order_doc.get("courier_partner") or "Trax Logistics"

        return {
            "awb_number": tracking_number,
            "order_number": order_number,
            "courier_partner": courier_partner,
            "booking_date": (order_doc.get("shipped_at") or order_doc.get("created_at") or datetime.now(timezone.utc)).strftime("%d-%b-%Y %I:%M %p"),
            "service_type": "Cash on Delivery (COD) Express",
            "shipper": {
                "company": "Luxe Atelier Haute Couture",
                "branch": "Gulberg Central Atelier",
                "address": "Plaza 42, MM Alam Road, Gulberg III",
                "city": "Lahore, Pakistan",
                "phone": "+92 300 1234567",
                "email": "concierge@luxeatelier.pk",
            },
            "consignee": {
                "name": addr.get("full_name") or "Valued Customer",
                "phone": addr.get("phone") or "N/A",
                "email": addr.get("email") or "N/A",
                "address": addr.get("street_address") or "Customer Address",
                "city": addr.get("city") or "Pakistan",
                "country": addr.get("country") or "Pakistan",
            },
            "shipment_details": {
                "pieces": sum(it.get("quantity", 1) for it in items) or 1,
                "weight_kg": order_doc.get("parcel_weight_kg", 0.5),
                "cod_payable": float(order_doc.get("total", 0.0)),
                "currency": order_doc.get("currency", "PKR"),
                "instructions": order_doc.get("courier_notes") or "Fragile Designer Apparel. Do not bend or expose to moisture.",
            },
            "items_summary": [
                {
                    "name": it.get("name", "Designer Dress"),
                    "sku": it.get("sku", "LUXE-SKU"),
                    "quantity": it.get("quantity", 1),
                    "price": it.get("unit_price") or it.get("price") or 0.0,
                }
                for it in items
            ],
            "barcode_value": f"*{tracking_number}*",
        }


courier_service = CourierService()
