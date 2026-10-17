import asyncio
from datetime import datetime, timezone
import re
from typing import List, Optional
from bson import ObjectId
from fastapi import HTTPException, status
from db.mongodb import get_database
from models.campaign_model import CampaignCreate, CampaignModel, CampaignStatus
from integrations.whatsapp import whatsapp_client
from utils.email_service import email_service


class CampaignController:
    """Business logic for Promotional Offers, Multi-channel Broadcasts & Anti-spam Compliance."""

    @staticmethod
    def _format_phone(phone: Optional[str]) -> Optional[str]:
        """Normalizes phone number to international E.164 digits without symbols."""
        if not phone:
            return None
        cleaned = re.sub(r"[^\d+]", "", phone.strip())
        if cleaned.startswith("03"):
            cleaned = "92" + cleaned[1:]
        elif cleaned.startswith("+"):
            cleaned = cleaned[1:]
        return cleaned if len(cleaned) >= 10 else None

    @staticmethod
    async def create_campaign(data: CampaignCreate) -> dict:
        db = get_database()
        now = datetime.now(timezone.utc)

        # If this campaign is marked as active banner, deactivate previous active banners
        if data.is_active_banner:
            await db["campaigns"].update_many(
                {"is_active_banner": True},
                {"$set": {"is_active_banner": False}},
            )

        doc = CampaignModel(
            title=data.title,
            promo_code=data.promo_code or "FLASH25",
            discount_percent=data.discount_percent or 25,
            description=data.description,
            store_url=data.store_url or "http://localhost:3000",
            channels=data.channels or ["WHATSAPP", "EMAIL"],
            is_active_banner=data.is_active_banner if data.is_active_banner is not None else True,
            valid_from=data.valid_from,
            valid_until=data.valid_until,
            status=CampaignStatus.DRAFT,
            created_at=now,
        ).model_dump(by_alias=True, exclude={"id"})

        res = await db["campaigns"].insert_one(doc)
        doc["_id"] = str(res.inserted_id)
        doc["id"] = str(res.inserted_id)

        # Automatically synchronize / upsert promo code into coupons collection
        if data.promo_code:
            clean_promo = data.promo_code.strip().upper()
            try:
                await db["coupons"].update_one(
                    {"code": clean_promo},
                    {
                        "$set": {
                            "code": clean_promo,
                            "discount_type": "PERCENTAGE",
                            "discount_value": float(data.discount_percent or 25),
                            "description": data.description or f"{data.discount_percent}% OFF {data.title}",
                            "is_active": True,
                            "expiry_date": data.valid_until,
                            "updated_at": now,
                        },
                        "$setOnInsert": {
                            "min_order_amount": 0.0,
                            "max_discount_amount": 5000.0,
                            "created_at": now,
                        },
                    },
                    upsert=True,
                )
            except Exception as sync_err:
                print(f"[WARNING] Could not auto-sync campaign coupon to coupons collection: {sync_err}")

        return doc

    @staticmethod
    async def list_campaigns(limit: int = 50) -> List[dict]:
        db = get_database()
        cursor = db["campaigns"].find().sort("created_at", -1).limit(limit)
        items = []
        async for c in cursor:
            c["id"] = str(c["_id"])
            c["_id"] = str(c["_id"])
            items.append(c)
        return items

    @staticmethod
    async def get_active_campaign() -> Optional[dict]:
        db = get_database()
        now_utc = datetime.now(timezone.utc)

        # Check all candidate campaigns marked as active banner
        cursor = db["campaigns"].find({"is_active_banner": True}).sort("created_at", -1)
        async for camp in cursor:
            v_until = camp.get("valid_until")
            if v_until:
                if isinstance(v_until, str):
                    v_until = datetime.fromisoformat(v_until.replace("Z", "+00:00"))
                if v_until and v_until.tzinfo is None:
                    v_until = v_until.replace(tzinfo=timezone.utc)
                if v_until and now_utc > v_until:
                    continue  # Expired, skip
            camp["id"] = str(camp["_id"])
            camp["_id"] = str(camp["_id"])
            return camp

        # Fallback to the latest campaign if not expired
        fallback_cursor = db["campaigns"].find().sort("created_at", -1).limit(5)
        async for camp in fallback_cursor:
            v_until = camp.get("valid_until")
            if v_until:
                if isinstance(v_until, str):
                    v_until = datetime.fromisoformat(v_until.replace("Z", "+00:00"))
                if v_until and v_until.tzinfo is None:
                    v_until = v_until.replace(tzinfo=timezone.utc)
                if v_until and now_utc > v_until:
                    continue
            camp["id"] = str(camp["_id"])
            camp["_id"] = str(camp["_id"])
            return camp

        return None

    @staticmethod
    async def send_broadcast(campaign_id: str) -> dict:
        db = get_database()
        if not ObjectId.is_valid(campaign_id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid campaign ID")

        campaign = await db["campaigns"].find_one({"_id": ObjectId(campaign_id)})
        if not campaign:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

        # Mark campaign as SENDING
        await db["campaigns"].update_one(
            {"_id": ObjectId(campaign_id)},
            {"$set": {"status": CampaignStatus.SENDING.value}},
        )

        channels = campaign.get("channels", ["WHATSAPP", "EMAIL"])
        title = campaign.get("title", "Special Boutique Offer")
        promo_code = campaign.get("promo_code", "SALE25")
        discount_percent = campaign.get("discount_percent", 25)
        description = campaign.get("description", "")
        store_url = campaign.get("store_url", "http://localhost:5173")

        # Query all eligible customers (Safeguard 1: Anti-Spam Compliance - only opted-in customers)
        cursor = db["customers"].find({
            "consent_status": {"$ne": "OPTED_OUT"},
            "marketing_opt_in": {"$ne": False},
        })
        customers = [doc async for doc in cursor]

        stats = {
            "total_targets": len(customers),
            "whatsapp_sent": 0,
            "whatsapp_failed": 0,
            "email_sent": 0,
            "email_failed": 0,
            "skipped_opted_out": 0,
        }

        # Loop through recipients with controlled throttling (Safeguard 2: Anti-ban rate limiting)
        for cust in customers:
            cust_name = cust.get("name") or "Valued Shopper"
            raw_phone = cust.get("phone") or cust.get("whatsapp_id")
            clean_phone = CampaignController._format_phone(raw_phone)
            email_addr = cust.get("email")

            # 1. WhatsApp Channel
            if "WHATSAPP" in channels and clean_phone:
                wa_body = (
                    f"✨ *{title}* ✨\n\n"
                    f"Hello {cust_name}! 👗\n\n"
                    f"{description}\n\n"
                    f"🎟️ *Promo Code:* *{promo_code}*\n"
                    f"🏷️ *Special Discount:* *{discount_percent}% OFF*\n"
                    f"🛍️ *Shop Collection Online:* {store_url}\n\n"
                    f"💡 *Fast Order:* You can also reply directly to this chat and our AI Stylist will reserve and dispatch your pieces for you! ✨\n\n"
                    f"---------------------------\n"
                    f"_Reply STOP to unsubscribe from store promotional updates._"
                )
                try:
                    await whatsapp_client.send_text_message(clean_phone, wa_body)
                    stats["whatsapp_sent"] += 1
                except Exception as err:
                    print(f"[WARNING] WhatsApp broadcast error to {clean_phone}: {err}")
                    stats["whatsapp_failed"] += 1

                # Safety throttle: pause 60ms between WhatsApp calls to prevent burst limits
                await asyncio.sleep(0.06)

            # 2. Email Channel
            if "EMAIL" in channels and email_addr and "@" in email_addr:
                try:
                    ok = await email_service.send_promo_email(
                        recipient_email=email_addr,
                        customer_name=cust_name,
                        title=title,
                        description=description,
                        promo_code=promo_code,
                        discount_percent=discount_percent,
                        store_url=store_url,
                    )
                    if ok:
                        stats["email_sent"] += 1
                    else:
                        stats["email_failed"] += 1
                except Exception as e_err:
                    print(f"[WARNING] Email broadcast error to {email_addr}: {e_err}")
                    stats["email_failed"] += 1

                # Brief safety throttle for email
                await asyncio.sleep(0.04)

        now = datetime.now(timezone.utc)
        await db["campaigns"].update_one(
            {"_id": ObjectId(campaign_id)},
            {
                "$set": {
                    "status": CampaignStatus.SENT.value,
                    "stats": stats,
                    "sent_at": now,
                    "is_active_banner": True,
                }
            },
        )

        # Audit log creation
        await db["audit_logs"].insert_one({
            "actor_user_id": None,
            "action": "CAMPAIGN_BROADCAST_SENT",
            "entity_type": "campaigns",
            "entity_id": campaign_id,
            "created_at": now,
            "metadata": {"title": title, "stats": stats},
        })

        updated = await db["campaigns"].find_one({"_id": ObjectId(campaign_id)})
        updated["id"] = str(updated["_id"])
        updated["_id"] = str(updated["_id"])
        return updated


campaign_controller = CampaignController()
