import asyncio
import random
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from bson import ObjectId
from fastapi import HTTPException, status
from db.mongodb import get_database
from models.order_model import OrderCreate, OrderItem, OrderModel, OrderStatus, OrderUpdateStatus, StatusHistoryItem


from utils.phone_utils import normalize_pakistan_phone


def generate_order_number() -> str:
    now = datetime.now(timezone.utc)
    rand = random.randint(1000, 9999)
    return f"ORD-{now.strftime('%Y%m%d')}-{rand}"


class OrderController:
    """Business logic for Customer Orders & Status History."""

    @staticmethod
    async def _resolve_and_deduct_inventory(db, items: List[Any]) -> List[Any]:
        """
        Validates inventory availability and atomically decrements stock for each order item.
        If any item has insufficient stock, rolls back all previous deductions and raises 400.
        Supports both OrderItem instances and dictionary items.
        """
        deducted_records = []  # list of (variant_id, qty, product_id) for rollback

        try:
            for item in items:
                is_model = not isinstance(item, dict)
                product_id = getattr(item, "product_id", None) if is_model else item.get("product_id")
                variant_id = getattr(item, "variant_id", None) if is_model else item.get("variant_id")
                name = (getattr(item, "name", None) if is_model else item.get("name")) or "Item"
                color = getattr(item, "color", None) if is_model else item.get("color")
                size = getattr(item, "size", None) if is_model else item.get("size")
                sku = getattr(item, "sku", None) if is_model else item.get("sku")
                qty = int((getattr(item, "quantity", 1) if is_model else item.get("quantity", 1)) or 1)

                variant_doc = None

                # 1. Resolve by variant_id
                if variant_id and ObjectId.is_valid(variant_id):
                    variant_doc = await db["product_variants"].find_one({"_id": ObjectId(variant_id)})

                # 2. Resolve by product_id and matching color & size
                if not variant_doc and product_id:
                    q = {"product_id": str(product_id)}
                    if color and color != "Standard":
                        q["color"] = {"$regex": f"^{re.escape(str(color))}$", "$options": "i"}
                    if size and size != "Standard":
                        q["size"] = {"$regex": f"^{re.escape(str(size))}$", "$options": "i"}
                    variant_doc = await db["product_variants"].find_one(q)

                # 3. Resolve by product_id and sku
                if not variant_doc and product_id and sku:
                    variant_doc = await db["product_variants"].find_one({"product_id": str(product_id), "sku": sku})

                # 4. Fallback: first variant for this product
                if not variant_doc and product_id:
                    variant_doc = await db["product_variants"].find_one({"product_id": str(product_id)})

                if variant_doc:
                    current_avail = int(variant_doc.get("available_quantity", 0))
                    if current_avail < qty:
                        var_name = f"{variant_doc.get('color', '')} {variant_doc.get('size', '')}".strip()
                        desc = f"{name} ({var_name})" if var_name else name
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Stock insufficient for '{desc}'. Only {current_avail} units left in stock (requested {qty}).",
                        )

                    # Atomically decrement available_quantity
                    updated = await db["product_variants"].find_one_and_update(
                        {"_id": variant_doc["_id"], "available_quantity": {"$gte": qty}},
                        {"$inc": {"available_quantity": -qty}, "$set": {"updated_at": datetime.now(timezone.utc)}},
                        return_document=True,
                    )
                    if not updated:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Item '{name}' just sold out or stock became insufficient.",
                        )

                    # Set resolved variant_id back on item
                    if is_model:
                        item.variant_id = str(variant_doc["_id"])
                    else:
                        item["variant_id"] = str(variant_doc["_id"])

                    p_ref = variant_doc.get("product_id") or product_id
                    deducted_records.append((variant_doc["_id"], qty, p_ref))

                    # Update parent product total_stock if tracked
                    if p_ref and ObjectId.is_valid(p_ref):
                        await db["products"].update_one(
                            {"_id": ObjectId(p_ref)},
                            {"$inc": {"total_stock": -qty}, "$set": {"updated_at": datetime.now(timezone.utc)}},
                        )
                else:
                    # Direct product fallback
                    if product_id and ObjectId.is_valid(product_id):
                        p_doc = await db["products"].find_one({"_id": ObjectId(product_id)})
                        if p_doc and p_doc.get("total_stock") is not None:
                            curr_stock = int(p_doc.get("total_stock", 0))
                            if curr_stock < qty:
                                raise HTTPException(
                                    status_code=status.HTTP_400_BAD_REQUEST,
                                    detail=f"Stock insufficient for '{name}'. Only {curr_stock} left in stock.",
                                )
                            await db["products"].update_one(
                                {"_id": ObjectId(product_id), "total_stock": {"$gte": qty}},
                                {"$inc": {"total_stock": -qty}, "$set": {"updated_at": datetime.now(timezone.utc)}},
                            )

            return items

        except HTTPException:
            # Rollback previous deductions if any item failed
            for v_id, qty, p_id in deducted_records:
                try:
                    await db["product_variants"].update_one(
                        {"_id": v_id},
                        {"$inc": {"available_quantity": qty}},
                    )
                    if p_id and ObjectId.is_valid(p_id):
                        await db["products"].update_one(
                            {"_id": ObjectId(p_id)},
                            {"$inc": {"total_stock": qty}},
                        )
                except Exception as rb_err:
                    print(f"[ERROR] Rollback failed for variant {v_id}: {rb_err}")
            raise

    @staticmethod
    async def restore_order_inventory(order_id_or_num: str, reason: str = "Order Cancelled or Returned") -> bool:
        """
        Atomically restores inventory for an order if it was previously deducted and not yet restored.
        Guarantees idempotency (will not restore twice).
        """
        db = get_database()
        target_q = {"order_number": order_id_or_num}
        if ObjectId.is_valid(order_id_or_num):
            target_q = {"$or": [{"_id": ObjectId(order_id_or_num)}, {"order_number": order_id_or_num}]}

        order = await db["orders"].find_one(target_q)
        if not order:
            return False

        # Idempotency check: only restore if inventory was not already restored
        if order.get("inventory_restored"):
            return False

        now = datetime.now(timezone.utc)
        items = order.get("items", [])

        for it in items:
            qty = int(it.get("quantity", 1) or 1)
            v_id = it.get("variant_id")
            restored = False

            if v_id and ObjectId.is_valid(v_id):
                res = await db["product_variants"].update_one(
                    {"_id": ObjectId(v_id)},
                    {"$inc": {"available_quantity": qty}, "$set": {"updated_at": now}}
                )
                if res.modified_count > 0:
                    restored = True

            if not restored:
                p_id = it.get("product_id")
                col = it.get("color")
                sz = it.get("size")
                sku = it.get("sku")
                q = {"product_id": str(p_id)}
                if col and col != "Standard":
                    q["color"] = {"$regex": f"^{re.escape(str(col))}$", "$options": "i"}
                if sz and sz != "Standard":
                    q["size"] = {"$regex": f"^{re.escape(str(sz))}$", "$options": "i"}
                v_match = await db["product_variants"].find_one(q)
                if not v_match and sku:
                    v_match = await db["product_variants"].find_one({"product_id": str(p_id), "sku": sku})
                if v_match:
                    await db["product_variants"].update_one(
                        {"_id": v_match["_id"]},
                        {"$inc": {"available_quantity": qty}, "$set": {"updated_at": now}}
                    )

            # Also update product total_stock if tracked
            pid = it.get("product_id")
            if pid and ObjectId.is_valid(pid):
                await db["products"].update_one(
                    {"_id": ObjectId(pid)},
                    {"$inc": {"total_stock": qty}, "$set": {"updated_at": now}}
                )

        await db["orders"].update_one(
            {"_id": order["_id"]},
            {
                "$set": {
                    "inventory_restored": True,
                    "inventory_restored_at": now,
                    "inventory_restored_reason": reason,
                    "updated_at": now,
                }
            }
        )

        await db["audit_logs"].insert_one({
            "actor_user_id": None,
            "action": "INVENTORY_RESTORED",
            "entity_type": "orders",
            "entity_id": str(order["_id"]),
            "created_at": now,
            "metadata": {
                "order_number": order.get("order_number"),
                "reason": reason,
                "item_count": len(items),
            },
        })

        return True

    @staticmethod
    async def create_order(data: OrderCreate) -> dict:
        db = get_database()
        order_number = data.order_number or generate_order_number()

        # Check order number uniqueness
        while await db["orders"].find_one({"order_number": order_number}):
            order_number = generate_order_number()

        now = datetime.now(timezone.utc)

        # Strict customer profile validation before placing order
        addr = data.address_snapshot
        full_name = (addr.full_name or "").strip()
        phone = (addr.phone or "").strip()
        street_address = (addr.street_address or "").strip()
        city = (addr.city or "").strip()
        email = (addr.email or "").strip() if addr.email else None

        missing = []
        if not full_name:
            missing.append("Full Name")
        if not phone:
            missing.append("WhatsApp/Phone Number")
        if not street_address:
            missing.append("Complete Street Address")
        if not city:
            missing.append("City")

        if missing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Please provide all required customer details before placing an order. Missing: {', '.join(missing)}.",
            )

        # Resolve or auto-register & update customer profile in customers collection
        customer_id = data.customer_id
        clean_wa_id = normalize_pakistan_phone(phone)

        # Look up by phone or whatsapp_id first to prevent duplicate key collisions
        lookup_conditions = [
            {"whatsapp_id": clean_wa_id},
            {"phone": clean_wa_id},
            {"phone": phone},
            {"phone": f"+{clean_wa_id}"},
            {"whatsapp_id": phone},
        ]
        if clean_wa_id.startswith("92"):
            pk_local = f"0{clean_wa_id[2:]}"
            lookup_conditions.append({"phone": pk_local})
            lookup_conditions.append({"whatsapp_id": pk_local})

        existing_cust = await db["customers"].find_one({"$or": lookup_conditions})
        if not existing_cust and customer_id and ObjectId.is_valid(customer_id) and customer_id != "guest":
            existing_cust = await db["customers"].find_one({"_id": ObjectId(customer_id)})

        customer_update_data = {
            "name": full_name,
            "phone": phone,
            "whatsapp_id": clean_wa_id,
            "address": street_address,
            "city": city,
            "updated_at": now,
        }
        if email:
            customer_update_data["email"] = email

        if existing_cust:
            customer_id = str(existing_cust["_id"])
            try:
                await db["customers"].update_one(
                    {"_id": existing_cust["_id"]},
                    {"$set": customer_update_data},
                )
            except Exception:
                # In case whatsapp_id collides with an existing index, update other profile fields safely
                customer_update_data.pop("whatsapp_id", None)
                await db["customers"].update_one(
                    {"_id": existing_cust["_id"]},
                    {"$set": customer_update_data},
                )
        else:
            cust_doc = {
                **customer_update_data,
                "consent_status": "OPTED_IN",
                "marketing_opt_in": True,
                "created_at": now,
                "tags": ["verified_shopper"],
            }
            try:
                c_res = await db["customers"].insert_one(cust_doc)
                customer_id = str(c_res.inserted_id)
            except Exception:
                dup_cust = await db["customers"].find_one({"whatsapp_id": clean_wa_id})
                if dup_cust:
                    customer_id = str(dup_cust["_id"])
                    await db["customers"].update_one(
                        {"_id": dup_cust["_id"]},
                        {"$set": customer_update_data},
                    )

        # Ensure each order item has an image_url
        for item in data.items:
            if not getattr(item, "image_url", None) and item.product_id:
                try:
                    prod_q = {"_id": ObjectId(item.product_id)} if ObjectId.is_valid(item.product_id) else {"slug": item.product_id}
                    prod_doc = await db["products"].find_one(prod_q, {"image_urls": 1})
                    if prod_doc and prod_doc.get("image_urls"):
                        item.image_url = prod_doc["image_urls"][0]
                except Exception:
                    pass

        # Atomically validate inventory availability and decrement stock for all ordered items
        await OrderController._resolve_and_deduct_inventory(db, data.items)

        initial_history = [
            StatusHistoryItem(
                status=data.status or OrderStatus.PENDING,
                timestamp=now,
                note="Order placed via Storefront Instant Checkout",
            )
        ]

        doc = OrderModel(
            order_number=order_number,
            customer_id=customer_id,
            status=data.status or OrderStatus.PENDING,
            items=data.items,
            subtotal=data.subtotal,
            delivery_fee=data.delivery_fee,
            coupon_code=data.coupon_code,
            discount_amount=data.discount_amount or 0.0,
            total=data.total,
            currency=data.currency,
            address_snapshot=data.address_snapshot,
            created_at=now,
            status_history=initial_history,
            inventory_deducted=True,
            inventory_restored=False,
        ).model_dump(by_alias=True, exclude={"id"})

        result = await db["orders"].insert_one(doc)

        # Audit log creation
        await db["audit_logs"].insert_one({
            "actor_user_id": None,
            "action": "ORDER_CREATED",
            "entity_type": "orders",
            "entity_id": str(result.inserted_id),
            "created_at": now,
            "metadata": {"order_number": order_number, "total": data.total},
        })

        # Continuous Online Learning: Highest-value conversion feedback
        try:
            import asyncio
            from ai.online_learning import online_learning_engine
            ordered_pids = [str(it.product_id) for it in data.items if it.product_id]
            for pid in ordered_pids:
                other_pids = [o for o in ordered_pids if o != pid]
                asyncio.create_task(
                    online_learning_engine.record_interaction(
                        db=db,
                        event_type="order_purchased",
                        product_id=pid,
                        related_product_ids=other_pids,
                        customer_phone=phone,
                        customer_id=customer_id,
                        metadata={"order_number": order_number, "order_total": data.total},
                    )
                )
        except Exception as ol_err:
            print(f"[WARNING] Online learning interaction log failed: {ol_err}")

        # Dispatch Automated Order Confirmation Email
        if email:
            try:
                from utils.email_service import email_service
                items_summary = [
                    {
                        "name": it.name,
                        "size": getattr(it, "size", None) or "Standard",
                        "color": getattr(it, "color", None) or "Standard",
                        "quantity": it.quantity,
                        "unit_price": it.unit_price,
                        "image_url": getattr(it, "image_url", None),
                    }
                    for it in data.items
                ]
                asyncio.create_task(
                    email_service.send_order_confirmation(
                        recipient_email=email,
                        customer_name=full_name,
                        order_number=order_number,
                        total_amount=data.total,
                        currency=data.currency or "PKR",
                        items=items_summary,
                        delivery_address=f"{street_address}, {city}",
                    )
                )
            except Exception as mail_err:
                print(f"[WARNING] Failed to queue order confirmation email: {mail_err}")

        # Dispatch Automated WhatsApp Order Confirmation Message
        if phone:
            try:
                from integrations.whatsapp import whatsapp_client
                items_desc = "\n".join([
                    f"• {it.quantity}x {it.name}" +
                    (f" (Color: {it.color})" if getattr(it, "color", None) and it.color != "Standard" else "") +
                    (f" (Size: {it.size})" if getattr(it, "size", None) and it.size != "Standard" else "")
                    for it in data.items
                ])
                first_img = next((it.image_url for it in data.items if getattr(it, "image_url", None)), None)
                wa_confirm_msg = (
                    f"🎉 *Mubarak {full_name}! Your order has been placed successfully!* ✨\n\n"
                    f"📦 *Order ID / Number:* *#{order_number}*\n"
                    f"👗 *Items:*\n{items_desc}\n"
                    f"🏷️ *Total Payable:* PKR {data.total:.2f} (Free Express Delivery 🚚)\n"
                    f"📍 *Delivery Destination:* {street_address}, {city}\n"
                    f"💵 *Payment Method:* Cash on Delivery (COD)\n\n"
                    f"Our atelier team is already preparing your package for courier dispatch! "
                    f"You can track your order anytime with ID *#{order_number}*. 📦👗"
                )
                async def _send_wa_order_notification():
                    clean_ph = normalize_pakistan_phone(phone)
                    try:
                        sent_ok = False
                        if first_img and str(first_img).startswith("http"):
                            try:
                                await whatsapp_client.send_image_message(clean_ph, first_img, caption=wa_confirm_msg[:1000])
                                sent_ok = True
                            except Exception as img_err:
                                print(f"[WARNING] WhatsApp image dispatch failed ({img_err}), falling back to text...")
                        
                        if not sent_ok:
                            await whatsapp_client.send_text_message(clean_ph, wa_confirm_msg)
                        print(f"[INFO] WhatsApp order notification dispatched successfully to {clean_ph} for #{order_number}")
                    except Exception as e:
                        print(f"[WARNING] Could not dispatch WhatsApp order notification to {clean_ph}: {e}")

                    # Sync order confirmation to in-app conversations & messages collections
                    try:
                        conv = await db["conversations"].find_one({
                            "$or": [
                                {"customer_id": customer_id},
                                {"customer_phone": clean_ph},
                                {"customer_phone": phone},
                            ]
                        })
                        conv_id = None
                        if conv:
                            conv_id = str(conv["_id"])
                        else:
                            c_ins = await db["conversations"].insert_one({
                                "customer_id": customer_id,
                                "customer_phone": clean_ph or phone,
                                "customer_name": full_name,
                                "channel": "whatsapp",
                                "status": "AI_ACTIVE",
                                "unread_count": 0,
                                "last_message": f"Order #{order_number} placed (PKR {data.total:.2f})",
                                "last_message_at": now,
                                "created_at": now,
                                "updated_at": now,
                            })
                            conv_id = str(c_ins.inserted_id)

                        await db["messages"].insert_one({
                            "conversation_id": conv_id,
                            "direction": "OUTBOUND",
                            "sender": "SYSTEM",
                            "sender_name": "Luxe Order Bot",
                            "message_type": "text",
                            "content": wa_confirm_msg,
                            "image_url": first_img if (first_img and str(first_img).startswith("http")) else None,
                            "delivery_status": "SENT",
                            "created_at": now,
                            "metadata": {
                                "order_number": order_number,
                                "total": data.total,
                                "channel": "order_confirmation"
                            }
                        })
                        await db["conversations"].update_one(
                            {"_id": ObjectId(conv_id)},
                            {"$set": {
                                "last_message": f"Order #{order_number} Placed (PKR {data.total:.2f})",
                                "last_message_at": now,
                                "updated_at": now,
                            }}
                        )
                    except Exception as sync_err:
                        print(f"[WARNING] Failed to sync order confirmation to conversation history: {sync_err}")

                asyncio.create_task(_send_wa_order_notification())
            except Exception as wa_err:
                print(f"[WARNING] Failed to queue WhatsApp order notification: {wa_err}")

        return {
            "id": str(result.inserted_id),
            "order_number": order_number,
            "customer_id": data.customer_id,
            "status": data.status or OrderStatus.PENDING,
            "items": [item.model_dump() for item in data.items],
            "subtotal": data.subtotal,
            "delivery_fee": data.delivery_fee,
            "coupon_code": data.coupon_code,
            "discount_amount": data.discount_amount or 0.0,
            "total": data.total,
            "currency": data.currency,
            "address_snapshot": data.address_snapshot.model_dump(),
            "created_at": now,
            "status_history": [h.model_dump() for h in initial_history],
            "inventory_deducted": True,
            "inventory_restored": False,
        }

    @staticmethod
    async def _enrich_items_with_images(db, items: List[dict]) -> List[dict]:
        """Backfill missing image_url from products collection for any items."""
        missing_ids = []
        for it in items:
            if not it.get("image_url") and it.get("product_id"):
                pid = it["product_id"]
                if ObjectId.is_valid(pid):
                    missing_ids.append(ObjectId(pid))
        
        if missing_ids:
            try:
                prod_map = {}
                cursor = db["products"].find({"_id": {"$in": missing_ids}}, {"image_urls": 1})
                async for p in cursor:
                    if p.get("image_urls"):
                        prod_map[str(p["_id"])] = p["image_urls"][0]
                for it in items:
                    if not it.get("image_url") and it.get("product_id") in prod_map:
                        it["image_url"] = prod_map[it["product_id"]]
            except Exception:
                pass

        # Fallback image if still missing
        for it in items:
            if not it.get("image_url"):
                it["image_url"] = "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=400&q=80"
        return items

    @staticmethod
    async def get_order(identifier: str) -> dict:
        db = get_database()
        query = {"order_number": identifier}
        if ObjectId.is_valid(identifier):
            query = {"$or": [{"_id": ObjectId(identifier)}, {"order_number": identifier}]}

        doc = await db["orders"].find_one(query)
        if not doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

        items = doc.get("items", [])
        await OrderController._enrich_items_with_images(db, items)

        return {
            "id": str(doc["_id"]),
            "order_number": doc["order_number"],
            "customer_id": doc["customer_id"],
            "status": doc["status"],
            "items": items,
            "subtotal": doc["subtotal"],
            "delivery_fee": doc.get("delivery_fee", 0.0),
            "coupon_code": doc.get("coupon_code"),
            "discount_amount": doc.get("discount_amount", 0.0),
            "total": doc["total"],
            "currency": doc.get("currency", "PKR"),
            "address_snapshot": doc.get("address_snapshot", {}),
            "created_at": doc["created_at"],
            "status_history": doc.get("status_history", []),
            "cancellation_reason": doc.get("cancellation_reason"),
            "return_reason": doc.get("return_reason"),
            "return_details": doc.get("return_details"),
            "return_requested_at": doc.get("return_requested_at"),
            "return_status": doc.get("return_status"),
            "courier_partner": doc.get("courier_partner"),
            "tracking_number": doc.get("tracking_number"),
            "tracking_url": doc.get("tracking_url"),
            "courier_status": doc.get("courier_status"),
            "shipped_at": doc.get("shipped_at"),
            "estimated_delivery": doc.get("estimated_delivery"),
            "parcel_weight_kg": doc.get("parcel_weight_kg", 0.5),
            "courier_booking_id": doc.get("courier_booking_id"),
            "courier_notes": doc.get("courier_notes"),
            "inventory_deducted": doc.get("inventory_deducted", False),
            "inventory_restored": doc.get("inventory_restored", False),
            "inventory_restored_at": doc.get("inventory_restored_at"),
            "inventory_restored_reason": doc.get("inventory_restored_reason"),
        }

    @staticmethod
    async def list_orders(customer_id: Optional[str] = None, order_status: Optional[OrderStatus] = None, limit: int = 50, skip: int = 0) -> List[dict]:
        db = get_database()
        query = {}
        if customer_id:
            query["customer_id"] = customer_id
        if order_status:
            query["status"] = order_status.value

        cursor = db["orders"].find(query).sort("created_at", -1).skip(skip).limit(limit)
        orders_raw = []
        all_missing_ids = set()

        async for doc in cursor:
            order_items = doc.get("items", [])
            for it in order_items:
                if not it.get("image_url") and it.get("product_id"):
                    pid = it["product_id"]
                    if ObjectId.is_valid(pid):
                        all_missing_ids.add(ObjectId(pid))
            orders_raw.append(doc)

        # Batch resolve all missing product images in a single DB query
        prod_map = {}
        if all_missing_ids:
            try:
                p_cursor = db["products"].find({"_id": {"$in": list(all_missing_ids)}}, {"image_urls": 1})
                async for p in p_cursor:
                    if p.get("image_urls"):
                        prod_map[str(p["_id"])] = p["image_urls"][0]
            except Exception:
                pass

        default_img = "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=400&q=80"
        items = []
        for doc in orders_raw:
            order_items = doc.get("items", [])
            for it in order_items:
                if not it.get("image_url"):
                    it["image_url"] = prod_map.get(it.get("product_id"), default_img)

            items.append({
                "id": str(doc["_id"]),
                "order_number": doc["order_number"],
                "customer_id": doc["customer_id"],
                "status": doc["status"],
                "items": order_items,
                "subtotal": doc["subtotal"],
                "delivery_fee": doc.get("delivery_fee", 0.0),
                "coupon_code": doc.get("coupon_code"),
                "discount_amount": doc.get("discount_amount", 0.0),
                "total": doc["total"],
                "currency": doc.get("currency", "PKR"),
                "address_snapshot": doc.get("address_snapshot", {}),
                "created_at": doc["created_at"],
                "status_history": doc.get("status_history", []),
                "cancellation_reason": doc.get("cancellation_reason"),
                "return_reason": doc.get("return_reason"),
                "return_details": doc.get("return_details"),
                "return_requested_at": doc.get("return_requested_at"),
                "return_status": doc.get("return_status"),
                "courier_partner": doc.get("courier_partner"),
                "tracking_number": doc.get("tracking_number"),
                "tracking_url": doc.get("tracking_url"),
                "courier_status": doc.get("courier_status"),
                "shipped_at": doc.get("shipped_at"),
                "estimated_delivery": doc.get("estimated_delivery"),
                "parcel_weight_kg": doc.get("parcel_weight_kg", 0.5),
                "courier_booking_id": doc.get("courier_booking_id"),
                "courier_notes": doc.get("courier_notes"),
                "inventory_deducted": doc.get("inventory_deducted", False),
                "inventory_restored": doc.get("inventory_restored", False),
                "inventory_restored_at": doc.get("inventory_restored_at"),
                "inventory_restored_reason": doc.get("inventory_restored_reason"),
            })
        return items

    @staticmethod
    async def get_customer_orders_by_phone(phone: str, limit: int = 30) -> List[dict]:
        """
        Public customer order lookup by phone number (cleans phone format, searches snapshot & customer_id).
        Returns chronological list of customer orders with product pictures, variant info, and live status.
        """
        db = get_database()
        if not phone or len(phone.strip()) < 7:
            return []

        raw_phone = phone.strip()
        clean_ph = raw_phone.replace("+", "").replace(" ", "").replace("-", "")

        # Find customer IDs matching this phone if customer exists
        cust_ids = []
        cust_cursor = db["customers"].find({
            "$or": [
                {"phone": raw_phone},
                {"phone": clean_ph},
                {"phone": f"+{clean_ph}"},
                {"whatsapp_id": clean_ph},
                {"whatsapp_id": raw_phone},
            ]
        }, {"_id": 1})
        async for c in cust_cursor:
            cust_ids.append(str(c["_id"]))

        order_query = {
            "$or": [
                {"address_snapshot.phone": {"$regex": clean_ph[-10:]}},
                {"address_snapshot.phone": raw_phone},
                {"address_snapshot.phone": clean_ph},
                {"address_snapshot.phone": f"+{clean_ph}"},
            ]
        }
        if cust_ids:
            order_query["$or"].append({"customer_id": {"$in": cust_ids}})

        cursor = db["orders"].find(order_query).sort("created_at", -1).limit(limit)
        orders_raw = []
        all_missing_ids = set()

        async for doc in cursor:
            order_items = doc.get("items", [])
            for it in order_items:
                if not it.get("image_url") and it.get("product_id"):
                    pid = it["product_id"]
                    if ObjectId.is_valid(pid):
                        all_missing_ids.add(ObjectId(pid))
            orders_raw.append(doc)

        # Batch resolve missing images
        prod_map = {}
        if all_missing_ids:
            try:
                p_cursor = db["products"].find({"_id": {"$in": list(all_missing_ids)}}, {"image_urls": 1})
                async for p in p_cursor:
                    if p.get("image_urls"):
                        prod_map[str(p["_id"])] = p["image_urls"][0]
            except Exception:
                pass

        default_img = "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=400&q=80"
        items = []
        for doc in orders_raw:
            order_items = doc.get("items", [])
            for it in order_items:
                if not it.get("image_url"):
                    it["image_url"] = prod_map.get(it.get("product_id"), default_img)

            items.append({
                "id": str(doc["_id"]),
                "order_number": doc["order_number"],
                "customer_id": doc["customer_id"],
                "status": doc["status"],
                "items": order_items,
                "subtotal": doc["subtotal"],
                "delivery_fee": doc.get("delivery_fee", 0.0),
                "coupon_code": doc.get("coupon_code"),
                "discount_amount": doc.get("discount_amount", 0.0),
                "total": doc["total"],
                "currency": doc.get("currency", "PKR"),
                "address_snapshot": doc.get("address_snapshot", {}),
                "created_at": doc["created_at"],
                "status_history": doc.get("status_history", []),
                "cancellation_reason": doc.get("cancellation_reason"),
                "return_reason": doc.get("return_reason"),
                "return_details": doc.get("return_details"),
                "return_requested_at": doc.get("return_requested_at"),
                "return_status": doc.get("return_status"),
                "courier_partner": doc.get("courier_partner"),
                "tracking_number": doc.get("tracking_number"),
                "tracking_url": doc.get("tracking_url"),
                "courier_status": doc.get("courier_status"),
                "shipped_at": doc.get("shipped_at"),
                "estimated_delivery": doc.get("estimated_delivery"),
                "parcel_weight_kg": doc.get("parcel_weight_kg", 0.5),
                "courier_booking_id": doc.get("courier_booking_id"),
                "courier_notes": doc.get("courier_notes"),
                "inventory_deducted": doc.get("inventory_deducted", False),
                "inventory_restored": doc.get("inventory_restored", False),
                "inventory_restored_at": doc.get("inventory_restored_at"),
                "inventory_restored_reason": doc.get("inventory_restored_reason"),
            })
        return items

    @staticmethod
    async def dispatch_status_notifications(
        order: dict,
        new_status: str,
        note: Optional[str] = None,
    ):
        """Asynchronously dispatches real-time WhatsApp & Email notifications on order status changes."""
        try:
            db = get_database()
            new_st_upper = str(new_status).upper()
            order_number = order.get("order_number", "")
            currency = order.get("currency", "PKR")
            total = float(order.get("total", 0.0))
            items = order.get("items", [])
            addr_snapshot = order.get("address_snapshot", {}) or {}

            full_name = addr_snapshot.get("full_name") or "Valued Shopper"
            phone = addr_snapshot.get("phone")
            email = addr_snapshot.get("email")
            street_address = addr_snapshot.get("street_address") or ""
            city = addr_snapshot.get("city") or "Pakistan"
            dest_str = f"{street_address}, {city}".strip(", ") or "Pakistan"

            # Fallback customer profile lookup if phone or email was missing in snapshot
            cust_id = order.get("customer_id")
            if cust_id and (not phone or not email or full_name == "Valued Shopper"):
                try:
                    c_q = {"_id": ObjectId(cust_id)} if ObjectId.is_valid(cust_id) else {"_id": cust_id}
                    cust = await db["customers"].find_one(c_q)
                    if cust:
                        phone = phone or cust.get("phone") or cust.get("whatsapp_id")
                        email = email or cust.get("email")
                        if full_name == "Valued Shopper" and cust.get("name"):
                            full_name = cust["name"]
                except Exception:
                    pass

            items_desc = "\n".join([f"• {it.get('quantity', 1)}x {it.get('name', 'Dress')}" for it in items])
            first_img = next((it.get("image_url") for it in items if it.get("image_url")), None)

            # 1. Dispatch Email Notification (if email available)
            if email and "@" in email:
                try:
                    from utils.email_service import email_service
                    items_summary = [
                        {
                            "name": it.get("name", "Dress"),
                            "size": it.get("size") or "Standard",
                            "color": it.get("color") or "Standard",
                            "quantity": it.get("quantity", 1),
                            "unit_price": it.get("unit_price") or it.get("price") or 0.0,
                            "image_url": it.get("image_url"),
                        }
                        for it in items
                    ]
                    asyncio.create_task(
                        email_service.send_order_status_update(
                            recipient_email=email,
                            customer_name=full_name,
                            order_number=order_number,
                            new_status=new_st_upper,
                            total_amount=total,
                            currency=currency,
                            items=items_summary,
                            delivery_address=dest_str,
                            note=note,
                        )
                    )
                except Exception as mail_err:
                    print(f"[WARNING] Failed to queue status update email: {mail_err}")

            # 2. Dispatch WhatsApp Notification (if phone available)
            if phone:
                try:
                    from integrations.whatsapp import whatsapp_client
                    clean_ph = str(phone).replace("+", "").replace(" ", "").replace("-", "")

                    if new_st_upper in ["CONFIRMED", "PROCESSING"]:
                        wa_text = (
                            f"📋 *Order Update: Order #{order_number} Confirmed!* ✨\n\n"
                            f"Assalam-o-Alaikum *{full_name}*,\n"
                            f"Aapka order *#{order_number}* confirm ho chuka hai aur hamari atelier team is waqt aapke items packaging & dispatch ke liye tayyar kar rahi hai.\n\n"
                            f"👗 *Ordered Items:*\n{items_desc}\n\n"
                            f"💵 *Total Payable:* PKR {total:,.2f} (Cash on Delivery)\n"
                            f"📍 *Delivery Destination:* {dest_str}\n\n"
                            f"Jaise hi parcel courier rider ko handover hoga, hum aapko tracking notification bhej dein gay! 🌸🚚"
                        )
                    elif new_st_upper in ["SHIPPED", "IN_TRANSIT"]:
                        courier_p = order.get("courier_partner") or "Express Logistics"
                        tr_no = order.get("tracking_number") or "N/A"
                        tr_url = order.get("tracking_url") or f"https://track.trax.pk/tracking?cn={tr_no}"
                        est_del = order.get("estimated_delivery") or "2-3 working days"
                        wa_text = (
                            f"🚀 *Good News! Order #{order_number} Dispatched!* 📦✨\n\n"
                            f"Assalam-o-Alaikum *{full_name}*,\n"
                            f"Aapka order *#{order_number}* express courier partner *{courier_p}* ke hawale kar diya gaya hai aur delivery ke liye rawanah ho chuka hai! 🚚\n\n"
                            f"👗 *Package Details:*\n{items_desc}\n\n"
                            f"🏷️ *Courier Partner:* {courier_p}\n"
                            f"🔢 *Consignment / Tracking Number:* *{tr_no}*\n"
                            f"🌐 *Live Tracking Link:*\n{tr_url}\n\n"
                            f"💵 *Payable on Delivery:* PKR {total:,.2f} (Cash on Delivery)\n"
                            f"📍 *Delivery Address:* {dest_str}\n"
                            f"⏳ *Estimated Delivery:* {est_del}\n\n"
                            f"📌 *Note:* Rider parcel deliver karne se pehle aapse call par rabta karega. Baraye meharbani apna phone active rakhein! 📞✨"
                        )
                    elif new_st_upper == "OUT_FOR_DELIVERY":
                        courier_p = order.get("courier_partner") or "Express Logistics"
                        tr_no = order.get("tracking_number") or "N/A"
                        wa_text = (
                            f"🛵 *Your Parcel is Out for Delivery Today!* 📦✨\n\n"
                            f"Assalam-o-Alaikum *{full_name}*,\n"
                            f"Aapka order *#{order_number}* ({courier_p}) aaj aapke delivery address par deliver karne ke liye rider ke hawale kar diya gaya hai! 🚚\n\n"
                            f"💵 *Amount to Pay Rider:* PKR {total:,.2f} (Cash on Delivery)\n"
                            f"📍 *Destination:* {dest_str}\n"
                            f"🔢 *Tracking #:* {tr_no}\n\n"
                            f"Baraye meharbani apna phone active rakhein taake rider asani se aapse rabta kar sakay! 🌸📞"
                        )
                    elif new_st_upper == "DELIVERED":
                        wa_text = (
                            f"🎉 *Order Delivered Successfully!* 🌸✨\n\n"
                            f"Assalam-o-Alaikum *{full_name}*,\n"
                            f"Hamare courier partner ne aapka order *#{order_number}* kamyabi se deliver kar diya hai.\n\n"
                            f"Luxe Atelier par shopping karne ka bohat shukriya! ❤️\n"
                            f"Umeed hai aapko hamara outfit pasand aya hoga.\n\n"
                            f"🛡️ *14-Day Hassle-Free Exchange:*\n"
                            f"Agar aapko size, color ya replacement ke hawalay se koi madad chahiye toh 14 dino ke andar hum se WhatsApp par rabta karein. 👗🛍️"
                        )
                    elif new_st_upper == "CANCELLED":
                        wa_text = (
                            f"❌ *Order Cancellation Notice: #{order_number}*\n\n"
                            f"Assalam-o-Alaikum *{full_name}*,\n"
                            f"Aapka order *#{order_number}* cancel kar diya gaya hai.\n\n"
                            f"Aapke account par koi charges deduct nahi kiye gaye hain. "
                            f"Agar aapne yeh cancellation request nahi ki thi ya koi misunderstanding hui hai, "
                            f"toh baraye meharbani foran hum se yahan WhatsApp par rabta karein. 🌸🤝"
                        )
                    else:
                        wa_text = (
                            f"📦 *Order Status Update: #{order_number}*\n\n"
                            f"Assalam-o-Alaikum *{full_name}*,\n"
                            f"Aapke order ka status update ho kar *{new_st_upper}* ho gaya hai.\n"
                            f"Details: {note or 'Processing by atelier.'} 🌸"
                        )

                    async def _send_wa_update():
                        clean_ph = normalize_pakistan_phone(phone)
                        try:
                            sent_ok = False
                            if new_st_upper == "SHIPPED" and first_img and str(first_img).startswith("http"):
                                try:
                                    await whatsapp_client.send_image_message(clean_ph, first_img, caption=wa_text[:1000])
                                    sent_ok = True
                                except Exception as img_e:
                                    print(f"[WARNING] Status image dispatch failed ({img_e}), falling back to text...")
                            if not sent_ok:
                                await whatsapp_client.send_text_message(clean_ph, wa_text)
                            print(f"[INFO] WhatsApp status update dispatched to {clean_ph} for #{order_number} ({new_st_upper})")
                        except Exception as e:
                            print(f"[WARNING] Could not dispatch WhatsApp status notification to {clean_ph}: {e}")

                        # In-app conversation & message sync
                        try:
                            now = datetime.now(timezone.utc)
                            conv = await db["conversations"].find_one({
                                "$or": [
                                    {"customer_id": order.get("customer_id")},
                                    {"customer_phone": clean_ph},
                                    {"customer_phone": phone},
                                ]
                            })
                            if conv:
                                await db["messages"].insert_one({
                                    "conversation_id": str(conv["_id"]),
                                    "direction": "OUTBOUND",
                                    "sender": "SYSTEM",
                                    "sender_name": "Luxe Order Bot",
                                    "message_type": "text",
                                    "content": wa_text,
                                    "delivery_status": "SENT",
                                    "created_at": now,
                                    "metadata": {
                                        "order_number": order_number,
                                        "status": new_st_upper,
                                        "channel": "status_update"
                                    }
                                })
                                await db["conversations"].update_one(
                                    {"_id": conv["_id"]},
                                    {"$set": {
                                        "last_message": f"Order #{order_number} -> {new_st_upper}",
                                        "last_message_at": now,
                                        "updated_at": now,
                                    }}
                                )
                        except Exception as sync_e:
                            print(f"[WARNING] Status update chat sync failed: {sync_e}")

                    asyncio.create_task(_send_wa_update())
                except Exception as wa_err:
                    print(f"[WARNING] Failed to queue WhatsApp status notification: {wa_err}")

        except Exception as top_err:
            print(f"[ERROR] Error in dispatch_status_notifications: {top_err}")

    @staticmethod
    async def update_status(order_id: str, update_in: OrderUpdateStatus, actor_user_id: Optional[str] = None) -> dict:
        db = get_database()
        if not ObjectId.is_valid(order_id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid order ID")

        order = await db["orders"].find_one({"_id": ObjectId(order_id)})
        if not order:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

        current_status = str(order.get("status", "")).upper()
        target_status = str(update_in.status.value if hasattr(update_in.status, "value") else update_in.status).upper()

        # 1. Enforce business rule: cannot cancel order if already SHIPPED or DELIVERED!
        if target_status == "CANCELLED" and current_status in ["SHIPPED", "DELIVERED"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Order #{order.get('order_number')} has already been {current_status} and cannot be cancelled. Standard replacement/return policy applies.",
            )

        now = datetime.now(timezone.utc)

        # 2. Inventory Restock / Re-deduct Lifecycle Management
        if target_status in ["CANCELLED", "RETURNED"]:
            await OrderController.restore_order_inventory(
                order_id_or_num=str(order["_id"]),
                reason=f"Status changed to {target_status}: {update_in.note or ''}",
            )
        elif current_status in ["CANCELLED", "RETURNED"] and target_status not in ["CANCELLED", "RETURNED"]:
            # If an order is un-cancelled or re-activated after having been restocked, re-deduct
            if order.get("inventory_restored"):
                items_to_deduct = order.get("items", [])
                await OrderController._resolve_and_deduct_inventory(db, items_to_deduct)
                await db["orders"].update_one(
                    {"_id": ObjectId(order_id)},
                    {"$set": {"inventory_restored": False, "inventory_deducted": True}}
                )

        history_entry = {
            "status": update_in.status.value,
            "timestamp": now,
            "note": update_in.note or f"Status changed to {update_in.status.value}",
        }

        await db["orders"].update_one(
            {"_id": ObjectId(order_id)},
            {
                "$set": {"status": update_in.status.value},
                "$push": {"status_history": history_entry},
            },
        )

        # Audit log
        await db["audit_logs"].insert_one({
            "actor_user_id": actor_user_id,
            "action": "ORDER_STATUS_UPDATE",
            "entity_type": "orders",
            "entity_id": order_id,
            "created_at": now,
            "metadata": {
                "order_number": order["order_number"],
                "old_status": current_status,
                "new_status": target_status,
            },
        })

        # 2. Dispatch Automated Email & WhatsApp Notifications if status changed
        if current_status != target_status:
            asyncio.create_task(
                OrderController.dispatch_status_notifications(
                    order=order,
                    new_status=target_status,
                    note=update_in.note,
                )
            )

        return await OrderController.get_order(order_id)

    @staticmethod
    async def cancel_customer_order(order_id_or_number: str, phone: str, reason: str) -> dict:
        """Allow customer to cancel a PENDING order with automatic inventory replenishment."""
        db = get_database()
        if not order_id_or_number or not phone:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Order reference and phone required")

        q = {"_id": ObjectId(order_id_or_number)} if ObjectId.is_valid(order_id_or_number) else {"order_number": order_id_or_number}
        order = await db["orders"].find_one(q)
        if not order:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

        order_phone = (order.get("address_snapshot", {}).get("phone") or "").replace("+", "").replace(" ", "").replace("-", "")
        clean_in_phone = phone.replace("+", "").replace(" ", "").replace("-", "")
        if clean_in_phone[-10:] not in order_phone and order_phone[-10:] not in clean_in_phone:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Phone number does not match this order.")

        curr_st = str(order.get("status", "")).upper()
        if curr_st not in ["PENDING", "CONFIRMED"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Order #{order.get('order_number')} is currently '{curr_st}' and cannot be self-cancelled. Please contact boutique support.",
            )

        now = datetime.now(timezone.utc)
        clean_reason = reason.strip() or "Cancelled by customer via My Orders"

        await OrderController.restore_order_inventory(
            order_id_or_num=str(order["_id"]),
            reason=f"Customer cancelled: {clean_reason}",
        )

        history_entry = {
            "status": "CANCELLED",
            "timestamp": now,
            "note": f"Cancelled by customer: {clean_reason}",
        }

        await db["orders"].update_one(
            {"_id": order["_id"]},
            {
                "$set": {
                    "status": "CANCELLED",
                    "cancellation_reason": clean_reason,
                    "updated_at": now,
                },
                "$push": {"status_history": history_entry},
            },
        )

        asyncio.create_task(
            OrderController.dispatch_status_notifications(
                order=order,
                new_status="CANCELLED",
                note=clean_reason,
            )
        )

        return await OrderController.get_order(str(order["_id"]))

    @staticmethod
    async def request_order_return(order_id_or_number: str, phone: str, reason: str, details: Optional[str] = None) -> dict:
        """Allow customer to request a 7-day return / exchange on DELIVERED orders."""
        db = get_database()
        q = {"_id": ObjectId(order_id_or_number)} if ObjectId.is_valid(order_id_or_number) else {"order_number": order_id_or_number}
        order = await db["orders"].find_one(q)
        if not order:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

        order_phone = (order.get("address_snapshot", {}).get("phone") or "").replace("+", "").replace(" ", "").replace("-", "")
        clean_in_phone = phone.replace("+", "").replace(" ", "").replace("-", "")
        if clean_in_phone[-10:] not in order_phone and order_phone[-10:] not in clean_in_phone:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Phone number does not match this order.")

        curr_st = str(order.get("status", "")).upper()
        if curr_st != "DELIVERED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Returns can only be requested for DELIVERED orders (Current status: {curr_st}).",
            )

        if order.get("return_status") == "REQUESTED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A return request is already under review by our boutique atelier team.",
            )

        now = datetime.now(timezone.utc)
        clean_reason = reason.strip() or "Customer requested 7-Day Return / Exchange"

        history_entry = {
            "status": "DELIVERED",
            "timestamp": now,
            "note": f"Return/Exchange requested: {clean_reason} ({details or ''})",
        }

        await db["orders"].update_one(
            {"_id": order["_id"]},
            {
                "$set": {
                    "return_status": "REQUESTED",
                    "return_reason": clean_reason,
                    "return_details": details.strip() if details else None,
                    "return_requested_at": now,
                    "updated_at": now,
                },
                "$push": {"status_history": history_entry},
            },
        )

        return await OrderController.get_order(str(order["_id"]))

    @staticmethod
    async def review_order_return(order_id: str, approve: bool, note: Optional[str] = None, actor_user_id: Optional[str] = None) -> dict:
        """Staff review of customer return request."""
        db = get_database()
        if not ObjectId.is_valid(order_id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid order ID")
        order = await db["orders"].find_one({"_id": ObjectId(order_id)})
        if not order:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

        now = datetime.now(timezone.utc)
        if approve:
            await OrderController.restore_order_inventory(
                order_id_or_num=str(order["_id"]),
                reason=f"Return Approved by Staff: {note or 'Customer return accepted'}",
            )
            history_entry = {
                "status": "RETURNED",
                "timestamp": now,
                "note": f"Return approved by staff: {note or 'Stock replenished'}",
            }
            await db["orders"].update_one(
                {"_id": order["_id"]},
                {
                    "$set": {
                        "status": "RETURNED",
                        "return_status": "APPROVED",
                        "updated_at": now,
                    },
                    "$push": {"status_history": history_entry},
                },
            )
        else:
            history_entry = {
                "status": str(order.get("status", "DELIVERED")),
                "timestamp": now,
                "note": f"Return request rejected: {note or 'Does not meet return criteria'}",
            }
            await db["orders"].update_one(
                {"_id": order["_id"]},
                {
                    "$set": {
                        "return_status": "REJECTED",
                        "updated_at": now,
                    },
                    "$push": {"status_history": history_entry},
                },
            )

        return await OrderController.get_order(order_id)

    @staticmethod
    async def resend_order_confirmation(identifier: str) -> dict:
        """
        Manually or programmatically triggers re-dispatch of both WhatsApp and Email
        order confirmations for an existing order.
        """
        db = get_database()
        query = {"order_number": identifier}
        if ObjectId.is_valid(identifier):
            query = {"$or": [{"_id": ObjectId(identifier)}, {"order_number": identifier}]}

        order = await db["orders"].find_one(query)
        if not order:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

        addr = order.get("address_snapshot") or {}
        full_name = addr.get("full_name") or "Valued Customer"
        phone = addr.get("phone") or ""
        email = addr.get("email") or ""
        order_number = order.get("order_number")
        total = order.get("total", 0.0)
        dest_str = f"{addr.get('street_address', '')}, {addr.get('city', '')}"
        items = order.get("items") or []

        results = {"order_number": order_number, "whatsapp": "SKIPPED", "email": "SKIPPED"}

        # 1. Email re-dispatch
        if email:
            try:
                from utils.email_service import email_service
                items_summary = [
                    {
                        "name": it.get("name"),
                        "size": it.get("size") or "Standard",
                        "color": it.get("color") or "Standard",
                        "quantity": it.get("quantity", 1),
                        "unit_price": it.get("unit_price") or it.get("price", 0.0),
                        "image_url": it.get("image_url"),
                    }
                    for it in items
                ]
                await email_service.send_order_confirmation(
                    recipient_email=email,
                    customer_name=full_name,
                    order_number=order_number,
                    total_amount=total,
                    currency=order.get("currency", "PKR"),
                    items=items_summary,
                    delivery_address=dest_str,
                )
                results["email"] = f"DISPATCHED to {email}"
            except Exception as e:
                results["email"] = f"FAILED: {e}"

        # 2. WhatsApp re-dispatch
        if phone:
            clean_ph = normalize_pakistan_phone(phone)
            try:
                from integrations.whatsapp import whatsapp_client
                items_desc = "\n".join([
                    f"• {it.get('quantity', 1)}x {it.get('name')}" +
                    (f" (Color: {it.get('color')})" if it.get("color") and it.get("color") != "Standard" else "") +
                    (f" (Size: {it.get('size')})" if it.get("size") and it.get("size") != "Standard" else "")
                    for it in items
                ])
                first_img = next((it.get("image_url") for it in items if it.get("image_url")), None)
                wa_confirm_msg = (
                    f"🎉 *Mubarak {full_name}! Your order has been placed successfully!* ✨\n\n"
                    f"📦 *Order ID / Number:* *#{order_number}*\n"
                    f"👗 *Items:*\n{items_desc}\n"
                    f"🏷️ *Total Payable:* PKR {total:.2f} (Free Express Delivery 🚚)\n"
                    f"📍 *Delivery Destination:* {dest_str}\n"
                    f"💵 *Payment Method:* Cash on Delivery (COD)\n\n"
                    f"Our atelier team is already preparing your package for courier dispatch! "
                    f"You can track your order anytime with ID *#{order_number}*. 📦👗"
                )

                sent_ok = False
                res_wa = None
                if first_img and str(first_img).startswith("http"):
                    try:
                        res_wa = await whatsapp_client.send_image_message(clean_ph, first_img, caption=wa_confirm_msg[:1000])
                        sent_ok = True
                    except Exception as img_err:
                        print(f"[WARNING] Resend WhatsApp image failed ({img_err}), falling back to text...")
                
                if not sent_ok:
                    res_wa = await whatsapp_client.send_text_message(clean_ph, wa_confirm_msg)
                
                wamid = (res_wa.get("messages", [{}])[0].get("id")) if res_wa and isinstance(res_wa, dict) else None
                results["whatsapp"] = f"DISPATCHED to {clean_ph} (wamid: {wamid})"
            except Exception as e:
                wamid = None
                results["whatsapp"] = f"FAILED: {e}"

            # In-app conversation & message sync (ALWAYS executes)
            try:
                now = datetime.now(timezone.utc)
                conv = await db["conversations"].find_one({
                    "$or": [
                        {"customer_id": order.get("customer_id")},
                        {"customer_phone": clean_ph},
                        {"customer_phone": phone},
                    ]
                })
                conv_id = None
                if conv:
                    conv_id = str(conv["_id"])
                else:
                    c_ins = await db["conversations"].insert_one({
                        "customer_id": order.get("customer_id"),
                        "customer_phone": clean_ph,
                        "customer_name": full_name,
                        "channel": "whatsapp",
                        "status": "AI_ACTIVE",
                        "unread_count": 0,
                        "last_message": f"Order #{order_number} confirmation",
                        "last_message_at": now,
                        "created_at": now,
                        "updated_at": now,
                    })
                    conv_id = str(c_ins.inserted_id)

                await db["messages"].insert_one({
                    "conversation_id": conv_id,
                    "external_message_id": wamid,
                    "direction": "OUTBOUND",
                    "sender": "SYSTEM",
                    "sender_name": "Luxe Order Bot",
                    "message_type": "text",
                    "content": wa_confirm_msg,
                    "image_url": first_img if (first_img and str(first_img).startswith("http")) else None,
                    "delivery_status": "SENT" if "DISPATCHED" in results.get("whatsapp", "") else "FAILED_EXTERNAL",
                    "created_at": now,
                    "metadata": {"order_number": order_number, "action": "resend_confirmation"}
                })
                await db["conversations"].update_one(
                    {"_id": ObjectId(conv_id)},
                    {"$set": {
                        "last_message": f"Order #{order_number} Placed (PKR {total:.2f})",
                        "last_message_at": now,
                        "updated_at": now,
                    }}
                )
            except Exception as sync_err:
                print(f"[WARNING] Failed to sync order confirmation to conversation history: {sync_err}")

        return results


order_controller = OrderController()

