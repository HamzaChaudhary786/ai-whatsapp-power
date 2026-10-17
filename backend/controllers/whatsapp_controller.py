import asyncio
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from bson import ObjectId
from fastapi import BackgroundTasks, HTTPException, Request, Response, status
from ai.assistant import fashion_assistant
from ai.intent_model import intent_model
from controllers.conversation_controller import conversation_controller
from controllers.customer_controller import customer_controller
from db.mongodb import get_database
from integrations.whatsapp import whatsapp_client
from models.customer_model import CustomerCreate
from models.message_model import DeliveryStatus, MessageDirection, MessageModel
from models.webhook_event_model import WebhookProcessingStatus


class WhatsAppController:
    """Production Controller for WhatsApp Cloud API with Fast Acknowledgment & Delivery Tracking."""

    @staticmethod
    def verify_webhook(mode: Optional[str], token: Optional[str], challenge: Optional[str]) -> Response:
        """GET Endpoint: Meta Webhook Subscription Verification."""
        verified_challenge = whatsapp_client.verify_webhook(mode, token, challenge)
        if verified_challenge:
            print("[INFO] Meta Webhook verified successfully!")
            return Response(content=verified_challenge, media_type="text/plain", status_code=200)
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Verification token mismatch")

    @classmethod
    async def handle_incoming_webhook(cls, request: Request, background_tasks: BackgroundTasks) -> dict:
        """POST Endpoint: Fast Acknowledgment with Signature Validation and Async Dispatch."""
        raw_body = await request.body()
        sig_header = request.headers.get("X-Hub-Signature-256")

        # 1. Signature Validation (HMAC-SHA256)
        if not whatsapp_client.validate_signature(raw_body, sig_header):
            print("[WARNING] Webhook signature verification failed! Rejecting payload.")
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid signature")

        try:
            payload = await request.json()
        except Exception:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON payload")

        # 2. Fast Acknowledgment: Schedule execution in background task (< 200ms response to Meta)
        background_tasks.add_task(cls._process_webhook_payload, payload)
        return {"status": "ok"}

    @classmethod
    async def _process_webhook_payload(cls, payload: Dict[str, Any]) -> None:
        """Asynchronous execution worker for Webhook Events."""
        db = get_database()
        entries = payload.get("entry", [])

        for entry in entries:
            for change in entry.get("changes", []):
                value = change.get("value", {})

                # Process A: Delivery Status Updates (sent, delivered, read, failed)
                statuses = value.get("statuses", [])
                for st in statuses:
                    await cls._handle_delivery_status(db, st)

                # Process B: Incoming User Messages
                messages = value.get("messages", [])
                for msg in messages:
                    await cls._handle_incoming_message(db, msg)

    @classmethod
    async def _handle_delivery_status(cls, db: Any, st: Dict[str, Any]) -> None:
        """Update message delivery status in database."""
        wamid = st.get("id")
        status_name = st.get("status")  # sent, delivered, read, failed
        recipient_id = st.get("recipient_id")

        if not wamid or not status_name:
            return

        print(f"[INFO] WhatsApp Delivery Status Update: {wamid} -> {status_name}")

        status_mapping = {
            "sent": DeliveryStatus.SENT,
            "delivered": DeliveryStatus.DELIVERED,
            "read": DeliveryStatus.READ,
            "failed": DeliveryStatus.FAILED,
        }

        mapped_status = status_mapping.get(status_name)
        if mapped_status:
            update_data: Dict[str, Any] = {"delivery_status": mapped_status.value}
            if status_name == "failed":
                errors = st.get("errors", [])
                update_data["last_error"] = str(errors)

            await db["messages"].update_one(
                {"external_message_id": wamid},
                {"$set": update_data},
            )

    @classmethod
    async def _handle_incoming_message(cls, db: Any, msg: Dict[str, Any]) -> None:
        """Deduplicate, process intent, and respond to incoming customer messages."""
        msg_id = msg.get("id")
        sender = msg.get("from")
        msg_type = msg.get("type")

        if not msg_id or not sender:
            return

        # 1. Event Deduplication via webhook_events
        existing_evt = await db["webhook_events"].find_one({"provider_event_id": msg_id})
        if existing_evt and existing_evt.get("processing_status") in [
            WebhookProcessingStatus.COMPLETED.value,
            WebhookProcessingStatus.PROCESSING.value,
        ]:
            print(f"[INFO] Deduplicated already processed message event: {msg_id}")
            return

        now = datetime.now(timezone.utc)
        await db["webhook_events"].update_one(
            {"provider_event_id": msg_id},
            {
                "$setOnInsert": {"received_at": now, "payload": msg},
                "$set": {"processing_status": WebhookProcessingStatus.PROCESSING.value},
                "$inc": {"attempts": 1},
            },
            upsert=True,
        )

        try:
            # 2. Mark as read immediately (Polite UX)
            try:
                await whatsapp_client.mark_as_read(msg_id)
            except Exception as read_err:
                print(f"[WARNING] Could not mark message as read: {read_err}")

            # Extract user text or interactive button selection
            user_text = ""
            if msg_type == "text":
                user_text = msg.get("text", {}).get("body", "")
            elif msg_type == "interactive":
                interactive = msg.get("interactive", {})
                if interactive.get("type") == "button_reply":
                    user_text = interactive.get("button_reply", {}).get("title", "")
                elif interactive.get("type") == "list_reply":
                    user_text = interactive.get("list_reply", {}).get("title", "")
            else:
                user_text = f"[{msg_type} attachment received]"

            # 3. Create or Fetch Customer
            customer = await customer_controller.create_or_get_customer(CustomerCreate(whatsapp_id=sender))
            customer_id = customer["id"]

            # 4. Create or Fetch Active Conversation Thread
            conversation = await conversation_controller.get_or_create_conversation(customer_id)
            conv_id = conversation["id"]

            # 5. Predict User Intent with ML Model
            intent, confidence = intent_model.predict(user_text)

            # 6. Save Inbound Message
            inbound_doc = MessageModel(
                conversation_id=conv_id,
                external_message_id=msg_id,
                direction=MessageDirection.INBOUND,
                text=user_text,
                intent=intent,
                confidence=confidence,
                delivery_status=DeliveryStatus.RECEIVED,
                created_at=now,
            ).model_dump(by_alias=True, exclude={"id"})
            await db["messages"].insert_one(inbound_doc)

            # Continuous Online Learning: Track WhatsApp customer inquiry
            try:
                from ai.online_learning import online_learning_engine
                asyncio.create_task(
                    online_learning_engine.record_interaction(
                        db=db,
                        event_type="whatsapp_inquiry",
                        search_query=user_text,
                        customer_phone=sender,
                        customer_id=customer_id,
                    )
                )
            except Exception:
                pass

            # Check if conversation is currently assigned to human staff
            conv_doc = await db["conversations"].find_one({"_id": ObjectId(conv_id)})
            assigned_user_id = conv_doc.get("assigned_user_id") if conv_doc else None

            # Check if user specifically requested switching back to AI
            switch_to_ai_kws = ["switch to ai", "talk to ai", "back to ai", "talk to aria", "switch to aria", "bot", "switch to bot", "ai stylist", "restart ai"]
            wants_ai = any(kw in user_text.lower() for kw in switch_to_ai_kws)

            if wants_ai and assigned_user_id:
                await db["conversations"].update_one(
                    {"_id": ObjectId(conv_id)},
                    {"$set": {"assigned_user_id": None, "status": "ACTIVE", "last_message_at": now}}
                )
                assigned_user_id = None

            # If assigned to human staff and customer didn't ask for AI, do NOT auto-reply with AI
            if assigned_user_id:
                await db["conversations"].update_one(
                    {"_id": ObjectId(conv_id)},
                    {"$set": {"last_message_at": now}}
                )
                print(f"[INFO] Conversation {conv_id} is assigned to staff {assigned_user_id}. Inbound message queued for human staff live response.")
                await db["webhook_events"].update_one(
                    {"provider_event_id": msg_id},
                    {"$set": {"processing_status": WebhookProcessingStatus.COMPLETED.value, "completed_at": datetime.now(timezone.utc)}},
                )
                return

            # Check if customer requested human staff
            handoff_keywords = ["agent", "human", "staff", "representative", "person", "operator", "talk to human", "connect with staff"]
            if intent == "human_handoff" or any(w in user_text.lower() for w in handoff_keywords):
                await db["conversations"].update_one(
                    {"_id": ObjectId(conv_id)},
                    {"$set": {
                        "status": "WAITING_HUMAN",
                        "assigned_user_id": None,
                        "last_message_at": now,
                    }}
                )

            # 7. Generate Response via AI Fashion Assistant
            reply_text = await fashion_assistant.generate_response(
                user_phone=sender,
                user_message=user_text,
                conversation_id=conv_id,
                customer_id=customer_id,
            )

            # 8. Send Outbound Reply via WhatsApp Cloud API
            ext_reply_id = None
            prod_img_url = getattr(reply_text, "image_url", None)
            reply_body = str(reply_text).replace("**", "")
            try:
                if prod_img_url:
                    try:
                        # Meta WhatsApp Cloud API supports image with caption up to 1024 chars
                        if len(reply_body) <= 1000:
                            img_res = await whatsapp_client.send_image_message(
                                sender, prod_img_url, caption=reply_body
                            )
                            resp_msgs = img_res.get("messages", [])
                            if resp_msgs:
                                ext_reply_id = resp_msgs[0].get("id")
                        else:
                            # If text exceeds caption limit, send visual photo first then full message
                            await whatsapp_client.send_image_message(
                                sender, prod_img_url, caption="📸 *Product Visual Confirmation* ✨"
                            )
                            wa_res = await whatsapp_client.send_text_message(
                                sender, reply_body, preview_url=True
                            )
                            resp_msgs = wa_res.get("messages", [])
                            if resp_msgs:
                                ext_reply_id = resp_msgs[0].get("id")
                    except Exception as img_err:
                        print(f"[WARNING] Failed to send product image to WhatsApp: {img_err}")
                        wa_res = await whatsapp_client.send_text_message(
                            sender, reply_body, preview_url=True
                        )
                        resp_msgs = wa_res.get("messages", [])
                        if resp_msgs:
                            ext_reply_id = resp_msgs[0].get("id")
                else:
                    wa_res = await whatsapp_client.send_text_message(
                        sender, reply_body, preview_url=True
                    )
                    resp_msgs = wa_res.get("messages", [])
                    if resp_msgs:
                        ext_reply_id = resp_msgs[0].get("id")
            except Exception as send_err:
                print(f"[ERROR] Failed to send outbound WhatsApp message: {send_err}")

            # 9. Save Outbound Message
            outbound_doc = MessageModel(
                conversation_id=conv_id,
                external_message_id=ext_reply_id,
                direction=MessageDirection.OUTBOUND,
                text=reply_text,
                delivery_status=DeliveryStatus.SENT if ext_reply_id else DeliveryStatus.FAILED,
                created_at=datetime.now(timezone.utc),
            ).model_dump(by_alias=True, exclude={"id"})
            await db["messages"].insert_one(outbound_doc)

            # 10. Update Conversation's last_message_at
            await db["conversations"].update_one(
                {"_id": ObjectId(conv_id)},
                {"$set": {"last_message_at": datetime.now(timezone.utc)}},
            )

            # 11. Mark Webhook Event as Completed
            await db["webhook_events"].update_one(
                {"provider_event_id": msg_id},
                {"$set": {"processing_status": WebhookProcessingStatus.COMPLETED.value}},
            )

        except Exception as process_err:
            print(f"[ERROR] Webhook processing exception: {process_err}")
            await db["webhook_events"].update_one(
                {"provider_event_id": msg_id},
                {
                    "$set": {
                        "processing_status": WebhookProcessingStatus.FAILED.value,
                        "last_error": str(process_err),
                    }
                },
            )


whatsapp_controller = WhatsAppController()
