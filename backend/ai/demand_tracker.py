"""
Real-Time Product Demand & Customer Taste Tracker.
Monitors customer inquiries across WhatsApp and Web AI Stylist,
logging product demand velocity and updating customer personalization vectors.
"""

from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from bson import ObjectId


class DemandTracker:
    """Tracks product demand velocity and updates customer preference vectors."""

    @staticmethod
    async def record_inquiry(
        db: Any,
        matched_product_ids: List[str],
        categories: Optional[List[str]] = None,
        styles: Optional[List[str]] = None,
        customer_phone: Optional[str] = None,
        customer_id: Optional[str] = None,
        source: str = "whatsapp",  # "whatsapp" or "stylist"
    ) -> None:
        """Increment demand counters for products and update customer taste profile."""
        now = datetime.now(timezone.utc)

        # 1. Update product_demand collection in MongoDB
        for pid in matched_product_ids:
            try:
                update_fields: Dict[str, Any] = {
                    "$inc": {
                        "inquiry_count": 1,
                        "whatsapp_inquiries": 1 if source == "whatsapp" else 0,
                        "stylist_inquiries": 1 if source == "stylist" else 0,
                    },
                    "$set": {
                        "product_id": pid,
                        "last_inquiry_at": now,
                    },
                    "$push": {
                        "inquiry_log": {
                            "$each": [{"timestamp": now.isoformat(), "source": source}],
                            "$slice": -50,  # Keep last 50 inquiry events for velocity
                        }
                    }
                }

                await db["product_demand"].update_one(
                    {"product_id": pid},
                    update_fields,
                    upsert=True,
                )
            except Exception as err:
                print(f"[WARNING] Failed to update demand for product {pid}: {err}")

        # 2. Update Customer Taste Profile
        if customer_phone or customer_id:
            try:
                query: Dict[str, Any] = {}
                if customer_id and ObjectId.is_valid(customer_id):
                    query["_id"] = ObjectId(customer_id)
                elif customer_phone:
                    clean_phone = customer_phone.replace("+", "").replace(" ", "").replace("-", "")
                    query["$or"] = [
                        {"phone": customer_phone},
                        {"whatsapp_id": customer_phone},
                        {"phone": clean_phone},
                        {"whatsapp_id": clean_phone},
                    ]

                customer = await db["customers"].find_one(query)
                if customer:
                    taste = customer.get("taste_profile") or {
                        "favorite_categories": {},
                        "favorite_styles": {},
                        "inquired_products": [],
                        "total_inquiries": 0,
                    }

                    fav_cats = taste.get("favorite_categories", {})
                    fav_styles = taste.get("favorite_styles", {})
                    inquired = taste.get("inquired_products", [])

                    if categories:
                        for cat in categories:
                            fav_cats[cat] = fav_cats.get(cat, 0) + 1
                    if styles:
                        for sty in styles:
                            fav_styles[sty] = fav_styles.get(sty, 0) + 1

                    for pid in matched_product_ids:
                        if pid not in inquired:
                            inquired.insert(0, pid)
                    inquired = inquired[:15]  # Keep 15 recent products

                    taste["favorite_categories"] = fav_cats
                    taste["favorite_styles"] = fav_styles
                    taste["inquired_products"] = inquired
                    taste["total_inquiries"] = taste.get("total_inquiries", 0) + 1
                    taste["last_interaction"] = now.isoformat()

                    await db["customers"].update_one(
                        {"_id": customer["_id"]},
                        {"$set": {"taste_profile": taste, "updated_at": now}}
                    )
            except Exception as cust_err:
                print(f"[WARNING] Failed to update customer taste vector: {cust_err}")

    @staticmethod
    async def get_demand_stats(db: Any, product_ids: List[str]) -> Dict[str, Dict[str, Any]]:
        """Fetch demand counters and velocity for given product IDs."""
        if not product_ids:
            return {}

        results: Dict[str, Dict[str, Any]] = {}
        try:
            cursor = db["product_demand"].find({"product_id": {"$in": product_ids}})
            async for doc in cursor:
                pid = doc.get("product_id")
                inq_count = doc.get("inquiry_count", 0)
                wa_count = doc.get("whatsapp_inquiries", 0)
                stylist_count = doc.get("stylist_inquiries", 0)

                # Calculate recent 48h velocity
                log = doc.get("inquiry_log", [])
                cutoff = datetime.now(timezone.utc) - timedelta(hours=48)
                recent_count = sum(
                    1 for item in log
                    if datetime.fromisoformat(item["timestamp"]) >= cutoff
                ) if log else inq_count

                # Formulate social proof badge
                badge = None
                if recent_count >= 8:
                    badge = f"🔥 Trending Now ({recent_count} asked recently on WhatsApp)"
                elif inq_count >= 5:
                    badge = "⭐ High Demand Item"

                results[pid] = {
                    "inquiry_count": inq_count,
                    "whatsapp_inquiries": wa_count,
                    "stylist_inquiries": stylist_count,
                    "recent_velocity": recent_count,
                    "badge": badge,
                }
        except Exception as e:
            print(f"[WARNING] Could not fetch demand stats: {e}")

        return results

    @staticmethod
    async def get_top_trending_product_ids(db: Any, limit: int = 10) -> List[str]:
        """Fetch top most demanded products overall across WhatsApp and Stylist."""
        try:
            cursor = db["product_demand"].find({}).sort("inquiry_count", -1).limit(limit)
            return [doc["product_id"] async for doc in cursor if "product_id" in doc]
        except Exception:
            return []


demand_tracker = DemandTracker()
