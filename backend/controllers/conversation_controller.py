from datetime import datetime, timezone
from typing import List, Optional
from bson import ObjectId
from fastapi import HTTPException, status
from db.mongodb import get_database
from integrations.whatsapp import whatsapp_client
from models.conversation_model import ConversationChannel, ConversationCreate, ConversationModel, ConversationStatus
from models.message_model import DeliveryStatus, MessageCreate, MessageDirection, MessageModel


class ConversationController:
    """Business logic for Customer Conversations and Chat Messaging."""

    @staticmethod
    async def get_or_create_conversation(customer_id: str, channel: ConversationChannel = ConversationChannel.WHATSAPP) -> dict:
        db = get_database()
        active = await db["conversations"].find_one({
            "customer_id": customer_id,
            "status": {"$in": [ConversationStatus.ACTIVE.value, ConversationStatus.WAITING_HUMAN.value]},
        })
        if active:
            return {
                "id": str(active["_id"]),
                "customer_id": active["customer_id"],
                "channel": active.get("channel", channel.value),
                "status": active["status"],
                "assigned_user_id": active.get("assigned_user_id"),
                "last_message_at": active.get("last_message_at"),
                "created_at": active["created_at"],
            }

        now = datetime.now(timezone.utc)
        doc = ConversationModel(
            customer_id=customer_id,
            channel=channel,
            status=ConversationStatus.ACTIVE,
            last_message_at=now,
            created_at=now,
        ).model_dump(by_alias=True, exclude={"id"})

        res = await db["conversations"].insert_one(doc)
        return {
            "id": str(res.inserted_id),
            "customer_id": customer_id,
            "channel": channel.value,
            "status": ConversationStatus.ACTIVE.value,
            "assigned_user_id": None,
            "last_message_at": now,
            "created_at": now,
        }

    @staticmethod
    async def list_conversations(status_filter: Optional[ConversationStatus] = None, limit: int = 50, skip: int = 0) -> List[dict]:
        db = get_database()
        query = {}
        if status_filter:
            query["status"] = status_filter.value

        cursor = db["conversations"].find(query).sort("last_message_at", -1).skip(skip).limit(limit)
        items = []
        async for doc in cursor:
            cust_id = doc.get("customer_id")
            if not cust_id:
                continue

            customer = None
            if ObjectId.is_valid(str(cust_id)):
                customer = await db["customers"].find_one({"_id": ObjectId(str(cust_id))})
            if not customer:
                customer = await db["customers"].find_one({"_id": str(cust_id)})

            # Get latest message snippet
            last_msg = await db["messages"].find_one(
                {"conversation_id": str(doc["_id"])},
                sort=[("created_at", -1)]
            )

            status_val = doc.get("status", "ACTIVE")
            if status_val not in [s.value for s in ConversationStatus]:
                status_val = (
                    ConversationStatus.WAITING_HUMAN.value
                    if status_val in ["OPEN", "WAITING_HUMAN"]
                    else ConversationStatus.ACTIVE.value
                )

            channel_val = doc.get("channel", "whatsapp")
            if channel_val not in [c.value for c in ConversationChannel]:
                channel_val = ConversationChannel.WHATSAPP.value

            items.append({
                "id": str(doc["_id"]),
                "customer_id": str(cust_id),
                "customer_name": customer.get("name") if customer else None,
                "customer_phone": customer.get("phone") or customer.get("whatsapp_id") if customer else None,
                "customer_address": customer.get("address") if customer else None,
                "customer_city": customer.get("city") if customer else None,
                "customer_email": customer.get("email") if customer else None,
                "active_product_id": doc.get("active_product_id"),
                "active_product_name": doc.get("active_product_name"),
                "last_message_text": last_msg.get("text") if last_msg else None,
                "channel": channel_val,
                "status": status_val,
                "assigned_user_id": doc.get("assigned_user_id"),
                "last_message_at": doc.get("last_message_at") or doc.get("created_at") or datetime.now(timezone.utc),
                "created_at": doc.get("created_at") or datetime.now(timezone.utc),
            })
        return items

    @staticmethod
    async def get_messages(conversation_id: str, limit: int = 100) -> List[dict]:
        db = get_database()
        cursor = db["messages"].find({"conversation_id": conversation_id}).sort("created_at", 1).limit(limit)
        messages = []
        async for m in cursor:
            messages.append({
                "id": str(m["_id"]),
                "conversation_id": m["conversation_id"],
                "external_message_id": m.get("external_message_id"),
                "direction": m["direction"],
                "text": m["text"],
                "image_url": m.get("image_url"),
                "intent": m.get("intent"),
                "confidence": m.get("confidence"),
                "delivery_status": m.get("delivery_status", "received"),
                "created_at": m["created_at"],
            })
        return messages

    @staticmethod
    async def send_agent_message(conversation_id: str, text: str, image_url: Optional[str] = None) -> dict:
        db = get_database()
        if not ObjectId.is_valid(conversation_id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid conversation ID")

        conv = await db["conversations"].find_one({"_id": ObjectId(conversation_id)})
        if not conv:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

        # Get customer phone
        cust_id = conv.get("customer_id")
        customer = None
        if cust_id:
            if ObjectId.is_valid(str(cust_id)):
                customer = await db["customers"].find_one({"_id": ObjectId(str(cust_id))})
            if not customer:
                customer = await db["customers"].find_one({"_id": str(cust_id)})

        # Dispatch message via WhatsApp
        external_id = None
        target_phone = customer.get("whatsapp_id") or customer.get("phone") if customer else None
        if target_phone:
            import re
            clean_wa = re.sub(r'[^0-9]', '', str(target_phone))
            if clean_wa.startswith('0'):
                clean_wa = '92' + clean_wa[1:]
            try:
                if image_url:
                    wa_res = await whatsapp_client.send_image_message(clean_wa, image_url, caption=text[:1000] if text else None)
                else:
                    wa_res = await whatsapp_client.send_text_message(clean_wa, text)
                messages_arr = wa_res.get("messages", [])
                if messages_arr:
                    external_id = messages_arr[0].get("id")
            except Exception as e:
                print(f"[ERROR] Failed to send WhatsApp outbound message: {e}")

        now = datetime.now(timezone.utc)
        msg_doc = MessageModel(
            conversation_id=conversation_id,
            external_message_id=external_id,
            direction=MessageDirection.OUTBOUND,
            text=text,
            image_url=image_url,
            delivery_status=DeliveryStatus.SENT,
            created_at=now,
        ).model_dump(by_alias=True, exclude={"id"})

        res = await db["messages"].insert_one(msg_doc)

        # Update last_message_at on conversation
        await db["conversations"].update_one(
            {"_id": ObjectId(conversation_id)},
            {"$set": {"last_message_at": now}},
        )

        return {
            "id": str(res.inserted_id),
            "conversation_id": conversation_id,
            "external_message_id": external_id,
            "direction": MessageDirection.OUTBOUND.value,
            "text": text,
            "delivery_status": DeliveryStatus.SENT.value,
            "created_at": now,
        }

    @staticmethod
    async def assign_agent(conversation_id: str, user_id: str) -> dict:
        db = get_database()
        if not ObjectId.is_valid(conversation_id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid conversation ID")

        is_ai = not user_id or str(user_id).strip().upper() in ["AI_BOT", "AI", "NONE", "NULL", ""]
        new_status = (
            ConversationStatus.ACTIVE.value
            if is_ai
            else ConversationStatus.WAITING_HUMAN.value
        )
        assigned_val = None if is_ai else user_id

        now = datetime.now(timezone.utc)
        await db["conversations"].update_one(
            {"_id": ObjectId(conversation_id)},
            {"$set": {"assigned_user_id": assigned_val, "status": new_status, "last_message_at": now}},
        )
        doc = await db["conversations"].find_one({"_id": ObjectId(conversation_id)})
        cust_id = doc.get("customer_id")
        customer = None
        if cust_id:
            if ObjectId.is_valid(str(cust_id)):
                customer = await db["customers"].find_one({"_id": ObjectId(str(cust_id))})
            if not customer:
                customer = await db["customers"].find_one({"_id": str(cust_id)})

        last_msg = await db["messages"].find_one(
            {"conversation_id": str(doc["_id"])},
            sort=[("created_at", -1)]
        )

        status_val = doc.get("status", "ACTIVE")
        if status_val not in [s.value for s in ConversationStatus]:
            status_val = ConversationStatus.WAITING_HUMAN.value

        channel_val = doc.get("channel", "whatsapp")
        if channel_val not in [c.value for c in ConversationChannel]:
            channel_val = ConversationChannel.WHATSAPP.value

        return {
            "id": str(doc["_id"]),
            "customer_id": str(cust_id) if cust_id else "",
            "customer_name": customer.get("name") if customer else None,
            "customer_phone": customer.get("phone") or customer.get("whatsapp_id") if customer else None,
            "last_message_text": last_msg.get("text") if last_msg else None,
            "channel": channel_val,
            "status": status_val,
            "assigned_user_id": doc.get("assigned_user_id"),
            "last_message_at": doc.get("last_message_at") or doc.get("created_at") or datetime.now(timezone.utc),
            "created_at": doc.get("created_at") or datetime.now(timezone.utc),
        }


conversation_controller = ConversationController()
