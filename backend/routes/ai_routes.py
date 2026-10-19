import asyncio
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from bson import ObjectId
from fastapi import APIRouter, Body, Query
from ai.assistant import fashion_assistant
from ai.intent_model import intent_model
from controllers.conversation_controller import conversation_controller
from controllers.customer_controller import customer_controller
from db.mongodb import get_database
from models.conversation_model import ConversationChannel, ConversationStatus
from models.customer_model import CustomerCreate
from models.message_model import DeliveryStatus, MessageDirection, MessageModel

router = APIRouter(prefix="/ai", tags=["AI & Stylist Assistant"])


def _make_json_safe(obj: Any) -> Any:
    if isinstance(obj, ObjectId):
        return str(obj)
    if isinstance(obj, datetime):
        return obj.isoformat()
    if isinstance(obj, dict):
        return {k: _make_json_safe(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_make_json_safe(i) for i in obj]
    return obj


@router.post("/stylist-chat")
async def chat_with_stylist(
    message: str = Body(..., embed=True, description="Customer message text"),
    phone: Optional[str] = Body(None, embed=True, description="Customer WhatsApp phone number"),
    history: Optional[List[Dict[str, Any]]] = Body(None, embed=True, description="Recent conversation history"),
):
    """Interactive endpoint to chat directly with Aria, with real-time sync into Staff Live Inbox."""
    db = get_database()
    now = datetime.now(timezone.utc)
    clean_phone = (phone or "").strip()
    if not clean_phone:
        clean_phone = "guest_web"

    # 1. Resolve or register customer
    customer = await customer_controller.create_or_get_customer(
        CustomerCreate(whatsapp_id=clean_phone.replace("+", ""), phone=clean_phone)
    )
    customer_id = customer["id"]

    # 2. Get or create active conversation thread (Visible in Staff Live Inbox!)
    conv = await conversation_controller.get_or_create_conversation(
        customer_id=customer_id, channel=ConversationChannel.WEB_CHAT
    )
    conv_id = conv["id"]

    # 3. Check if thread is currently assigned to a human staff agent
    conv_doc = await db["conversations"].find_one({"_id": ObjectId(conv_id)})
    assigned_user_id = conv_doc.get("assigned_user_id") if conv_doc else None

    # Check if user explicitly asked to switch back to AI
    switch_to_ai_kws = ["switch to ai", "talk to ai", "back to ai", "talk to aria", "switch to aria", "bot", "switch to bot", "ai stylist", "restart ai"]
    wants_ai = any(kw in message.lower() for kw in switch_to_ai_kws)

    if wants_ai and assigned_user_id:
        await db["conversations"].update_one(
            {"_id": ObjectId(conv_id)},
            {"$set": {"assigned_user_id": None, "status": ConversationStatus.ACTIVE.value, "last_message_at": now}}
        )
        assigned_user_id = None

    # Detect Intent & Human Staff Handoff Request
    intent, confidence = intent_model.predict(message)
    handoff_keywords = ["agent", "human", "staff", "representative", "person", "operator", "talk to human", "connect with staff"]
    is_handoff = intent == "human_handoff" or any(w in message.lower() for w in handoff_keywords)

    if is_handoff and not assigned_user_id:
        # Mark conversation as WAITING_HUMAN in MongoDB so staff portal alerts immediately
        await db["conversations"].update_one(
            {"_id": ObjectId(conv_id)},
            {"$set": {
                "status": ConversationStatus.WAITING_HUMAN.value,
                "assigned_user_id": None,
                "last_message_at": now,
            }}
        )

    # 4. Save Customer Inbound Message into Messages Collection
    inbound_doc = MessageModel(
        conversation_id=conv_id,
        direction=MessageDirection.INBOUND,
        text=message,
        intent=intent,
        confidence=confidence,
        delivery_status=DeliveryStatus.RECEIVED,
        created_at=now,
    ).model_dump(by_alias=True, exclude={"id"})
    await db["messages"].insert_one(inbound_doc)

    await db["conversations"].update_one(
        {"_id": ObjectId(conv_id)},
        {"$set": {"last_message_at": now}}
    )

    # If assigned to a human staff member, DO NOT call Gemini AI! Transmit directly to staff live inbox.
    if assigned_user_id:
        staff_name = "Senior Boutique Stylist"
        if ObjectId.is_valid(str(assigned_user_id)):
            staff_doc = await db["users"].find_one({"_id": ObjectId(str(assigned_user_id))})
            if staff_doc:
                staff_name = staff_doc.get("name") or staff_doc.get("email") or staff_name

        return {
            "user_message": message,
            "phone": clean_phone,
            "conversation_id": conv_id,
            "stylist_response": f"✨ Your message has been delivered directly to your dedicated stylist, {staff_name}. They are on this chat and replying live!",
            "human_needed": True,
            "is_assigned_to_staff": True,
            "assigned_user_id": str(assigned_user_id),
            "staff_name": staff_name,
            "order_created": False,
            "order": None,
            "product_action": None,
            "image_url": None,
            "relevant_products": [],
            "conversion_nudge": None,
            "active_model": "human-staff-agent",
        }

    # 5. Generate Response via AI Fashion Assistant
    reply = await fashion_assistant.generate_response(
        user_phone=clean_phone,
        user_message=message,
        client_history=history,
        conversation_id=conv_id,
        customer_id=customer_id,
    )

    # 6. Save Outbound Response into Messages Collection
    outbound_doc = MessageModel(
        conversation_id=conv_id,
        direction=MessageDirection.OUTBOUND,
        text=str(reply),
        delivery_status=DeliveryStatus.SENT,
        created_at=datetime.now(timezone.utc),
    ).model_dump(by_alias=True, exclude={"id"})
    await db["messages"].insert_one(outbound_doc)

    # 7. Update conversation last_message_at timestamp
    await db["conversations"].update_one(
        {"_id": ObjectId(conv_id)},
        {"$set": {"last_message_at": datetime.now(timezone.utc)}}
    )

    prod_action = getattr(reply, "product_action", None)
    from config.settings import settings
    if isinstance(prod_action, dict) and prod_action.get("product_id") and not prod_action.get("product_url"):
        prod_action["product_url"] = settings.get_product_url(prod_action["product_id"])

    rel_prods = getattr(reply, "relevant_products", []) or []
    for rp in rel_prods:
        if isinstance(rp, dict) and rp.get("id") and not rp.get("product_url"):
            rp["product_url"] = settings.get_product_url(rp["id"])

    return _make_json_safe({
        "user_message": message,
        "phone": clean_phone,
        "conversation_id": conv_id,
        "stylist_response": str(reply),
        "human_needed": is_handoff,
        "is_assigned_to_staff": False,
        "staff_name": None,
        "order_created": getattr(reply, "order_created", False),
        "order": getattr(reply, "order", None),
        "product_action": prod_action,
        "image_url": None,
        "relevant_products": rel_prods,
        "conversion_nudge": getattr(reply, "conversion_nudge", None),
        "active_model": fashion_assistant._active_model_name or "gemini-3.5-flash-lite",
    })


@router.get("/stylist-chat/sync")
async def sync_stylist_chat(
    phone: Optional[str] = Query(None, description="Customer phone number")
):
    """
    Live bidirectional synchronization for customer web storefront with staff Live Inbox.
    Returns current staff assignment and all conversation messages.
    """
    db = get_database()
    if not phone or not phone.strip() or phone.strip() in ["guest_web", "null", "undefined"]:
        return {
            "conversation_id": None,
            "status": "ACTIVE",
            "is_assigned_to_staff": False,
            "assigned_user_id": None,
            "staff_name": None,
            "messages": [],
        }

    clean_phone = phone.strip()
    raw_wa = clean_phone.replace("+", "").replace(" ", "").replace("-", "")

    customer = await db["customers"].find_one({"$or": [{"phone": clean_phone}, {"whatsapp_id": raw_wa}]})
    if not customer:
        return {
            "conversation_id": None,
            "status": "ACTIVE",
            "is_assigned_to_staff": False,
            "assigned_user_id": None,
            "staff_name": None,
            "messages": [],
        }

    cust_id = str(customer["_id"])
    conv = await db["conversations"].find_one(
        {"customer_id": {"$in": [cust_id, ObjectId(cust_id) if ObjectId.is_valid(cust_id) else cust_id]}},
        sort=[("last_message_at", -1)]
    )
    if not conv:
        return {
            "conversation_id": None,
            "status": "ACTIVE",
            "is_assigned_to_staff": False,
            "assigned_user_id": None,
            "staff_name": None,
            "messages": [],
        }

    conv_id = str(conv["_id"])
    assigned_user_id = conv.get("assigned_user_id")
    conv_status = conv.get("status", "ACTIVE")

    staff_name = None
    if assigned_user_id:
        if ObjectId.is_valid(str(assigned_user_id)):
            staff_doc = await db["users"].find_one({"_id": ObjectId(str(assigned_user_id))})
            if staff_doc:
                staff_name = staff_doc.get("name") or staff_doc.get("email")

    cursor = db["messages"].find({"conversation_id": conv_id}).sort("created_at", 1).limit(60)
    messages = []
    async for m in cursor:
        direction = m.get("direction", "outbound")
        is_inbound = direction in ["inbound", MessageDirection.INBOUND.value]
        # Check if message was sent by assigned staff vs AI
        sender_role = "user" if is_inbound else ("staff" if assigned_user_id else "stylist")
        messages.append({
            "id": str(m["_id"]),
            "sender": sender_role,
            "text": m.get("text", ""),
            "staff_name": staff_name if sender_role == "staff" else "Aria",
            "created_at": m.get("created_at").isoformat() if isinstance(m.get("created_at"), datetime) else str(m.get("created_at")),
        })

    return {
        "conversation_id": conv_id,
        "status": conv_status,
        "is_assigned_to_staff": bool(assigned_user_id),
        "assigned_user_id": str(assigned_user_id) if assigned_user_id else None,
        "staff_name": staff_name or ("Dedicated Stylist" if assigned_user_id else None),
        "messages": messages,
    }


@router.post("/stylist-chat/switch-to-ai")
async def switch_stylist_to_ai(
    phone: Optional[str] = Body(None, embed=True)
):
    """Seamlessly switch customer back to Aria AI Fashion Stylist from Human Staff."""
    db = get_database()
    if not phone or not phone.strip():
        return {"status": "success", "message": "Reconnected to Aria AI Fashion Stylist."}

    clean_phone = phone.strip()
    raw_wa = clean_phone.replace("+", "").replace(" ", "").replace("-", "")
    customer = await db["customers"].find_one({"$or": [{"phone": clean_phone}, {"whatsapp_id": raw_wa}]})
    if customer:
        cust_id = str(customer["_id"])
        await db["conversations"].update_many(
            {"customer_id": {"$in": [cust_id, ObjectId(cust_id) if ObjectId.is_valid(cust_id) else cust_id]}},
            {"$set": {
                "assigned_user_id": None,
                "status": ConversationStatus.ACTIVE.value,
                "last_message_at": datetime.now(timezone.utc)
            }}
        )
    return {"status": "success", "message": "Reconnected to Aria AI Fashion Stylist."}


@router.get("/related-products/{product_id}")
async def get_related_products(
    product_id: str,
    phone: Optional[str] = Query(None, description="Customer phone for personalization"),
    limit: int = Query(3, ge=1, le=8),
):
    """Fetch complementary cross-sell outfits and accessories specifically for a given product."""
    from ai.recommendation_engine import recommendation_engine
    db = get_database()
    return await recommendation_engine.get_relevant_and_cross_sell_products(
        db=db, product_id=product_id, customer_phone=phone, limit=limit
    )


@router.get("/smart-search")
async def smart_search(
    q: str = Query(..., description="Customer search query"),
    phone: Optional[str] = Query(None, description="Customer phone"),
    limit: int = Query(6, ge=1, le=12),
):
    """
    Semantic ML Search + Online Learned Query Weights + Demand Boosts.
    Returns ranked product recommendations and logs search intent into online model.
    """
    from ai.recommendation_engine import recommendation_engine
    from ai.online_learning import online_learning_engine
    db = get_database()
    recs = await recommendation_engine.get_personalized_recommendations(
        db=db, user_message=q, customer_phone=phone, limit=limit
    )
    # Log search interaction into online learning engine
    if recs:
        matched_ids = [r["id"] for r in recs[:3]]
        asyncio.create_task(
            online_learning_engine.record_interaction(
                db=db,
                event_type="search_view",
                product_id=matched_ids[0] if matched_ids else None,
                related_product_ids=matched_ids[1:] if len(matched_ids) > 1 else None,
                search_query=q,
                customer_phone=phone,
            )
        )
    return recs


@router.post("/log-interaction")
async def log_customer_interaction(
    event_type: str = Body(..., description="search_view, view_details, stylist_inquiry, add_to_cart, order_purchased"),
    product_id: Optional[str] = Body(None),
    related_product_ids: Optional[List[str]] = Body(None),
    search_query: Optional[str] = Body(None),
    phone: Optional[str] = Body(None),
    customer_id: Optional[str] = Body(None),
):
    """
    Record real-time user feedback signals (clicks, views, cart adds)
    to continuously train and adjust the ML recommender weights.
    """
    from ai.online_learning import online_learning_engine
    db = get_database()
    return await online_learning_engine.record_interaction(
        db=db,
        event_type=event_type,
        product_id=product_id,
        related_product_ids=related_product_ids,
        search_query=search_query,
        customer_phone=phone,
        customer_id=customer_id,
    )


@router.post("/train-online")
async def trigger_online_training_cycle():
    """
    Reconcile real-time interaction feedback weights, normalize affinity scores,
    and update ML model training metrics in the registry.
    """
    from ai.online_learning import online_learning_engine
    db = get_database()
    return await online_learning_engine.run_batch_training_cycle(db)
