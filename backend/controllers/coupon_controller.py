from datetime import datetime, timezone
from typing import List, Optional
from bson import ObjectId
from fastapi import HTTPException, status
from db.mongodb import get_database
from models.coupon_model import (
    CouponCreate,
    CouponModel,
    CouponValidateRequest,
    CouponValidateResponse,
    DiscountType,
)


class CouponController:
    """Enterprise Business Logic for Discounts, Promo Vouchers & Cart Validation."""

    @staticmethod
    async def seed_default_coupons():
        """Ensure standard boutique promo codes are available."""
        db = get_database()
        now = datetime.now(timezone.utc)
        defaults = [
            {
                "code": "GALA30",
                "discount_type": DiscountType.PERCENTAGE.value,
                "discount_value": 30.0,
                "min_order_amount": 0.0,
                "max_discount_amount": 5000.0,
                "description": "30% OFF Mid-Season Luxury Gala Voucher",
                "is_active": True,
                "created_at": now,
            },
            {
                "code": "WELCOME10",
                "discount_type": DiscountType.PERCENTAGE.value,
                "discount_value": 10.0,
                "min_order_amount": 1000.0,
                "max_discount_amount": 2500.0,
                "description": "10% OFF Welcome discount on first order",
                "is_active": True,
                "created_at": now,
            },
            {
                "code": "FLASH25",
                "discount_type": DiscountType.PERCENTAGE.value,
                "discount_value": 25.0,
                "min_order_amount": 2000.0,
                "max_discount_amount": 5000.0,
                "description": "25% OFF Summer Flash Sale voucher",
                "is_active": True,
                "created_at": now,
            },
            {
                "code": "EID2026",
                "discount_type": DiscountType.FIXED_PKR.value,
                "discount_value": 1500.0,
                "min_order_amount": 6000.0,
                "max_discount_amount": None,
                "description": "Flat PKR 1,500 OFF on festive couture collections",
                "is_active": True,
                "created_at": now,
            },
            {
                "code": "LUXE500",
                "discount_type": DiscountType.FIXED_PKR.value,
                "discount_value": 500.0,
                "min_order_amount": 2000.0,
                "max_discount_amount": None,
                "description": "Flat PKR 500 OFF instant checkout voucher",
                "is_active": True,
                "created_at": now,
            },
        ]
        for c in defaults:
            await db["coupons"].update_one(
                {"code": c["code"]},
                {"$setOnInsert": c},
                upsert=True
            )

    @staticmethod
    async def validate_coupon(data: CouponValidateRequest) -> CouponValidateResponse:
        import re
        db = get_database()
        clean_code = data.code.strip().upper()
        subtotal = float(data.subtotal)

        coupon = await db["coupons"].find_one({"code": clean_code, "is_active": True})
        if not coupon:
            # Fallback: check campaigns collection for active broadcast promo code
            camp = await db["campaigns"].find_one({
                "promo_code": {"$regex": f"^{re.escape(clean_code)}$", "$options": "i"},
                "is_active_banner": True
            })
            if not camp:
                camp = await db["campaigns"].find_one({
                    "promo_code": {"$regex": f"^{re.escape(clean_code)}$", "$options": "i"}
                })

            if camp:
                now_utc = datetime.now(timezone.utc)
                if camp.get("valid_from"):
                    v_from = camp["valid_from"]
                    if isinstance(v_from, str):
                        v_from = datetime.fromisoformat(v_from.replace("Z", "+00:00"))
                    if v_from and v_from.tzinfo is None:
                        v_from = v_from.replace(tzinfo=timezone.utc)
                    if v_from and now_utc < v_from:
                        return CouponValidateResponse(
                            valid=False,
                            code=clean_code,
                            discount_amount=0.0,
                            final_subtotal=subtotal,
                            message=f"Offer '{clean_code}' begins on {v_from.strftime('%d %b %Y, %I:%M %p')}.",
                        )

                if camp.get("valid_until"):
                    v_until = camp["valid_until"]
                    if isinstance(v_until, str):
                        v_until = datetime.fromisoformat(v_until.replace("Z", "+00:00"))
                    if v_until and v_until.tzinfo is None:
                        v_until = v_until.replace(tzinfo=timezone.utc)
                    if v_until and now_utc > v_until:
                        return CouponValidateResponse(
                            valid=False,
                            code=clean_code,
                            discount_amount=0.0,
                            final_subtotal=subtotal,
                            message=f"Campaign offer '{clean_code}' expired on {v_until.strftime('%d %b %Y, %I:%M %p')}.",
                        )

                disc_pct = float(camp.get("discount_percent", 30))
                coupon = {
                    "code": clean_code,
                    "discount_type": DiscountType.PERCENTAGE.value,
                    "discount_value": disc_pct,
                    "min_order_amount": 0.0,
                    "max_discount_amount": 5000.0,
                    "description": camp.get("description") or f"{disc_pct}% OFF Luxury Gala Voucher",
                    "is_active": True,
                    "expiry_date": camp.get("valid_until"),
                }
                try:
                    await db["coupons"].update_one(
                        {"code": clean_code},
                        {"$setOnInsert": {**coupon, "created_at": datetime.now(timezone.utc)}},
                        upsert=True
                    )
                except Exception:
                    pass

        if not coupon:
            return CouponValidateResponse(
                valid=False,
                code=clean_code,
                discount_amount=0.0,
                final_subtotal=subtotal,
                message=f"Coupon code '{clean_code}' is invalid or has expired.",
            )

        # Check expiry date if specified
        if coupon.get("expiry_date"):
            exp = coupon["expiry_date"]
            if isinstance(exp, str):
                exp = datetime.fromisoformat(exp.replace("Z", "+00:00"))
            if exp and exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            if exp and datetime.now(timezone.utc) > exp:
                return CouponValidateResponse(
                    valid=False,
                    code=clean_code,
                    discount_amount=0.0,
                    final_subtotal=subtotal,
                    message=f"Coupon code '{clean_code}' expired on {exp.strftime('%d %b %Y, %I:%M %p')}.",
                )

        # Check minimum order amount
        min_order = float(coupon.get("min_order_amount", 0.0))
        if subtotal < min_order:
            return CouponValidateResponse(
                valid=False,
                code=clean_code,
                discount_amount=0.0,
                final_subtotal=subtotal,
                message=f"Coupon '{clean_code}' requires a minimum cart subtotal of PKR {min_order:,.0f} (Your current subtotal: PKR {subtotal:,.0f}).",
            )

        # Calculate discount amount
        discount_type = coupon.get("discount_type", DiscountType.PERCENTAGE.value)
        discount_value = float(coupon.get("discount_value", 0.0))
        discount_amount = 0.0

        if discount_type == DiscountType.PERCENTAGE.value:
            discount_amount = (subtotal * discount_value) / 100.0
            max_cap = coupon.get("max_discount_amount")
            if max_cap and discount_amount > float(max_cap):
                discount_amount = float(max_cap)
        else:
            discount_amount = min(discount_value, subtotal)

        discount_amount = round(discount_amount, 2)
        final_subtotal = max(0.0, round(subtotal - discount_amount, 2))

        return CouponValidateResponse(
            valid=True,
            code=clean_code,
            discount_type=discount_type,
            discount_value=discount_value,
            discount_amount=discount_amount,
            final_subtotal=final_subtotal,
            message=f"Mubarak! Coupon '{clean_code}' applied: You saved PKR {discount_amount:,.2f}!",
        )

    @staticmethod
    async def list_coupons() -> List[dict]:
        db = get_database()
        cursor = db["coupons"].find().sort("created_at", -1)
        res = []
        async for c in cursor:
            res.append({
                "id": str(c["_id"]),
                "code": c["code"],
                "discount_type": c.get("discount_type", "PERCENTAGE"),
                "discount_value": c.get("discount_value", 0.0),
                "min_order_amount": c.get("min_order_amount", 0.0),
                "max_discount_amount": c.get("max_discount_amount"),
                "description": c.get("description"),
                "is_active": c.get("is_active", True),
                "expiry_date": c.get("expiry_date"),
                "created_at": c.get("created_at"),
            })
        return res

    @staticmethod
    async def create_coupon(data: CouponCreate) -> dict:
        db = get_database()
        clean_code = data.code.strip().upper()
        existing = await db["coupons"].find_one({"code": clean_code})
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Coupon code '{clean_code}' already exists.",
            )

        now = datetime.now(timezone.utc)
        doc = CouponModel(
            code=clean_code,
            discount_type=data.discount_type,
            discount_value=data.discount_value,
            min_order_amount=data.min_order_amount,
            max_discount_amount=data.max_discount_amount,
            description=data.description,
            is_active=data.is_active,
            expiry_date=data.expiry_date,
            created_at=now,
        ).model_dump(by_alias=True, exclude={"id"})

        res = await db["coupons"].insert_one(doc)
        return {
            "id": str(res.inserted_id),
            "code": clean_code,
            "discount_type": data.discount_type.value,
            "discount_value": data.discount_value,
            "min_order_amount": data.min_order_amount,
            "max_discount_amount": data.max_discount_amount,
            "description": data.description,
            "is_active": data.is_active,
            "created_at": now,
        }

    @staticmethod
    async def delete_coupon(coupon_id: str) -> bool:
        db = get_database()
        if not ObjectId.is_valid(coupon_id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid coupon ID")
        res = await db["coupons"].delete_one({"_id": ObjectId(coupon_id)})
        return res.deleted_count > 0


coupon_controller = CouponController()
