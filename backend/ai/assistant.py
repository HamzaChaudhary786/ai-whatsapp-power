import asyncio
import os
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from bson import ObjectId
from fastapi import HTTPException
import google.generativeai as genai
from ai.intent_model import intent_model
from config.settings import settings
from db.mongodb import get_database
from models.order_model import OrderCreate, OrderItem, AddressSnapshot, OrderStatus
from controllers.order_controller import OrderController
from ai.recommendation_engine import recommendation_engine
from ai.online_learning import online_learning_engine
from utils.email_service import email_service
from utils.phone_utils import normalize_pakistan_phone
from ai.checkout_handler import checkout_handler
from ai.variant_handler import variant_handler
from utils.url_helper import clean_chat_reply_text, get_product_storefront_url


def _clean_stylist_text(text: str, product_id: Optional[str] = None) -> str:
    """Cleans responses by removing double asterisks, excessive markdown clutter, and raw image URLs."""
    if not text:
        return ""
    cleaned = text.replace("**", "")
    cleaned = re.sub(r"\*{2,}", "", cleaned)
    cleaned = clean_chat_reply_text(cleaned, product_id=product_id)
    return cleaned.strip()


class StylistReply(str):
    """Subclass of str with optional action metadata for orders and UI cards."""
    def __new__(
        cls,
        text: str,
        order_created: bool = False,
        order: Optional[Dict[str, Any]] = None,
        product_action: Optional[Dict[str, Any]] = None,
        image_url: Optional[str] = None,
        relevant_products: Optional[List[Dict[str, Any]]] = None,
        conversion_nudge: Optional[str] = None,
    ):
        prod_id = None
        if isinstance(product_action, dict):
            prod_id = product_action.get("product_id") or product_action.get("id")
            if prod_id and "product_url" not in product_action:
                product_action["product_url"] = settings.get_product_url(prod_id)

        cleaned_text = _clean_stylist_text(text, product_id=prod_id)
        obj = str.__new__(cls, cleaned_text)
        obj.order_created = order_created
        obj.order = order
        obj.product_action = product_action
        obj.image_url = None  # Raw image URLs completely eliminated in favor of website product URLs
        obj.relevant_products = relevant_products
        obj.conversion_nudge = conversion_nudge
        return obj


class FashionAssistant:
    """Production Conversational Fashion AI Stylist powered by Google Gemini LLM.
    
    Seamlessly combines:
    1. Google Gemini Generative AI for natural, human-like dialogue in English, Urdu, and Roman Urdu.
    2. Real-time MongoDB Catalog & Variant pricing injection.
    3. Live Order Tracking & status lookups.
    4. Store Knowledge Base (FAQs for Shipping, Returns, Sizing, Payments).
    5. Fallback rule-engine in case of API interruptions or offline mode.
    """

    def __init__(self):
        self._gemini_initialized = False
        self._active_model_name: Optional[str] = "gemini-3.5-flash-lite"
        self._candidate_models = [
            "gemini-3.5-flash-lite",
            "gemini-3-flash-preview",
            "gemini-3.8-flash",
            "gemini-flash-latest",
        ]
        self._model_cooldowns: Dict[str, float] = {}
        self._init_gemini()

    def _init_gemini(self) -> None:
        if settings.GEMINI_API_KEY and not self._gemini_initialized:
            try:
                genai.configure(api_key=settings.GEMINI_API_KEY)
                self._gemini_initialized = True
                print("[INFO] Google Gemini LLM configured with low-latency flash optimization.")
            except Exception as e:
                print(f"[WARNING] Could not configure Google Gemini LLM: {e}")

    def _get_available_models(self) -> List[str]:
        """Returns candidate models excluding any currently on 429/timeout cooldown."""
        import time
        now = time.time()
        available = []

        # If active model is valid, try it first
        if self._active_model_name and self._model_cooldowns.get(self._active_model_name, 0) < now:
            available.append(self._active_model_name)

        for m in self._candidate_models:
            if m not in available and self._model_cooldowns.get(m, 0) < now:
                available.append(m)

        return available or ["gemini-3.5-flash-lite"]

    async def _fetch_customer_context(
        self,
        db: Any,
        user_phone: str,
        conversation_id: Optional[str] = None,
        customer_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Fetch customer info, recent chat history, active product state, and active orders."""
        context: Dict[str, Any] = {
            "customer_name": "Valued Shopper",
            "customer_email": None,
            "customer_id": None,
            "recent_orders": [],
            "recent_messages": [],
            "conversation_id": conversation_id,
            "active_product_id": None,
            "active_product_name": None,
        }

        try:
            customer = None
            if customer_id:
                try:
                    customer = await db["customers"].find_one({"_id": ObjectId(customer_id)})
                except Exception:
                    customer = await db["customers"].find_one({"_id": customer_id})

            if not customer:
                clean_phone = normalize_pakistan_phone(user_phone)
                customer = await db["customers"].find_one({
                    "$or": [
                        {"phone": user_phone},
                        {"whatsapp_id": user_phone},
                        {"phone": clean_phone},
                        {"whatsapp_id": clean_phone},
                        {"phone": f"+{clean_phone}"},
                        {"phone": f"0{clean_phone[2:]}" if clean_phone.startswith("92") else clean_phone},
                    ]
                })
            if customer:
                context["customer_name"] = customer.get("name") or "Valued Shopper"
                context["customer_email"] = customer.get("email")
                context["customer_id"] = str(customer["_id"])
                cust_id_str = str(customer["_id"])
                cust_id_obj = customer["_id"]

                # Fetch active/recent orders
                orders_cursor = db["orders"].find({
                    "customer_id": {"$in": [cust_id_str, cust_id_obj]}
                }).sort("created_at", -1).limit(3)
                context["recent_orders"] = [
                    {
                        "order_number": o.get("order_number"),
                        "status": o.get("status"),
                        "total": o.get("total"),
                        "currency": o.get("currency", "PKR"),
                        "item_count": len(o.get("items", [])),
                    }
                    async for o in orders_cursor
                ]

            # Fetch active conversation thread
            conversation = None
            if conversation_id:
                try:
                    conversation = await db["conversations"].find_one({"_id": ObjectId(conversation_id)})
                except Exception:
                    conversation = await db["conversations"].find_one({"_id": conversation_id})

            if not conversation and customer:
                conversation = await db["conversations"].find_one({
                    "customer_id": {"$in": [str(customer["_id"]), customer["_id"]]}
                })

            if conversation:
                conv_id_str = str(conversation["_id"])
                context["conversation_id"] = conv_id_str
                context["active_product_id"] = conversation.get("active_product_id")
                context["active_product_name"] = conversation.get("active_product_name")

                try:
                    conv_id_obj = ObjectId(conv_id_str)
                    conv_filter = [conv_id_str, conv_id_obj]
                except Exception:
                    conv_filter = [conv_id_str]

                # Fetch last 15 messages so full multi-turn context is preserved
                msgs_cursor = (
                    db["messages"]
                    .find({"conversation_id": {"$in": conv_filter}})
                    .sort("created_at", -1)
                    .limit(15)
                )
                recent_msgs = [m async for m in msgs_cursor]
                recent_msgs.reverse()
                context["recent_messages"] = [
                    f"{'Customer' if str(m.get('direction', '')).lower() == 'inbound' else 'Aria'}: {m.get('text', '')}"
                    for m in recent_msgs
                ]
        except Exception as e:
            print(f"[WARNING] Error fetching customer context: {e}")

        return context

    async def _format_product_detail(self, db: Any, p: Dict[str, Any]) -> Dict[str, Any]:
        """Formats a MongoDB product document and its variants into a rich catalog/stylist item."""
        pid = str(p["_id"])
        variants = await db["product_variants"].find({"product_id": pid}).to_list(length=10)
        prices = [v.get("price", 0.0) for v in variants if "price" in v and v.get("price")]
        sizes = list(set(v.get("size", "") for v in variants if v.get("size")))
        colors = list(set(v.get("color", "") for v in variants if v.get("color")))

        min_price = min(prices) if prices else 14000.0
        max_price = max(prices) if prices else 14000.0
        price_display = f"PKR {min_price:,.2f}" if min_price == max_price else f"PKR {min_price:,.2f} - PKR {max_price:,.2f}"

        raw_img = p.get("image_urls", [None])[0] if p.get("image_urls") else None
        if raw_img and raw_img.startswith("/"):
            public_base = getattr(settings, "PUBLIC_BASE_URL", None) or os.getenv("PUBLIC_BASE_URL")
            img_url = f"{public_base.rstrip('/')}{raw_img}" if public_base else "https://images.unsplash.com/photo-1566174053879-31528523f8ae?fm=jpg&fit=crop&w=600&q=80"
        else:
            img_url = raw_img or "https://images.unsplash.com/photo-1566174053879-31528523f8ae?fm=jpg&fit=crop&w=600&q=80"

        return {
            "id": pid,
            "product_url": settings.get_product_url(pid),
            "name": p.get("name"),
            "category": p.get("category"),
            "price": price_display,
            "min_price": min_price,
            "max_price": max_price,
            "sizes": ", ".join(sorted(sizes)) if sizes else "Standard",
            "colors": ", ".join(colors) if colors else "Standard",
            "color_list": colors,
            "size_list": sorted(sizes),
            "description": p.get("description", ""),
            "image_url": img_url,
            "variants": variants,
        }

    def _find_product_in_catalog(self, products: List[Dict[str, Any]], raw_text: str) -> Tuple[Optional[Dict[str, Any]], str]:
        """Accurately finds a specific product from all active catalog products using exact, substring, or token matching."""
        if not raw_text or not products:
            return None, "none"

        lowered = raw_text.lower().strip()
        sorted_prods = sorted(products, key=lambda p: len(p.get("name", "")), reverse=True)

        # 1. Exact or Substring: Is product name in user's message?
        for p in sorted_prods:
            p_name = p.get("name", "").lower()
            if p_name and p_name in lowered:
                return p, "name_in_msg"

        # 2. Is user's phrase in product name? (e.g. user typed "chiffon party wear" or "banarasi chiffon")
        stop_words = {
            "dikhao", "dikhayein", "dikha", "chahiye", "hai", "hain", "kya", "show", "me",
            "please", "tell", "about", "price", "of", "ki", "ka", "ke", "ko", "mujhe",
            "details", "information", "info", "outfit", "options", "kuch", "aur", "or",
            "i", "want", "to", "see", "buy", "order", "karna", "krna", "send", "photo",
            "yeh", "ye", "wali", "wala", "dress", "suit"
        }
        words = [w for w in re.findall(r"\b\w+\b", lowered) if len(w) >= 3 and w not in stop_words]
        if len(words) >= 2:
            phrase = " ".join(words)
            for p in sorted_prods:
                p_name = p.get("name", "").lower()
                if phrase in p_name:
                    return p, "msg_in_name"

        # 3. Token-based matching: at least 2 key fashion tokens match the product name
        if len(words) >= 2:
            best_prod = None
            best_score = 0
            for p in sorted_prods:
                p_tokens = set(re.findall(r"\b\w+\b", p.get("name", "").lower()))
                matched = sum(1 for w in words if w in p_tokens)
                if matched >= 2 and matched > best_score:
                    best_score = matched
                    best_prod = p
            if best_prod and best_score >= 2:
                return best_prod, f"token_match_{best_score}"

        return None, "none"

    async def _fetch_catalog_context(self, db: Any, user_message: str = "") -> List[Dict[str, Any]]:
        """Fetch active products and price variants for dynamic styling recommendations."""
        catalog_items = []
        try:
            cursor = db["products"].find({"is_active": True})
            all_prods = [p async for p in cursor]

            target_prod = None
            if user_message:
                target_prod, _ = self._find_product_in_catalog(all_prods, user_message)

            matched_ids = set()
            if target_prod:
                catalog_items.append(await self._format_product_detail(db, target_prod))
                matched_ids.add(str(target_prod["_id"]))

            if user_message:
                tokens = [w for w in re.findall(r"\b\w+\b", user_message.lower()) if len(w) >= 3]
                for p in all_prods:
                    pid = str(p["_id"])
                    if pid in matched_ids:
                        continue
                    p_name_lower = p.get("name", "").lower()
                    p_desc_lower = p.get("description", "").lower()
                    if any(t in p_name_lower or t in p_desc_lower for t in tokens):
                        catalog_items.append(await self._format_product_detail(db, p))
                        matched_ids.add(pid)
                    if len(catalog_items) >= 8:
                        break

            for p in all_prods:
                pid = str(p["_id"])
                if pid not in matched_ids:
                    catalog_items.append(await self._format_product_detail(db, p))
                    matched_ids.add(pid)
                if len(catalog_items) >= 8:
                    break
        except Exception as e:
            print(f"[WARNING] Error fetching catalog context: {e}")
        return catalog_items

    async def _fetch_faq_context(self, db: Any, user_message: str) -> List[Dict[str, str]]:
        """Fetch relevant FAQ knowledge base documents for policies and store info, prioritizing popular FAQs."""
        faqs = []
        try:
            tokens = [
                re.escape(w.lower())
                for w in re.findall(r"\b\w+\b", user_message)
                if len(w) >= 3 and w.lower() not in [
                    "kya", "hai", "hain", "mein", "aur", "the", "this", "that", "with",
                    "what", "how", "when", "aap", "mera", "meri", "mere", "for", "and", "can"
                ]
            ]
            matched_docs = []
            if tokens:
                pattern = "|".join(tokens[:8])
                cursor = db["faq_documents"].find({
                    "$or": [
                        {"title": {"$regex": pattern, "$options": "i"}},
                        {"approved_content": {"$regex": pattern, "$options": "i"}},
                        {"keywords": {"$in": [re.compile(f"^{t}", re.I) for t in tokens[:6]]}},
                    ]
                }).sort([("hit_count", -1)]).limit(4)
                matched_docs = [d async for d in cursor]

            if not matched_docs:
                try:
                    cursor = db["faq_documents"].find(
                        {"$text": {"$search": user_message}},
                        {"score": {"$meta": "textScore"}},
                    ).sort([("score", {"$meta": "textScore"}), ("hit_count", -1)]).limit(3)
                    matched_docs = [d async for d in cursor]
                except Exception:
                    pass

            if not matched_docs:
                cursor = db["faq_documents"].find().sort([("hit_count", -1)]).limit(3)
                matched_docs = [d async for d in cursor]

            for d in matched_docs:
                faqs.append({"title": d.get("title", ""), "content": d.get("approved_content", "")})
                # Asynchronously update hit count and train online learning model on popular questions
                try:
                    doc_id = d["_id"]
                    doc_title = d.get("title", "")
                    asyncio.create_task(db["faq_documents"].update_one({"_id": doc_id}, {"$inc": {"hit_count": 1}}))
                    asyncio.create_task(
                        online_learning_engine.record_interaction(
                            db=db,
                            event_type="faq_inquiry",
                            search_query=user_message,
                            metadata={"faq_id": str(doc_id), "title": doc_title},
                        )
                    )
                except Exception:
                    pass
        except Exception as e:
            print(f"[WARNING] FAQ context fetch error: {e}")
        return faqs

    async def _generate_gemini_response(
        self,
        user_message: str,
        user_phone: str,
        intent: str,
        confidence: float,
        customer_ctx: Dict[str, Any],
        catalog_ctx: List[Dict[str, Any]],
        faq_ctx: List[Dict[str, str]],
        recommendations_ctx: Optional[List[Dict[str, Any]]] = None,
        cross_sells_ctx: Optional[List[Dict[str, Any]]] = None,
        conversion_nudge: Optional[str] = None,
        is_fresh_request: bool = False,
    ) -> Optional[str]:
        """Calls Google Gemini LLM with rich persona and dynamic boutique context."""
        if not settings.GEMINI_API_KEY:
            return None

        self._init_gemini()

        base_store = settings.STOREFRONT_URL.rstrip('/')

        # Format Catalog Context
        catalog_summary = "\n".join(
            [
                f"- {item['name']} ({item['category']}): {item['price']} | Website Link: {base_store}/{item['id']} | Colors: {item['colors']} | Sizes: {item['sizes']} | Details: {item['description']}"
                for item in catalog_ctx
            ]
        ) or "No catalog items currently loaded."

        # Format AI Recommendations Context if present
        recs_summary = ""
        if recommendations_ctx:
            r_lines = [
                f"- {r['name']} ({r.get('category', 'Fashion')}): {r['price']} | Website Link: {base_store}/{r['id']} | Colors: {r.get('colors')} | Sizes: {r.get('sizes')} | Score: {r.get('score')} | Details: {r.get('description', '')[:120]}"
                for r in recommendations_ctx
            ]
            recs_summary = "\n[AI ML PERSONALIZED RECOMMENDATIONS FOR THIS INQUIRY]\n" + "\n".join(r_lines) + "\n"

        # Format Complementary Cross-Sell Context
        cross_sell_summary = ""
        if cross_sells_ctx:
            c_lines = [
                f"- Matching Piece: {c['name']} ({c.get('category')}) - {c['price']} | Website Link: {base_store}/{c['id']} | Colors: {c.get('colors')} | Sizes: {c.get('sizes')}"
                for c in cross_sells_ctx
            ]
            cross_sell_summary = "\n[HIGH-CONVERSION COMPLEMENTARY CROSS-SELL PIECES TO SUGGEST TOGETHER]\n" + "\n".join(c_lines) + "\n"

        nudge_summary = f"\n[RECOMMENDED SALES CONVERSION CLOSING OFFER]\n{conversion_nudge}\n" if conversion_nudge else ""

        # Format Order Context
        orders_summary = "\n".join(
            [
                f"- Order #{o['order_number']}: Status={o['status']}, Total={o['currency']} {o['total']:.2f}, Items={o['item_count']}"
                for o in customer_ctx["recent_orders"]
            ]
        ) or "No recent orders on record for this phone number."

        # Format FAQs
        faq_summary = "\n".join(
            [f"- {f['title']}: {f['content']}" for f in faq_ctx]
        ) or "Standard policies: Free delivery on orders over PKR 2,000. 7-day hassle-free exchange."

        # Format Chat History
        history_summary = "\n".join(customer_ctx["recent_messages"]) or "Beginning of conversation."

        fresh_instruction = (
            "\n[CRITICAL ROTATION DIRECTIVE: CUSTOMER REQUESTED A DIFFERENT / NEW DRESS]\n"
            "The customer specifically asked for another/new dress ('koi aur dress', 'kuch naya', 'different dress'). "
            "DO NOT repeat or praise the dress discussed earlier! Immediately introduce the FRESH new piece from "
            "[AI ML PERSONALIZED RECOMMENDATIONS FOR THIS INQUIRY] with fresh styling excitement!\n"
            if is_fresh_request
            else ""
        )

        system_instruction = (
            "You are 'Aria', an elite, warm, and highly professional Fashion Stylist & Personal Shopper "
            "for a premier luxury boutique on WhatsApp.\n\n"
            "CRITICAL STYLE & FORMATTING RULES (STRICT):\n"
            "1. NO DOUBLE ASTERISKS (**): NEVER output markdown double asterisks '**'. Do not write '**Product**' or '**Price**'. "
            "Write clean plain text or use single asterisks sparingly for key titles.\n\n"
            "2. CLEAN, SHORT & PROFESSIONAL: Customers want quick, direct answers, NOT long essays. "
            "Keep responses CRISP, SHORT, AND HIGHLY READABLE (3 to 5 short lines max).\n\n"
            "3. HIGHLIGHT THE MAIN THING FIRST:\n"
            "- When recommending or discussing an outfit, clearly state on their own clean lines:\n"
            "  Product: [Exact Name]\n"
            "  Price: PKR [Amount] (Free Express Delivery)\n"
            "  Colors: [Available Colors]\n"
            "  Sizes: [Available Sizes]\n"
            f"  View on Website: {base_store}/[Product ID]\n"
            "- CRITICAL RULE: NEVER output raw image URLs (e.g. unsplash, static uploads, or direct photo links). "
            f"Instead, ALWAYS provide the official website product link ({base_store}/<product_id>) so the customer can view high-resolution photos and details directly on the website.\n"
            "- Add one short styling tip or pairing suggestion.\n"
            "- Finish with a quick polite call-to-action (e.g. 'Would you like to reserve your size? Reply with size & city!').\n\n"
            "4. ROTATE RECOMMENDATIONS (NEVER REPEAT SAME DRESS):\n"
            "If the customer says 'koi aur dress dikhao', 'koi or dress', 'kuch naya', 'different dress', or asks for another dress, "
            "NEVER repeat the previous item! Immediately present the fresh new piece from [AI ML PERSONALIZED RECOMMENDATIONS FOR THIS INQUIRY].\n\n"
            "5. HUMAN AGENT HANDOFF WITH PERMISSION:\n"
            "If you DO NOT know the answer to a question or it is outside store info and FAQs, politely state you don't have this info "
            "and ask: 'Kya main yeh chat hamare live human boutique stylist / agent ko assign kar doon? Aap Haan ya Nahi reply karein. 🌸🤝'\n\n"
            "6. BOUTIQUE POLICIES:\n"
            "Use [STORE POLICIES & FAQS] for delivery timelines (Same-day Lahore, 24-48h nationwide, Free delivery), Cash on Delivery (COD), open parcel policy, and 7-day exchange.\n\n"
            "7. BILINGUAL ELEGANCE:\n"
            "Converse naturally in warm, elegant English or Roman Urdu matching the user's natural language. Keep text polished and clutter-free.\n\n"
            "8. LIVE STOREFRONT WEBSITE & PRODUCT LINKS:\n"
            f"Our official store website is: {base_store}\n"
            f"Every dress in the catalog has a direct website link: {base_store}/<product_id>\n"
            f"Whenever customer asks about a dress, or you recommend a dress, ALWAYS include its direct link: {base_store}/<product_id> so customer can view pictures & inspect details directly on our website.\n"
            f"When customer asks generally to browse dresses, catalog, or track orders online, warmly share the general website link: {base_store}\n"
        )

        user_prompt = f"""[CONTEXT DATA]
Customer Name: {customer_ctx['customer_name']}
Customer Phone: {user_phone}
Detected Intent: {intent}
{fresh_instruction}
[LIVE BOUTIQUE CATALOG]
{catalog_summary}
{recs_summary}
{cross_sell_summary}
{nudge_summary}
[CUSTOMER ORDERS]
{orders_summary}

[STORE POLICIES & FAQS]
{faq_summary}

[RECENT CONVERSATION HISTORY]
{history_summary}

[CURRENT CUSTOMER MESSAGE]
"{user_message}"

IMPORTANT: Prioritize the customer's exact message above all else. Provide a complete, delightful, and natural response as Aria:"""

        # Try top available Gemini models (Max 2 attempts, strict 6.0s timeout per call)
        import time
        models_to_try = self._get_available_models()[:2]

        for model_name in models_to_try:
            try:
                model = genai.GenerativeModel(
                    model_name=model_name,
                    system_instruction=system_instruction,
                )

                # Execute with 6.0s timeout and 1000 max tokens to prevent thinking-token truncation
                def _call_model():
                    return model.generate_content(
                        user_prompt,
                        generation_config=genai.types.GenerationConfig(
                            temperature=0.7,
                            max_output_tokens=1000,
                        ),
                        request_options={"timeout": 6.0},
                    )

                response = await asyncio.wait_for(
                    asyncio.to_thread(_call_model),
                    timeout=6.5,
                )

                if response and response.text:
                    self._active_model_name = model_name
                    return response.text.strip()

            except (asyncio.TimeoutError, TimeoutError):
                print(f"[TIMEOUT] Model '{model_name}' exceeded 6.0s. Cool-down enabled.")
                self._model_cooldowns[model_name] = time.time() + 600
                continue

            except Exception as model_err:
                err_msg = str(model_err)
                if "429" in err_msg or "quota" in err_msg.lower():
                    print(f"[QUOTA 429] Model '{model_name}' exhausted quota. Cool-down for 15 mins.")
                    self._model_cooldowns[model_name] = time.time() + 900
                elif "504" in err_msg or "deadline" in err_msg.lower():
                    self._model_cooldowns[model_name] = time.time() + 300
                else:
                    print(f"[WARNING] Gemini model '{model_name}' skipped: {err_msg[:80]}")
                continue

        return None

    async def _process_autonomous_order(
        self,
        db: Any,
        user_phone: str,
        user_message: str,
        intent: str,
        customer_ctx: Dict[str, Any],
        catalog_ctx: List[Dict[str, Any]],
    ) -> Optional[StylistReply]:
        """Delegates to CheckoutHandler for professional multi-step conversational checkout."""
        conv_doc = None
        conv_oid = None
        if customer_ctx.get("conversation_id"):
            cid = customer_ctx["conversation_id"]
            conv_oid = ObjectId(cid) if ObjectId.is_valid(cid) else cid
            conv_doc = await db["conversations"].find_one({"_id": conv_oid})
        return await checkout_handler.start_or_continue_checkout(
            db, user_phone, user_message, intent, customer_ctx, catalog_ctx, conv_doc, conv_oid
        )

    async def _find_customer_order_to_cancel(
        self,
        db: Any,
        user_phone: str,
        user_message: str,
        customer_ctx: Dict[str, Any],
    ) -> Tuple[Optional[Dict[str, Any]], str]:
        """Finds target order to cancel, prioritizing order number in message, then active orders."""
        order_match = re.search(r"(ORD-\d{8}-\d{4}|ORD\d+|#ORD\w+)", user_message.upper())
        if order_match:
            extracted_no = order_match.group(1).replace("#", "")
            order = await db["orders"].find_one({"order_number": {"$regex": extracted_no, "$options": "i"}})
            if order:
                status_val = str(order.get("status", "PENDING")).upper()
                if status_val == "CANCELLED":
                    return order, "ALREADY_CANCELLED"
                elif status_val in ["SHIPPED", "DELIVERED"]:
                    return order, "CANNOT_CANCEL_DISPATCHED"
                else:
                    return order, "READY_TO_CANCEL"
            else:
                return None, "NOT_FOUND_SPECIFIC"

        # Look up customer's active orders from MongoDB
        clean_phone = normalize_pakistan_phone(user_phone)
        cust_id = customer_ctx.get("customer_id")

        phone_variants = [user_phone, clean_phone, f"+{clean_phone}"]
        if clean_phone.startswith("92") and len(clean_phone) == 12:
            phone_variants.append(f"0{clean_phone[2:]}")
        elif clean_phone.startswith("03") and len(clean_phone) == 11:
            phone_variants.append(f"92{clean_phone[1:]}")
            phone_variants.append(f"+92{clean_phone[1:]}")

        query_conditions = [{"address_snapshot.phone": pv} for pv in phone_variants]
        query_conditions.append({
            "address_snapshot.phone": {"$regex": clean_phone[-10:] if len(clean_phone) >= 10 else clean_phone}
        })

        # Also search by customer document ID
        cust_ids_to_check = set()
        if cust_id:
            cust_ids_to_check.add(str(cust_id))
            if ObjectId.is_valid(cust_id):
                cust_ids_to_check.add(ObjectId(cust_id))

        try:
            matched_cust = await db["customers"].find_one({
                "$or": [
                    {"phone": {"$in": phone_variants}},
                    {"whatsapp_id": {"$in": phone_variants}},
                ]
            })
            if matched_cust:
                cid = matched_cust["_id"]
                cust_ids_to_check.add(str(cid))
                cust_ids_to_check.add(cid)
        except Exception:
            pass

        if cust_ids_to_check:
            query_conditions.insert(0, {"customer_id": {"$in": list(cust_ids_to_check)}})

        # A. Find active orders in PENDING, CONFIRMED, or PROCESSING
        active_orders_cursor = db["orders"].find(
            {
                "$or": query_conditions,
                "status": {"$in": ["PENDING", "CONFIRMED", "PROCESSING"]},
            }
        ).sort("created_at", -1).limit(5)
        active_orders = [o async for o in active_orders_cursor]

        if len(active_orders) > 1:
            return active_orders, "MULTIPLE_ACTIVE_ORDERS"
        elif len(active_orders) == 1:
            return active_orders[0], "READY_TO_CANCEL"

        # B. Check if recent order is already CANCELLED
        recent_cancelled = await db["orders"].find_one(
            {
                "$or": query_conditions,
                "status": "CANCELLED",
            },
            sort=[("created_at", -1)]
        )
        if recent_cancelled:
            return recent_cancelled, "ALREADY_CANCELLED"

        # C. Check if recent order was SHIPPED or DELIVERED
        recent_shipped = await db["orders"].find_one(
            {
                "$or": query_conditions,
                "status": {"$in": ["SHIPPED", "DELIVERED"]},
            },
            sort=[("created_at", -1)]
        )
        if recent_shipped:
            return recent_shipped, "CANNOT_CANCEL_DISPATCHED"

        return None, "NO_ORDERS_ON_RECORD"

    async def generate_response(
        self,
        user_phone: str,
        user_message: str,
        client_history: Optional[List[Dict[str, Any]]] = None,
        conversation_id: Optional[str] = None,
        customer_id: Optional[str] = None,
    ) -> StylistReply:
        """Main entry point: Generates rapid AI response in 1-3 seconds with autonomous ordering."""
        db = get_database()
        intent, confidence = intent_model.predict(user_message)

        # 1. Concurrent Context Retrieval from MongoDB (<80ms total)
        customer_ctx, catalog_ctx, faq_ctx = await asyncio.gather(
            self._fetch_customer_context(db, user_phone, conversation_id=conversation_id, customer_id=customer_id),
            self._fetch_catalog_context(db, user_message=user_message),
            self._fetch_faq_context(db, user_message),
        )

        # Merge client_history if supplied from Web Storefront
        if client_history:
            formatted_history = []
            for m in client_history[-15:]:
                sender = "Customer" if m.get("sender") == "user" else "Aria"
                txt = m.get("text") or m.get("content") or ""
                if txt:
                    formatted_history.append(f"{sender}: {txt}")
            if formatted_history:
                customer_ctx["recent_messages"] = formatted_history

        # If active_product_name is not yet resolved, detect it from recent chat context
        if not customer_ctx.get("active_product_name") and customer_ctx.get("recent_messages"):
            for p in catalog_ctx:
                p_name = p.get("name")
                if p_name and any(p_name.lower() in m.lower() for m in customer_ctx["recent_messages"]):
                    customer_ctx["active_product_name"] = p_name
                    customer_ctx["active_product_id"] = p.get("id")
                    break

        # 1.1 Fetch Conversation Document for State & Pending Checks
        conv_doc = None
        conv_oid = None
        if conversation_id:
            try:
                conv_oid = ObjectId(conversation_id) if ObjectId.is_valid(conversation_id) else conversation_id
                conv_doc = await db["conversations"].find_one({"_id": conv_oid})
            except Exception:
                pass

        if not conv_oid and customer_ctx.get("conversation_id"):
            try:
                c_id = customer_ctx["conversation_id"]
                conv_oid = ObjectId(c_id) if ObjectId.is_valid(c_id) else c_id
                conv_doc = await db["conversations"].find_one({"_id": conv_oid})
            except Exception:
                pass

        if not conv_doc and user_phone:
            clean_p = normalize_pakistan_phone(user_phone)
            conv_doc = await db["conversations"].find_one({
                "$or": [
                    {"customer_phone": user_phone},
                    {"customer_phone": clean_p},
                    {"customer_phone": f"+{clean_p}"},
                    {"customer_phone": f"0{clean_p[2:]}" if clean_p.startswith("92") else clean_p},
                ]
            }, sort=[("last_message_at", -1)])
            if conv_doc:
                conv_oid = conv_doc["_id"]

        lowered_msg = user_message.lower().strip()
        words_in_msg = set(re.findall(r"\b\w+\b", lowered_msg))

        # 1.14 Handle Active Conversational Checkout Session (Multi-Step Checkout State Machine)
        if conv_doc and conv_doc.get("checkout_session"):
            checkout_res = await checkout_handler.handle_active_checkout_session(
                db, conv_doc, user_phone, user_message, lowered_msg, words_in_msg, customer_ctx
            )
            if checkout_res:
                return checkout_res

        # 1.15 Handle Pending Order Cancellation Confirmation Check (STRICT 2-STEP CONFIRMATION)
        if conv_doc and conv_doc.get("pending_order_cancellation"):
            pending_cancel = conv_doc["pending_order_cancellation"]

            # =========================================================================
            # CASE A: Multiple Active Orders Selection (1, 2, Both, or Nahi)
            # =========================================================================
            if pending_cancel.get("type") == "MULTIPLE_CHOICE":
                orders_list = pending_cancel.get("orders", [])

                negative_words = {"nahi", "nahin", "no", "na", "mat", "stop", "never", "none"}
                is_negative = bool(words_in_msg.intersection(negative_words)) or any(
                    p in lowered_msg for p in [
                        "rehne do", "rehn do", "mat karo", "dont", "don't", "cancel na",
                        "cancel mat", "keep", "not cancel", "rehne dein", "rehndy", "rehn de", "koi nahi", "kuch nahi"
                    ]
                )

                # Cancel Both / All
                is_both = any(
                    p in lowered_msg for p in [
                        "dono", "both", "all", "sab", "tamam", "two", "dono cancel",
                        "both cancel", "cancel both", "sab cancel", "cancel all", "all cancel"
                    ]
                ) or ("dono" in words_in_msg or "both" in words_in_msg or "all" in words_in_msg)

                # Cancel Option 1
                is_opt_1 = (
                    "1" in words_in_msg
                    or "one" in words_in_msg
                    or "pehla" in words_in_msg
                    or "first" in words_in_msg
                    or any(p in lowered_msg for p in ["order 1", "pehla order", "first order", "opt 1", "option 1"])
                    or (len(orders_list) > 0 and orders_list[0].get("order_number", "").lower() in lowered_msg)
                )

                # Cancel Option 2
                is_opt_2 = (
                    "2" in words_in_msg
                    or "two" in words_in_msg
                    or "doosra" in words_in_msg
                    or "dosra" in words_in_msg
                    or "second" in words_in_msg
                    or any(p in lowered_msg for p in ["order 2", "doosra order", "second order", "opt 2", "option 2"])
                    or (len(orders_list) > 1 and orders_list[1].get("order_number", "").lower() in lowered_msg)
                )

                if is_negative:
                    # Keep all orders active
                    now = datetime.now(timezone.utc)
                    await db["conversations"].update_one(
                        {"_id": conv_doc["_id"]},
                        {
                            "$unset": {"pending_order_cancellation": ""},
                            "$set": {"last_message_at": now},
                        }
                    )
                    return StylistReply(
                        "🌸 *Shukriya!* Aapka koi bhi order cancel nahi kiya gaya aur tamam orders bilkul active hain. ✨\n\n"
                        "Hamari atelier team inhein courier dispatch ke liye process kar rahi hai. 🚚📦\n\n"
                        "Kya aapko kisi aur dress ki styling recommendation chahiye? 👗"
                    )

                elif is_both:
                    # Cancel all/both orders in MongoDB
                    now = datetime.now(timezone.utc)
                    cancelled_nums = []
                    shipped_nums = []
                    from controllers.order_controller import OrderController

                    for ord_item in orders_list:
                        o_id = ord_item.get("order_id")
                        o_num = ord_item.get("order_number")

                        target_q = {"order_number": o_num}
                        if o_id and ObjectId.is_valid(o_id):
                            target_q = {"$or": [{"_id": ObjectId(o_id)}, {"order_number": o_num}]}

                        existing_order = await db["orders"].find_one(target_q)
                        if existing_order and str(existing_order.get("status", "")).upper() in ["SHIPPED", "DELIVERED"]:
                            shipped_nums.append(f"#{o_num}")
                            continue

                        cancelled_nums.append(f"#{o_num}")
                        old_status = existing_order.get("status", "CONFIRMED") if existing_order else "CONFIRMED"

                        cancel_hist = {
                            "status": "CANCELLED",
                            "timestamp": now,
                            "note": "Cancelled by customer (Both Orders cancelled) via WhatsApp / AI Stylist",
                        }
                        # Restock inventory atomically back to catalog
                        await OrderController.restore_order_inventory(
                            order_id_or_num=o_num,
                            reason="Customer chose to cancel all orders via AI Chat",
                        )
                        await db["orders"].update_one(
                            target_q,
                            {
                                "$set": {
                                    "status": "CANCELLED",
                                    "cancelled_at": now,
                                    "cancellation_reason": "Customer chose to cancel all orders via AI Chat",
                                    "updated_at": now,
                                },
                                "$push": {"status_history": cancel_hist},
                            }
                        )
                        await db["audit_logs"].insert_one({
                            "actor_user_id": None,
                            "action": "ORDER_STATUS_UPDATE",
                            "entity_type": "orders",
                            "entity_id": str(o_id),
                            "created_at": now,
                            "metadata": {
                                "order_number": o_num,
                                "old_status": old_status,
                                "new_status": "CANCELLED",
                                "note": "Customer cancelled multiple orders via AI Chat",
                            },
                        })

                        if existing_order:
                            asyncio.create_task(
                                OrderController.dispatch_status_notifications(
                                    order=existing_order,
                                    new_status="CANCELLED",
                                    note="Cancelled by customer choice via AI Chat",
                                )
                            )

                    await db["conversations"].update_one(
                        {"_id": conv_doc["_id"]},
                        {
                            "$unset": {"pending_order_cancellation": ""},
                            "$set": {"last_message_at": now},
                        }
                    )

                    if not cancelled_nums and shipped_nums:
                        shipped_str = ", ".join(shipped_nums)
                        return StylistReply(
                            f"📦 Maazrat! Aapke orders (*{shipped_str}*) already courier ke zariye dispatch (Shipped) ho chuke hain, is liye ab cancel nahi ho sakte. 🚚\n\n"
                            f"Lekin fikr na karein! Aap parcel delivery ke baad hamari *14-day replacement / exchange policy* use kar sakte hain. ✨"
                        )
                    elif cancelled_nums and shipped_nums:
                        orders_str = ", ".join(cancelled_nums)
                        shipped_str = ", ".join(shipped_nums)
                        return StylistReply(
                            f"✅ *Orders Update* 🌸\n\n"
                            f"Aapka order (*{orders_str}*) kamyabi se cancel kar diya gaya hai. ✨\n\n"
                            f"Jabke order (*{shipped_str}*) already courier ke zariye Shipped ho chuka hai is liye cancel nahi kiya ja saka. 🚚"
                        )
                    else:
                        orders_str = ", ".join(cancelled_nums)
                        return StylistReply(
                            f"✅ *Tamam Orders Cancel Kar Diye Gaye Hain* 🌸\n\n"
                            f"Aapke dono orders (*{orders_str}*) kamyabi se cancel ho chuke hain. ✨\n\n"
                            f"Aapke account ya card par koi charges deduct nahi huay hain. "
                            f"Agar aap mazeed koi collection dekhna chahein, toh main Aria hazir hoon! 👗🌿"
                        )

                elif is_opt_1 or is_opt_2:
                    selected_idx = 0 if is_opt_1 else 1
                    if selected_idx < len(orders_list):
                        target_ord = orders_list[selected_idx]
                        other_orders = [o for i, o in enumerate(orders_list) if i != selected_idx]
                        now = datetime.now(timezone.utc)

                        target_id = target_ord.get("order_id")
                        target_num = target_ord.get("order_number")

                        target_q = {"order_number": target_num}
                        if target_id and ObjectId.is_valid(target_id):
                            target_q = {"$or": [{"_id": ObjectId(target_id)}, {"order_number": target_num}]}

                        existing_order = await db["orders"].find_one(target_q)
                        if existing_order and str(existing_order.get("status", "")).upper() in ["SHIPPED", "DELIVERED"]:
                            await db["conversations"].update_one(
                                {"_id": conv_doc["_id"]},
                                {
                                    "$unset": {"pending_order_cancellation": ""},
                                    "$set": {"last_message_at": now},
                                }
                            )
                            return StylistReply(
                                f"📦 Maazrat! Aapka order *#{target_num}* already courier ke zariye *{existing_order.get('status').title()}* ho chuka hai, is liye ab cancel nahi ho sakta. 🚚\n\n"
                                f"Lekin fikr na karein, delivery ke baad aap hamari *14-day exchange / replacement policy* use kar sakte hain. ✨"
                            )

                        old_status = existing_order.get("status", "CONFIRMED") if existing_order else "CONFIRMED"
                        from controllers.order_controller import OrderController

                        cancel_hist = {
                            "status": "CANCELLED",
                            "timestamp": now,
                            "note": f"Cancelled order #{target_num} by customer choice via AI Chat",
                        }
                        # Restock inventory atomically back to catalog
                        await OrderController.restore_order_inventory(
                            order_id_or_num=target_num,
                            reason="Customer selected specific order to cancel via AI Chat",
                        )
                        await db["orders"].update_one(
                            target_q,
                            {
                                "$set": {
                                    "status": "CANCELLED",
                                    "cancelled_at": now,
                                    "cancellation_reason": "Customer selected specific order to cancel via AI Chat",
                                    "updated_at": now,
                                },
                                "$push": {"status_history": cancel_hist},
                            }
                        )
                        await db["audit_logs"].insert_one({
                            "actor_user_id": None,
                            "action": "ORDER_STATUS_UPDATE",
                            "entity_type": "orders",
                            "entity_id": str(target_id),
                            "created_at": now,
                            "metadata": {
                                "order_number": target_num,
                                "old_status": old_status,
                                "new_status": "CANCELLED",
                                "note": "Customer chose specific order to cancel via AI Chat",
                            },
                        })

                        if existing_order:
                            asyncio.create_task(
                                OrderController.dispatch_status_notifications(
                                    order=existing_order,
                                    new_status="CANCELLED",
                                    note="Customer chose specific order to cancel via AI Chat",
                                )
                            )

                        await db["conversations"].update_one(
                            {"_id": conv_doc["_id"]},
                            {
                                "$unset": {"pending_order_cancellation": ""},
                                "$set": {"last_message_at": now},
                            }
                        )

                        other_msg = ""
                        if other_orders:
                            other_no = other_orders[0].get("order_number")
                            other_msg = f"\n\n📦 Jabke aapka doosra order (*#{other_no}*) bilkul active hai aur dispatch ke liye process ho raha hai. 🚚✨"

                        return StylistReply(
                            f"✅ *Order #{target_num} Cancelled* 🌸\n\n"
                            f"Aapka order *#{target_num}* kamyabi se cancel kar diya gaya hai.{other_msg}\n\n"
                            f"Aapke account par koi charges deduct nahi huay hain. Agar koi aur madad chahiye toh batayein! 👗"
                        )

                else:
                    # Ambiguous reply - remind customer of choices politely
                    return StylistReply(
                        "Baraye meharbani batayein ke aap kaunsa order cancel karna chahte hain? 🌸\n\n"
                        "• Pehla order cancel karne ke liye *'1'* reply karein\n"
                        "• Doosra order cancel karne ke liye *'2'* reply karein\n"
                        "• Dono orders cancel karne ke liye *'Dono'* reply karein\n"
                        "• Agar order cancel nahi karna toh *'Nahi'* reply karein. 🤝✨"
                    )

            # =========================================================================
            # CASE B: Single Order Confirmation (existing flow)
            # =========================================================================
            target_order_id = pending_cancel.get("order_id")
            target_order_num = pending_cancel.get("order_number")

            negative_words = {"nahi", "nahin", "no", "na", "mat", "stop", "never"}
            is_negative = bool(words_in_msg.intersection(negative_words)) or any(
                p in lowered_msg for p in [
                    "rehne do", "rehn do", "mat karo", "dont", "don't", "cancel na",
                    "cancel mat", "keep", "not cancel", "rehne dein", "rehndy", "rehn de", "nahi chahiye", "rehna doh"
                ]
            )

            affirmative_words = {"haan", "han", "yes", "ji", "jee", "bilkul", "y", "sure", "ok", "theek", "thik", "pls", "please", "confirm"}
            is_affirmative = (not is_negative) and (
                bool(words_in_msg.intersection(affirmative_words)) or any(
                    p in lowered_msg for p in [
                        "kardo", "kar do", "kar dein", "krdo", "kr do", "cancel kardo", "cancel kar do",
                        "cancel krdo", "cancel please", "haan cancel", "han cancel", "yes cancel"
                    ]
                )
            )

            if is_negative:
                # Customer said "Nahi" / "Rehne do" / "Cancel mat karo": KEEP order active and do NOT cancel!
                now = datetime.now(timezone.utc)
                await db["conversations"].update_one(
                    {"_id": conv_doc["_id"]},
                    {
                        "$unset": {"pending_order_cancellation": ""},
                        "$set": {"last_message_at": now},
                    }
                )

                return StylistReply(
                    f"🌸 *Shukriya!* Aapka order *#{target_order_num}* cancel nahi kiya gaya aur bilkul active hai. ✨\n\n"
                    f"Hamari atelier team isay foran courier dispatch ke liye process kar rahi hai. 🚚📦\n\n"
                    f"Kya aapko iske alawa kisi aur dress ki styling recommendation chahiye? 👗"
                )

            elif is_affirmative:
                # Customer explicitly confirmed cancellation with "Haan" / "Yes"
                now = datetime.now(timezone.utc)

                # Resolve target query
                target_q = {"order_number": target_order_num}
                if target_order_id and ObjectId.is_valid(target_order_id):
                    target_q = {"$or": [{"_id": ObjectId(target_order_id)}, {"order_number": target_order_num}]}

                existing_order = await db["orders"].find_one(target_q)
                if existing_order and str(existing_order.get("status", "")).upper() in ["SHIPPED", "DELIVERED"]:
                    await db["conversations"].update_one(
                        {"_id": conv_doc["_id"]},
                        {
                            "$unset": {"pending_order_cancellation": ""},
                            "$set": {"last_message_at": now},
                        }
                    )
                    return StylistReply(
                        f"📦 Maazrat! Aapka order *#{target_order_num}* already courier ke zariye *{existing_order.get('status').title()}* ho chuka hai, is liye ab cancel nahi kiya ja sakta. 🚚\n\n"
                        f"Lekin fikr na karein! Parcel receive hone ke baad aap hamari *14-day exchange / replacement policy* use kar sakte hain. ✨"
                    )

                old_status = existing_order.get("status", "CONFIRMED") if existing_order else "CONFIRMED"
                from controllers.order_controller import OrderController

                cancel_history_entry = {
                    "status": "CANCELLED",
                    "timestamp": now,
                    "note": "Cancelled by customer via WhatsApp / AI Stylist confirmation",
                }

                # Restock inventory atomically back to catalog
                await OrderController.restore_order_inventory(
                    order_id_or_num=target_order_num,
                    reason="Customer confirmed cancellation via AI Chat",
                )

                # Update Order Document in MongoDB to CANCELLED
                await db["orders"].update_one(
                    target_q,
                    {
                        "$set": {
                            "status": "CANCELLED",
                            "cancelled_at": now,
                            "cancellation_reason": "Customer confirmed cancellation via AI Chat",
                            "updated_at": now,
                        },
                        "$push": {"status_history": cancel_history_entry},
                    }
                )

                # Log Audit Record
                await db["audit_logs"].insert_one({
                    "actor_user_id": None,
                    "action": "ORDER_STATUS_UPDATE",
                    "entity_type": "orders",
                    "entity_id": str(target_order_id),
                    "created_at": now,
                    "metadata": {
                        "order_number": target_order_num,
                        "old_status": old_status,
                        "new_status": "CANCELLED",
                        "note": "Customer confirmed order cancellation via AI Chat",
                    },
                })

                if existing_order:
                    asyncio.create_task(
                        OrderController.dispatch_status_notifications(
                            order=existing_order,
                            new_status="CANCELLED",
                            note="Customer confirmed order cancellation via AI Chat",
                        )
                    )

                # Clear pending_order_cancellation from conversation document
                await db["conversations"].update_one(
                    {"_id": conv_doc["_id"]},
                    {
                        "$unset": {"pending_order_cancellation": ""},
                        "$set": {"last_message_at": now},
                    }
                )

                return StylistReply(
                    f"✅ *Order Cancelled Successfully* 🌸\n\n"
                    f"Aapka order *#{target_order_num}* kamyabi se cancel kar diya gaya hai. ✨\n\n"
                    f"Aapke account ya card par koi charges deduct nahi huay hain. "
                    f"Agar aap hamari nayi collection dekhna chahein ya kisi aur dress ke bare mein poochna chahein, "
                    f"toh main Aria aapki khidmat ke liye hazir hoon! 👗🌿"
                )

            else:
                # Ambiguous message: unset pending cancellation so normal conversation resumes
                await db["conversations"].update_one(
                    {"_id": conv_doc["_id"]},
                    {"$unset": {"pending_order_cancellation": ""}}
                )

        # 1.2 Handle Pending Human Agent Handoff Permission Check
        if conv_doc and conv_doc.get("pending_handoff_permission"):
            words_in_msg_list = re.findall(r"\b\w+\b", lowered_msg)
            is_affirmative = any(w in words_in_msg_list for w in ["haan", "han", "yes", "ji", "jee", "bilkul", "y", "sure"]) or any(p in lowered_msg for p in ["kardo", "kar do", "kar dein", "krdo", "kr do", "assign", "connect", "please"])
            is_negative = any(w in words_in_msg_list for w in ["nahi", "nahin", "no", "cancel", "na"]) or any(p in lowered_msg for p in ["rehne do", "rehn do", "mat karo", "dont", "don't"])

            if is_affirmative:
                await db["conversations"].update_one(
                    {"_id": conv_doc["_id"]},
                    {"$set": {
                        "status": "WAITING_HUMAN",
                        "pending_handoff_permission": False,
                        "assigned_user_id": None,
                        "last_message_at": datetime.now(timezone.utc),
                    }}
                )
                return StylistReply(
                    "Shukriya! Maine aapki chat hamare Senior Human Fashion Stylist / Support team ko assign kar di hai. 🌸✨\n\n"
                    "Hamara representative jald hi yahan aapse rabta karega. Please thora intezar karein! 🤝👗"
                )
            elif is_negative:
                await db["conversations"].update_one(
                    {"_id": conv_doc["_id"]},
                    {"$set": {
                        "pending_handoff_permission": False,
                        "last_message_at": datetime.now(timezone.utc),
                    }}
                )
                return StylistReply(
                    "Koi baat nahi! 🌸 Main Aria aapki personal AI Stylist hoon, main hi aapki har tarah se madad karungi. ✨\n\n"
                    "Aap batayein, kya aap koi specific dress dekhna chahti hain ya kisi outfit ke bare mein poochna chahti hain? 👗"
                )
            else:
                await db["conversations"].update_one(
                    {"_id": conv_doc["_id"]},
                    {"$set": {"pending_handoff_permission": False}}
                )

        # 1.3 Handle Direct Human Agent Request
        handoff_triggers = ["talk to human", "human agent", "talk to agent", "connect to agent", "real person", "insan se baat", "agent se baat", "human staff"]
        if intent == "human_handoff" or any(t in lowered_msg for t in handoff_triggers):
            if conv_doc:
                await db["conversations"].update_one(
                    {"_id": conv_doc["_id"]},
                    {"$set": {
                        "status": "WAITING_HUMAN",
                        "pending_handoff_permission": False,
                        "assigned_user_id": None,
                        "last_message_at": datetime.now(timezone.utc),
                    }}
                )
            return StylistReply(
                "Ji zaroor! Maine aapki chat foran hamare Senior Boutique Human Stylist ko assign kar di hai. 🌸✨\n\n"
                "Hamara representative jald hi yahan aapse rabta karega. 🤝👗"
            )

        # 1.4 Detect Order Cancellation Request (Sends Professional Confirmation Message First)
        cancel_phrases = [
            "cancel order", "order cancel", "cancel my order", "mera order cancel",
            "order cancel karna", "order cancel krna", "order cancel kardo", "order cancel kar do",
            "order cancel kr do", "cancel karna hai", "cancel kardo", "cancel kr do",
            "cancel kar dein", "cancel this order", "i want to cancel", "order mansookh",
            "mansookh karna", "order khatam", "cancel my package", "cancel parcel",
            "order nahi chahiye", "order ni chahiye", "order cancel kro"
        ]
        has_cancel_kw = any(p in lowered_msg for p in cancel_phrases) or (
            "cancel" in lowered_msg and any(w in lowered_msg for w in ["order", "ord-", "parcel", "package", "booking", "mera"])
        )

        if has_cancel_kw:
            order_to_cancel, cancel_lookup_status = await self._find_customer_order_to_cancel(
                db, user_phone, user_message, customer_ctx
            )

            if cancel_lookup_status == "MULTIPLE_ACTIVE_ORDERS" and isinstance(order_to_cancel, list):
                orders_payload = []
                for o in order_to_cancel:
                    items = [it.get("name") for it in o.get("items", []) if it.get("name")]
                    orders_payload.append({
                        "order_id": str(o["_id"]),
                        "order_number": o["order_number"],
                        "total": o.get("total", 0.0),
                        "currency": o.get("currency", "PKR"),
                        "items": items,
                    })

                if conv_oid:
                    try:
                        await db["conversations"].update_one(
                            {"_id": conv_oid},
                            {"$set": {
                                "pending_order_cancellation": {
                                    "type": "MULTIPLE_CHOICE",
                                    "orders": orders_payload,
                                    "timestamp": datetime.now(timezone.utc),
                                },
                                "last_message_at": datetime.now(timezone.utc),
                            }}
                        )
                    except Exception:
                        pass

                num_emojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣"]
                order_cards = []
                for idx, o in enumerate(orders_payload):
                    emoji = num_emojis[idx] if idx < len(num_emojis) else f"[{idx+1}]"
                    items_str = ", ".join(o["items"]) if o["items"] else "Fashion Outfits"
                    order_cards.append(
                        f"{emoji} *Order #{o['order_number']}*\n"
                        f"   • *Item(s):* {items_str}\n"
                        f"   • *Total:* PKR {o['total']:,.2f} (COD)"
                    )
                orders_block = "\n\n".join(order_cards)

                multiple_prompt = (
                    f"⚠️ *Order Cancellation - Multiple Orders Found* 📋\n\n"
                    f"Aapke is phone number par *{len(orders_payload)} active orders* mojood hain:\n\n"
                    f"{orders_block}\n\n"
                    f"Aap kaunsa order cancel karna chahte hain?\n"
                    f"• Pehla order cancel karne ke liye *'1'* reply karein\n"
                    f"• Doosra order cancel karne ke liye *'2'* reply karein\n"
                    f"• Dono orders cancel karne ke liye *'Dono'* (ya *'Both'*) reply karein\n"
                    f"• Agar koi bhi order cancel nahi karna toh *'Nahi'* reply karein. 🌸🤝"
                )
                return StylistReply(multiple_prompt)

            elif cancel_lookup_status == "READY_TO_CANCEL" and order_to_cancel:
                # Save pending order cancellation state on conversation document
                if conv_oid:
                    try:
                        await db["conversations"].update_one(
                            {"_id": conv_oid},
                            {"$set": {
                                "pending_order_cancellation": {
                                    "type": "SINGLE",
                                    "order_id": str(order_to_cancel["_id"]),
                                    "order_number": order_to_cancel["order_number"],
                                    "total": order_to_cancel.get("total", 0.0),
                                    "timestamp": datetime.now(timezone.utc),
                                },
                                "last_message_at": datetime.now(timezone.utc),
                            }}
                        )
                    except Exception:
                        pass

                items_list = [it.get("name") for it in order_to_cancel.get("items", []) if it.get("name")]
                items_str = ", ".join(items_list) if items_list else "Fashion Outfits"
                ord_no = order_to_cancel["order_number"]
                ord_tot = order_to_cancel.get("total", 0.0)
                ord_curr = order_to_cancel.get("currency", "PKR")

                confirmation_prompt = (
                    f"⚠️ *Order Cancellation Confirmation* 📋\n\n"
                    f"Kya aap waqayi apna order *#{ord_no}* cancel karna chahte hain?\n\n"
                    f"📦 *Order Details:*\n"
                    f"• *Item(s):* {items_str}\n"
                    f"• *Total Payable:* PKR {ord_tot:,.2f} (COD)\n\n"
                    f"Agar aap cancel karna chahte hain toh baraye meharbani *'Haan'* reply karein.\n"
                    f"Agar order cancel nahi karna toh *'Nahi'* reply karein. 🌸🤝"
                )
                return StylistReply(confirmation_prompt)

            elif cancel_lookup_status == "ALREADY_CANCELLED" and order_to_cancel:
                ord_no = order_to_cancel.get("order_number", "")
                return StylistReply(
                    f"🌸 Aapka order *#{ord_no}* pehle se hi cancel ho chuka hai. ✨\n\n"
                    f"Is order ke koi pending charges nahi hain. Kya aap koi aur dress dekhna chahein gi? 👗"
                )

            elif cancel_lookup_status == "CANNOT_CANCEL_DISPATCHED" and order_to_cancel:
                ord_no = order_to_cancel.get("order_number", "")
                curr_status = order_to_cancel.get("status", "SHIPPED")
                return StylistReply(
                    f"📦 Aapka order *#{ord_no}* courier ke zariye *{curr_status.title()}* ho chuka hai, is liye yeh ab cancel nahi ho sakta. 🚚\n\n"
                    f"Lekin fikr na karein! Aap parcel receive hone ke baad hamari *14-day hassle-free replacement / exchange policy* use kar sakte hain. ✨\n\n"
                    f"Agar mazeed madad chahiye toh *agent* reply karein! 🤝"
                )

            elif cancel_lookup_status == "NOT_FOUND_SPECIFIC":
                return StylistReply(
                    "🔍 Maazrat, aapka diya gaya Order ID system mein nahi mil saka. "
                    "Baraye meharbani apna 12-digit Order Number (e.g. *#ORD-20261014-1250*) dobara check karke send karein. 🌸"
                )

            else:
                return StylistReply(
                    "🔍 Aapke is phone number par filhal koi active order nahi mila jo cancel kiya ja sakay. 🌸\n\n"
                    "Agar aapke paas koi specific Order Number hai (e.g. *#ORD-20261014-1250*), toh baraye meharbani share karein taake main check kar sakoon! ✨"
                )

        # 1.5 Detect Order & Courier Parcel Live Tracking Request
        tracking_phrases = [
            "kahan pohancha", "kahan pohncha", "kahan tak aya", "kahan tak pohncha",
            "kahan aya", "where is my order", "where is my parcel", "where is my package",
            "track my order", "track order", "track parcel", "track package",
            "tracking number", "tracking no", "tracking code", "tracking id",
            "consignment", "delivery status", "order status", "parcel status",
            "kab tak ayega", "kab ayega", "kab deliver hoga", "kab pohnchega",
            "kab milega", "delivery update", "dispatch status", "rider kahan",
            "tracking link", "track karo", "status check", "status batao",
            "order track", "parcel track", "check status", "order ka status"
        ]
        is_tracking_inquiry = (
            intent == "order_status"
            or any(p in lowered_msg for p in tracking_phrases)
            or (("track" in lowered_msg or "status" in lowered_msg or "kahan" in lowered_msg or "kab" in lowered_msg) and any(w in lowered_msg for w in ["order", "parcel", "package", "suit", "dress", "mera", "meri"]))
        )

        if is_tracking_inquiry:
            # 1. Look for explicit Order ID or Tracking Number in the message
            explicit_id_match = re.search(
                r"(ORD-\d{8}-\d{4}|ORD\d+|#ORD[\w-]+|TRX-\d{8}-\d{4}|TCS-\d{8}-\d{4}|LP-\d{8}-\d{4}|PEX-\d{8}-\d{4}|BLX-\d{8}-\d{4})",
                user_message.upper(),
            )
            found_order = None

            if explicit_id_match:
                extracted_id = explicit_id_match.group(1).replace("#", "").strip()
                found_order = await db["orders"].find_one({
                    "$or": [
                        {"order_number": {"$regex": f"^{extracted_id}$", "$options": "i"}},
                        {"tracking_number": {"$regex": f"^{extracted_id}$", "$options": "i"}},
                        {"order_number": extracted_id},
                        {"tracking_number": extracted_id},
                    ]
                })

            # 2. If not matched explicitly, lookup by user phone or customer id
            if not found_order:
                clean_phone = user_phone.replace("+", "").replace(" ", "").replace("-", "")
                cust_id = customer_ctx.get("customer_id")
                cust_query_ids = [cust_id]
                if cust_id and ObjectId.is_valid(cust_id):
                    cust_query_ids.append(ObjectId(cust_id))

                order_cursor = db["orders"].find({
                    "$or": [
                        {"customer_id": {"$in": cust_query_ids}},
                        {"address_snapshot.phone": user_phone},
                        {"address_snapshot.phone": clean_phone},
                        {"address_snapshot.phone": f"+{clean_phone}"},
                    ]
                }).sort("created_at", -1).limit(1)

                orders_found = [o async for o in order_cursor]
                if orders_found:
                    found_order = orders_found[0]

            # 3. If Order is resolved, build rich courier & tracking response
            if found_order:
                ord_no = found_order.get("order_number")
                ord_status = str(found_order.get("status", "PENDING")).upper()
                courier_name = found_order.get("courier_partner") or "Trax Logistics"
                tracking_num = found_order.get("tracking_number") or "N/A"
                tracking_url = found_order.get("tracking_url") or f"https://track.trax.pk/tracking?cn={tracking_num}"
                total_val = float(found_order.get("total", 0.0))
                currency_code = found_order.get("currency", "USD")
                addr_data = found_order.get("address_snapshot", {}) or {}
                dest_city = addr_data.get("city", "Customer City")
                items = found_order.get("items", [])
                items_desc = "\n".join([f"• {it.get('quantity', 1)}x {it.get('name', 'Designer Dress')}" for it in items])
                first_img = next((it.get("image_url") for it in items if it.get("image_url")), None)

                from integrations.courier_service import courier_service
                est_delivery = found_order.get("estimated_delivery") or courier_service.calculate_estimated_delivery(dest_city)

                if ord_status in ["SHIPPED", "IN_TRANSIT"]:
                    reply_msg = (
                        f"🚚 *Live Order & Courier Tracking* 📦✨\n\n"
                        f"Assalam-o-Alaikum! Aapka order *#{ord_no}* express courier partner *{courier_name}* ke hawale kar diya gaya hai aur delivery ke liye rawanah ho chuka hai! 🌸\n\n"
                        f"📋 *Consignment Details:*\n"
                        f"• *Courier Partner:* {courier_name} 🚚\n"
                        f"• *Tracking / AWB Number:* *{tracking_num}*\n"
                        f"• *Current Status:* In Transit to {dest_city} Logistics Hub 📍\n"
                        f"• *Estimated Delivery:* {est_delivery} ⏳\n"
                        f"• *Total Payable on Delivery:* PKR {total_val:,.2f} (COD)\n\n"
                        f"👗 *Items in Parcel:*\n{items_desc}\n\n"
                        f"🌐 *Courier Tracking Link:*\n{tracking_url}\n\n"
                        f"🛍️ *Live Storefront & Catalog:*\n{settings.STOREFRONT_URL}\n\n"
                        f"📌 *Note:* Courier rider parcel deliver karne se pehle aapse call par rabta karega. Baraye meharbani apna phone active rakhein! 📞✨"
                    )
                    return StylistReply(reply_msg, image_url=first_img)

                elif ord_status == "OUT_FOR_DELIVERY":
                    reply_msg = (
                        f"🛵 *Your Parcel is Out for Delivery Today!* 📦✨\n\n"
                        f"Good news! Aapka order *#{ord_no}* ({courier_name}) aaj deliver karne ke liye courier delivery rider ke hawale kar diya gaya hai! 🚚\n\n"
                        f"• *Tracking Number:* *{tracking_num}*\n"
                        f"• *Destination:* {dest_city}\n"
                        f"• *Cash to Pay Rider:* PKR {total_val:,.2f} (COD)\n\n"
                        f"Rider jald hi door-step par pohnch kar call karega. Baraye meharbani phone active rakhein! 🌸📞\n\n"
                        f"🛍️ *Store Website & Catalog:* {settings.STOREFRONT_URL}"
                    )
                    return StylistReply(reply_msg, image_url=first_img)

                elif ord_status in ["CONFIRMED", "PROCESSING", "PENDING"]:
                    reply_msg = (
                        f"📋 *Order Status: In Preparation* ✨\n\n"
                        f"Aapka order *#{ord_no}* confirm ho chuka hai aur hamari atelier team is waqt packaging & quality inspection kar rahi hai. 👗🌸\n\n"
                        f"📦 *Ordered Items:*\n{items_desc}\n\n"
                        f"🚚 *Estimated Courier Dispatch:* Aaj shaam ya kal subah parcel courier rider ko handover kar diya jayega.\n"
                        f"Jaise hi parcel courier rider ke hawale hoga, hum aapko live Tracking Number aur Tracking Link WhatsApp par bhej dein gay! 🚚✨\n\n"
                        f"🛍️ *Explore More Designs on Website:*\n{settings.STOREFRONT_URL}"
                    )
                    return StylistReply(reply_msg, image_url=first_img)

                elif ord_status == "DELIVERED":
                    reply_msg = (
                        f"🎉 *Order Delivered!* 🌸✨\n\n"
                        f"Aapka order *#{ord_no}* hamare courier partner ne kamyabi se deliver kar diya hai. ❤️\n\n"
                        f"• *Tracking Number:* *{tracking_num}* ({courier_name})\n\n"
                        f"Luxe Atelier par shopping karne ka shukriya! Agar size, color ya replacement ke hawalay se koi exchange chahiye toh batayein, hamari *14-day exchange policy* mojood hai! 👗🛍️\n\n"
                        f"🛍️ *Explore Our Latest Arrivals & Fresh Designs:*\n{settings.STOREFRONT_URL}"
                    )
                    return StylistReply(reply_msg, image_url=first_img)

                elif ord_status == "CANCELLED":
                    reply_msg = (
                        f"❌ Aapka order *#{ord_no}* cancel ho chuka hai.\n\n"
                        f"Is order ke koi pending charges nahi hain. Agar aap hamari nayi collection dekhna chahein ya naya order place karna chahein toh batayein! 👗🌸\n\n"
                        f"🛍️ *Browse Complete Collection Online:*\n{settings.STOREFRONT_URL}"
                    )
                    return StylistReply(reply_msg)

            # 4. If no order found at all
            return StylistReply(
                "🔍 Maazrat, aapke is phone number par filhal koi active order ya parcel nahi mila. 🌸\n\n"
                "Agar aapke paas koi specific Order Number (e.g. *#ORD-20261014-1250*) ya Courier Tracking Number (e.g. *TRX-20261014-9841*) hai, toh baraye meharbani share karein taake main foran live status check kar sakoon! ✨\n\n"
                f"🛍️ *Aap hamari website par bhee direct collection dekh saktay hain:*\n{settings.STOREFRONT_URL}"
            )

        # 1.6 Check Product Variant & Stock Availability Inquiry (Sizes, Colors, Stock)
        variant_inquiry_reply = await variant_handler.handle_product_variant_inquiry(
            db, user_message, lowered_msg, customer_ctx, conv_oid
        )
        if variant_inquiry_reply:
            return variant_inquiry_reply

        # 2. Check Order Placement / Conversational Checkout Initiation
        order_action_reply = await checkout_handler.start_or_continue_checkout(
            db, user_phone, user_message, intent, customer_ctx, catalog_ctx, conv_doc, conv_oid
        )
        if order_action_reply:
            return order_action_reply

        # 3. Check if user provided their email address in chat
        email_pattern = r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"
        email_match = re.search(email_pattern, user_message)
        if email_match and not (intent == "place_order" and ("address" in user_message.lower() or "house" in user_message.lower())):
            extracted_email = email_match.group(0).lower()
            clean_phone = user_phone.replace("+", "").replace(" ", "").replace("-", "")
            await db["customers"].update_one(
                {"$or": [{"phone": user_phone}, {"whatsapp_id": clean_phone}, {"phone": clean_phone}]},
                {"$set": {"email": extracted_email, "updated_at": datetime.now(timezone.utc)}},
            )
            customer_ctx["customer_email"] = extracted_email

            # Dispatch personalized lookbook email immediately
            quick_recs = await recommendation_engine.get_personalized_recommendations(
                db, user_message="", customer_phone=user_phone, limit=3
            )
            if quick_recs:
                asyncio.create_task(
                    email_service.send_lookbook_recommendations(
                        recipient_email=extracted_email,
                        customer_name=customer_ctx.get("customer_name", "Valued Shopper"),
                        products=quick_recs,
                        promo_code="VIPSTYLE10",
                        discount_percent=10,
                    )
                )

            top_img = quick_recs[0].get("image_url") if quick_recs else None
            email_ack_text = (
                f"💌 Thank you so much! ✨\n\n"
                f"Maine hamara exclusive Curated Style Lookbook aur 10% VIP Discount Voucher (Code: VIPSTYLE10) aapke email {extracted_email} par send kar diya hai! 📧\n\n"
                f"Aap apna inbox check kar sakti hain. In the meantime, kya aap kisi specific event ya style ke liye outfits dekhna chahein gi? 👗🌿"
            )
            return StylistReply(email_ack_text, image_url=None)

        # 4. Check direct Order ID match if present
        order_match = re.search(r"(ORD-\d{8}-\d{4}|ORD\d+|#ORD\w+)", user_message.upper())
        if order_match:
            extracted_no = order_match.group(1).replace("#", "")
            order = await db["orders"].find_one({"order_number": {"$regex": extracted_no, "$options": "i"}})
            if order:
                customer_ctx["recent_orders"].insert(0, {
                    "order_number": order.get("order_number"),
                    "status": order.get("status"),
                    "total": order.get("total"),
                    "currency": order.get("currency", "PKR"),
                    "item_count": len(order.get("items", [])),
                })

        # 5. Detect Styling & Fresh Dress Request
        fresh_triggers = [
            "koi aur", "koi or", "kuch aur", "kuch or", "new dress", "naya dress", "naye dress",
            "different", "another", "koi doosra", "koi doosri", "change", "next", "aur dikhao",
            "or dikhao", "kuch naya", "other options", "more options", "koi or address", "koi aur address",
            "aur dress", "or dress", "koi or disgn", "koi aur design", "show another", "show more"
        ]
        variant_terms = ["color", "colour", "rang", "size", "sizes", "measurement", "stock", "shade", "shades"]
        has_variant_term = any(vt in lowered_msg for vt in variant_terms)
        is_fresh_request = any(t in lowered_msg for t in fresh_triggers) and not has_variant_term

        # Collect previously seen product IDs to prevent repeating
        seen_pids = []
        if conv_doc and conv_doc.get("seen_product_ids"):
            seen_pids.extend([str(pid) for pid in conv_doc["seen_product_ids"]])
        if customer_ctx.get("active_product_id"):
            seen_pids.append(str(customer_ctx["active_product_id"]))
        seen_pids = list(dict.fromkeys(seen_pids))

        entities = recommendation_engine.extract_fashion_entities(user_message)
        styling_triggers = [
            "stylish", "style", "recommend", "recommendation", "suggestion", "best", "options",
            "collection", "outfit", "show me", "clothes", "dress", "kurti", "suit", "lookbook",
            "trending", "what do you have", "kuch dikhao", "dikhao", "fashion", "party wear", "wedding", "glam"
        ]

        referenced_product = None
        all_active_cursor = db["products"].find({"is_active": True})
        all_active_prods = [p async for p in all_active_cursor]

        if not is_fresh_request:
            # 1. Direct match across all 301+ active products in the store
            matched_prod_doc, match_type = self._find_product_in_catalog(all_active_prods, user_message)
            if matched_prod_doc:
                referenced_product = await self._format_product_detail(db, matched_prod_doc)
                customer_ctx["active_product_id"] = str(matched_prod_doc["_id"])
                customer_ctx["active_product_name"] = matched_prod_doc["name"]
                if conv_oid:
                    try:
                        await db["conversations"].update_one(
                            {"_id": conv_oid},
                            {"$set": {
                                "active_product_id": str(matched_prod_doc["_id"]),
                                "active_product_name": matched_prod_doc["name"],
                                "last_message_at": datetime.now(timezone.utc),
                            }}
                        )
                    except Exception:
                        pass

            # 2. Only fallback to existing active_product_id if this message is a follow-up inquiry about it
            if not referenced_product and customer_ctx.get("active_product_id"):
                followup_words = [
                    "color", "colors", "colour", "size", "sizes", "price", "kitne", "kitna",
                    "delivery", "available", "hai", "hain", "large", "medium", "small", "xl",
                    "order", "book", "reserve", "photo", "pic", "picture", "fabric", "material",
                    "yeh", "ye", "isme", "is me", "iska", "iski", "isko", "details", "info"
                ]
                msg_words = set(re.findall(r"\b\w+\b", lowered_msg))
                is_followup = any(w in msg_words for w in followup_words) or len(msg_words) <= 3
                if is_followup:
                    act_pid = str(customer_ctx["active_product_id"])
                    for p in all_active_prods:
                        if str(p["_id"]) == act_pid:
                            referenced_product = await self._format_product_detail(db, p)
                            break
        else:
            # Clear active product anchor on fresh request so previous product is completely avoided
            customer_ctx["active_product_id"] = None
            customer_ctx["active_product_name"] = None

        color_or_detail_query = any(w in lowered_msg for w in ["color", "colors", "colour", "rang", "available", "sizes", "size", "isme", "is me"])

        is_styling_query = (
            is_fresh_request
            or bool(referenced_product)
            or color_or_detail_query
            or bool(entities.get("categories") or entities.get("colors") or 
                 entities.get("fabrics") or entities.get("occasions") or 
                 entities.get("styles"))
            or any(t in lowered_msg for t in styling_triggers)
            or intent in ["browse_catalog", "styling_advice"]
        )

        recommended_products: List[Dict[str, Any]] = []
        relevant_cross_sells: List[Dict[str, Any]] = []
        conversion_nudge: Optional[str] = None
        high_intent_detected = False

        if is_styling_query or referenced_product:
            try:
                if referenced_product and not is_fresh_request:
                    target_pid = str(referenced_product["id"])
                    high_intent_info = await online_learning_engine.check_customer_high_intent(
                        db, user_phone, customer_ctx.get("customer_id"), target_pid
                    )
                    high_intent_detected = high_intent_info.get("high_intent", False)

                    # Online Learning: Log interaction
                    asyncio.create_task(
                        online_learning_engine.record_interaction(
                            db=db,
                            event_type="repeat_inquiry" if high_intent_detected else "stylist_inquiry",
                            product_id=target_pid,
                            customer_phone=user_phone,
                            customer_id=customer_ctx.get("customer_id"),
                        )
                    )

                    # Fetch relevant complementary pieces specifically for this product
                    relevant_cross_sells = await recommendation_engine.get_relevant_and_cross_sell_products(
                        db, target_pid, user_phone, customer_ctx.get("customer_id"), limit=2
                    )
                    conversion_nudge = recommendation_engine.generate_conversion_nudge(
                        referenced_product["name"],
                        relevant_cross_sells,
                        inquiry_count=high_intent_info.get("inquiry_count", 0) + 1,
                    )
                    # Include referenced product at top of recommendations
                    recommended_products = [referenced_product] + relevant_cross_sells
                else:
                    recommended_products = await recommendation_engine.get_personalized_recommendations(
                        db,
                        user_message=user_message,
                        customer_phone=user_phone,
                        customer_id=customer_ctx.get("customer_id"),
                        limit=3,
                        exclude_product_ids=seen_pids if is_fresh_request else None,
                    )
                    # Fallback if all were excluded
                    if not recommended_products and is_fresh_request:
                        recommended_products = await recommendation_engine.get_personalized_recommendations(
                            db,
                            user_message=user_message,
                            customer_phone=user_phone,
                            customer_id=customer_ctx.get("customer_id"),
                            limit=3,
                        )

                    if recommended_products:
                        relevant_cross_sells = recommended_products[1:3]
                        conversion_nudge = recommendation_engine.generate_conversion_nudge(
                            recommended_products[0]["name"],
                            relevant_cross_sells,
                            inquiry_count=1,
                        )

                # If customer email is known, trigger async background Lookbook email
                if customer_ctx.get("customer_email") and recommended_products:
                    asyncio.create_task(
                        email_service.send_lookbook_recommendations(
                            recipient_email=customer_ctx["customer_email"],
                            customer_name=customer_ctx.get("customer_name", "Valued Shopper"),
                            products=recommended_products,
                            promo_code="VIPSTYLE10",
                            discount_percent=10,
                        )
                    )
            except Exception as rec_err:
                print(f"[WARNING] Recommendation engine lookup error: {rec_err}")

        # 6. Fast Gemini LLM response (Strict 6.5s max cap)
        try:
            gemini_reply = await self._generate_gemini_response(
                user_message=user_message,
                user_phone=user_phone,
                intent=intent,
                confidence=confidence,
                customer_ctx=customer_ctx,
                catalog_ctx=catalog_ctx,
                faq_ctx=faq_ctx,
                recommendations_ctx=recommended_products,
                cross_sells_ctx=relevant_cross_sells,
                conversion_nudge=conversion_nudge,
                is_fresh_request=is_fresh_request,
            )
            if gemini_reply:
                top_item = (referenced_product or (recommended_products[0] if recommended_products else None))
                top_img = top_item.get("image_url") if top_item else None

                # Update conversation document with new active product and track in seen_product_ids
                if top_item and conv_oid:
                    try:
                        await db["conversations"].update_one(
                            {"_id": conv_oid},
                            {
                                "$set": {
                                    "active_product_id": str(top_item.get("id")),
                                    "active_product_name": top_item.get("name"),
                                    "last_message_at": datetime.now(timezone.utc),
                                },
                                "$addToSet": {"seen_product_ids": str(top_item.get("id"))},
                            }
                        )
                    except Exception:
                        pass

                # If Gemini offered human handoff permission in reply, set pending permission
                if any(p in gemini_reply.lower() for p in ["assign kar doon", "assign kar dun", "assign kar dein", "live human"]):
                    if conv_oid:
                        try:
                            await db["conversations"].update_one(
                                {"_id": conv_oid},
                                {"$set": {"pending_handoff_permission": True}}
                            )
                        except Exception:
                            pass

                top_id = top_item.get("id") if top_item else None
                top_url = settings.get_product_url(top_id) if top_id else settings.STOREFRONT_URL
                sanitized_reply = clean_chat_reply_text(gemini_reply, product_id=top_id)
                postscript = ""
                if is_styling_query and not customer_ctx.get("customer_email"):
                    postscript = (
                        "\n\n📧 *P.S.* Agar aapko hamara complete Style Lookbook & exclusive *10% VIP discount voucher (Code: VIPSTYLE10)* "
                        "apne email par chahiye, toh bas apna Email address reply kar dein! ✨"
                    )
                return StylistReply(
                    sanitized_reply + postscript,
                    image_url=None,
                    product_action={
                        "product_id": top_item.get("id"),
                        "product_url": top_url,
                        "name": top_item.get("name"),
                        "price": top_item.get("min_price") or top_item.get("price"),
                        "colors": top_item.get("color_list") or (top_item.get("colors").split(", ") if isinstance(top_item.get("colors"), str) else top_item.get("colors")),
                        "sizes": top_item.get("size_list") or (top_item.get("sizes").split(", ") if isinstance(top_item.get("sizes"), str) else top_item.get("sizes")),
                        "variants": top_item.get("variants", []),
                    } if top_item else None,
                    relevant_products=relevant_cross_sells,
                    conversion_nudge=conversion_nudge,
                )
        except Exception as e:
            print(f"[FAST-FALLBACK] Gemini skipped ({e}), activating instant rule responder.")

        # 7. Instant Fallback Rule Engine (<5ms execution)
        fallback_res = await self._fallback_rule_response(
            db,
            user_message,
            intent,
            order_match,
            customer_ctx,
            recommended_products,
            is_styling_query,
            relevant_cross_sells=relevant_cross_sells,
            conversion_nudge=conversion_nudge,
        )

        if conv_oid and fallback_res:
            fb_prod = getattr(fallback_res, "product_action", None)
            if fb_prod and fb_prod.get("product_id"):
                try:
                    await db["conversations"].update_one(
                        {"_id": conv_oid},
                        {
                            "$set": {
                                "active_product_id": str(fb_prod["product_id"]),
                                "active_product_name": fb_prod.get("name"),
                                "last_message_at": datetime.now(timezone.utc),
                            },
                            "$addToSet": {"seen_product_ids": str(fb_prod["product_id"])},
                        }
                    )
                except Exception:
                    pass

        return fallback_res

    async def _fallback_rule_response(
        self,
        db: Any,
        user_message: str,
        intent: str,
        order_match: Optional[re.Match],
        customer_ctx: Optional[Dict[str, Any]] = None,
        recommended_products: Optional[List[Dict[str, Any]]] = None,
        is_styling_query: bool = False,
        relevant_cross_sells: Optional[List[Dict[str, Any]]] = None,
        conversion_nudge: Optional[str] = None,
    ) -> StylistReply:
        """Deterministic fallback response handler."""
        lowered = user_message.lower()

        # 0. ML Recommender Fallback if products are available
        if recommended_products and (is_styling_query or intent == "browse_catalog"):
            top = recommended_products[0]
            top_id = top.get("id") or top.get("_id")
            top_url = settings.get_product_url(top_id)
            other_lines = []
            for p in (relevant_cross_sells or recommended_products[1:]):
                p_id = p.get("id") or p.get("_id")
                p_url = settings.get_product_url(p_id)
                other_lines.append(f"• *{p['name']}* ({p.get('category', 'Fashion')}) - {p['price']}\n  🔗 {p_url}")
            other_text = "\n\n👗 *Frequently Paired & Relevant Styles:*\n" + "\n".join(other_lines) if other_lines else ""

            nudge_str = f"\n\n{conversion_nudge}" if conversion_nudge else "\n\nWould you like to reserve your size with Free Express Delivery? Reply with your size and city! 👗"
            product_url_line = f"\n🛍️ *View & Order on Website:*\n{top_url}\n"
            store_line = f"\n🛍️ *Browse Full Collection Online:*\n{settings.STOREFRONT_URL}\n"
            fallback_card = (
                f"✨ Recommended for You: {top['name']}\n\n"
                f"• Price: {top['price']} (Free Express Delivery 🚚)\n"
                f"• Sizes: {top.get('sizes')}\n"
                f"• Colors: {top.get('colors')}\n"
                f"• Fabric & Style: {top.get('description', '')[:100]}...\n"
                f"{product_url_line}"
                f"{other_text}"
                f"{store_line}"
                f"{nudge_str}"
            )
            return StylistReply(
                fallback_card,
                image_url=None,
                product_action={
                    "product_id": top_id,
                    "product_url": top_url,
                    "name": top.get("name"),
                    "price": top.get("min_price") or top.get("price"),
                    "colors": top.get("color_list") or (top.get("colors").split(", ") if isinstance(top.get("colors"), str) else top.get("colors")),
                    "sizes": top.get("size_list") or (top.get("sizes").split(", ") if isinstance(top.get("sizes"), str) else top.get("sizes")),
                    "variants": top.get("variants", []),
                },
                relevant_products=relevant_cross_sells,
                conversion_nudge=conversion_nudge,
            )

        # 1. Replacements, Exchanges & Returns Fallback
        if intent == "returns_policy" or any(w in lowered for w in ["replace", "exchange", "return", "refund"]):
            recent_order_str = ""
            if customer_ctx and customer_ctx.get("recent_orders"):
                latest_ord = customer_ctx["recent_orders"][0]
                recent_order_str = f" for your recent order *#{latest_ord['order_number']}*"
            return (
                f"🔄 *14-Day Hassle-Free Replacement & Exchange:*\n\n"
                f"We offer complimentary exchanges and returns within 14 days of delivery{recent_order_str}! ✨\n\n"
                f"• *Complimentary Pickup*: Our courier will pick up the item directly from your address.\n"
                f"• *Item Condition*: Must be unworn with original tags attached.\n"
                f"• *Next Step*: Please share your Order ID and the replacement size or item you would prefer.\n\n"
                f"Would you like to connect with a senior stylist? Simply reply *agent* anytime!"
            )

        # Check if customer is asking about colors/sizes/details of the active product currently in discussion
        color_query = any(w in lowered for w in ["color", "colors", "colour", "rang", "available", "sizes", "size", "isme", "is me"])
        if color_query and customer_ctx and (customer_ctx.get("active_product_id") or customer_ctx.get("active_product_name")):
            try:
                target_p = None
                if customer_ctx.get("active_product_id"):
                    target_p = await db["products"].find_one({"_id": ObjectId(customer_ctx["active_product_id"])})
                if not target_p and customer_ctx.get("active_product_name"):
                    target_p = await db["products"].find_one({"name": customer_ctx["active_product_name"]})
                if target_p:
                    raw_vars = await db["product_variants"].find({"product_id": str(target_p["_id"])}).to_list(length=10)
                    variants = [
                        {
                            "id": str(v.get("_id", "")),
                            "product_id": str(v.get("product_id", "")),
                            "sku": v.get("sku") or "",
                            "size": v.get("size") or "Standard",
                            "color": v.get("color") or "Default",
                            "price": float(v.get("price", 0.0)) if v.get("price") is not None else 0.0,
                            "available_quantity": int(v.get("available_quantity", 0)),
                        }
                        for v in raw_vars
                    ]
                    colors = list(dict.fromkeys(v.get("color") for v in variants if v.get("color")))
                    sizes = list(dict.fromkeys(v.get("size") for v in variants if v.get("size")))
                    prices = [v.get("price", 0.0) for v in variants if "price" in v and v.get("price")]
                    price_str = f"PKR {min(prices):,.2f}" if prices else "PKR 14,000.00"
                    prod_imgs = target_p.get("image_urls", [])
                    p_img = prod_imgs[0] if prod_imgs else "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=600&q=80"

                    colors_str = "\n".join([f"• {c}" for c in colors]) if colors else "• Standard Colors"
                    sizes_str = ", ".join(sizes) if sizes else "S, M, L"
                    target_url = settings.get_product_url(str(target_p["_id"]))

                    reply_text = (
                        f"✨ Hamari *{target_p['name']}* ({price_str}) mein yeh colors aur sizes available hain:\n\n"
                        f"🎨 *Available Colors:*\n{colors_str}\n\n"
                        f"📏 *Available Sizes:* {sizes_str}\n\n"
                        f"🌐 *View Product on Website:*\n{target_url}\n\n"
                        f"Aapko kaunsa color aur size chahiye? Main aapke liye foran reserve kar sakti hoon! 👗🌿"
                    )
                    return StylistReply(
                        reply_text,
                        image_url=None,
                        product_action={
                            "product_id": str(target_p["_id"]),
                            "product_url": target_url,
                            "name": target_p["name"],
                            "price": min(prices) if prices else 14000.0,
                            "colors": colors,
                            "sizes": sizes,
                            "variants": variants,
                        }
                    )
            except Exception as e:
                print(f"[WARNING] Active product color lookup error: {e}")

        # 2. Specific Product Lookup in Database
        try:
            cursor = db["products"].find({"is_active": True}).limit(10)
            async for prod_doc in cursor:
                p_name = prod_doc.get("name", "")
                name_words = [w.lower() for w in p_name.split() if len(w) > 3]
                if p_name.lower() in lowered or any(w in lowered for w in name_words):
                    raw_vars = await db["product_variants"].find({"product_id": str(prod_doc["_id"])}).to_list(length=10)
                    variants = [
                        {
                            "id": str(v.get("_id", "")),
                            "product_id": str(v.get("product_id", "")),
                            "sku": v.get("sku") or "",
                            "size": v.get("size") or "Standard",
                            "color": v.get("color") or "Default",
                            "price": float(v.get("price", 0.0)) if v.get("price") is not None else 0.0,
                            "available_quantity": int(v.get("available_quantity", 0)),
                        }
                        for v in raw_vars
                    ]
                    prices = [v.get("price", 0.0) for v in variants if "price" in v]
                    sizes = list(set(v.get("size", "") for v in variants if v.get("size")))
                    colors = list(set(v.get("color", "") for v in variants if v.get("color")))
                    price_str = f"PKR {min(prices):,.2f}" if prices else "PKR 14,000.00"
                    prod_url = settings.get_product_url(str(prod_doc["_id"]))
                    return StylistReply(
                        f"✨ *{prod_doc['name']}* ({prod_doc.get('category', 'Fashion')})\n\n"
                        f"• *Price*: {price_str}\n"
                        f"• *Available Sizes*: {', '.join(sizes) if sizes else 'S, M, L, XL'}\n"
                        f"• *Colors*: {', '.join(colors) if colors else 'Classic White, Sky Blue'}\n"
                        f"• *Fabric & Details*: {prod_doc.get('description', 'Crafted from premium fabric designed for all-day comfort.')}\n\n"
                        f"🌐 *View Product on Website:*\n{prod_url}\n\n"
                        f"💡 *Styling Tip*: Pairs effortlessly with relaxed chinos, tailored linen pants, or denim for an elevated casual look.\n\n"
                        f"Would you like to reserve your size or place an order today?",
                        image_url=None,
                        product_action={
                            "product_id": str(prod_doc["_id"]),
                            "product_url": prod_url,
                            "name": prod_doc["name"],
                            "price": prices[0] if prices else 14000.0,
                            "colors": colors,
                            "sizes": sizes,
                            "variants": variants,
                        },
                    )
        except Exception as e:
            print(f"[WARNING] Product lookup fallback error: {e}")

        # 3. Order Status Fallback
        if order_match or intent == "order_status":
            if order_match:
                extracted_no = order_match.group(1).replace("#", "")
                order = await db["orders"].find_one({"order_number": {"$regex": extracted_no, "$options": "i"}})
                if order:
                    status_text = order.get("status", "PROCESSING")
                    total = order.get("total", 0.0)
                    currency = order.get("currency", "PKR")
                    return (
                        f"📦 *Order Status for {order['order_number']}:*\n"
                        f"• Status: *{status_text}*\n"
                        f"• Total: {currency} {total:,.2f}\n"
                        f"• Items: {len(order.get('items', []))} item(s)\n\n"
                        f"🌐 *Track & View Live on Website:*\n{settings.STOREFRONT_URL}\n\n"
                        "Need assistance with changes or tracking? Reply *agent* anytime!"
                    )
                else:
                    return (
                        f"🔍 We couldn't find order *{extracted_no}*. Please check your order ID or reply *agent* to speak with our support desk.\n\n"
                        f"🌐 *Track Directly on Website:*\n{settings.STOREFRONT_URL}"
                    )
            else:
                return (
                    f"📦 To check your order status, please reply with your Order Number (e.g. *ORD-20261011-1001*).\n\n"
                    f"🌐 *Or Track Directly on Website:*\n{settings.STOREFRONT_URL}"
                )

        # 4. Catalog Recommendations Fallback
        if intent == "browse_catalog" or any(w in lowered for w in ["dress", "shirt", "pant", "catalog", "collection", "suit", "kurti"]):
            cursor = db["products"].find({"is_active": True}).limit(3)
            products = [doc async for doc in cursor]
            if products:
                catalog_lines = ["👗 *Trending in Our Boutique this Season:*"]
                for idx, p in enumerate(products, 1):
                    variant = await db["product_variants"].find_one({"product_id": str(p["_id"])})
                    price_str = f"PKR {variant['price']:,.2f}" if variant and "price" in variant else "Best Price"
                    p_url = settings.get_product_url(str(p["_id"]))
                    catalog_lines.append(f"{idx}. *{p['name']}* ({p['category']}) - {price_str}\n   🔗 {p_url}")
                catalog_lines.append(f"\n🛍️ *Browse Entire Luxury Collection Online:*\n{settings.STOREFRONT_URL}")
                catalog_lines.append("\nReply with the product name to see colors, sizes, or place an order!")
                return StylistReply("\n".join(catalog_lines), image_url=None)

        if intent == "size_recommendation":
            return (
                "📏 *Personalized Size Recommendation:*\n"
                "Please tell us your height, weight, or usual dress/shirt size (XS, S, M, L, XL), "
                "and whether you prefer a slim, regular, or relaxed fit!"
            )

        if intent == "human_handoff":
            return StylistReply("👩‍💼 I am transferring you to one of our human fashion stylists right away. Please hold on for a moment!")

        # Set pending handoff permission so customer can confirm with 'Haan' or 'Nahi'
        if customer_ctx and customer_ctx.get("conversation_id"):
            try:
                c_id = customer_ctx["conversation_id"]
                c_oid = ObjectId(c_id) if ObjectId.is_valid(c_id) else c_id
                await db["conversations"].update_one(
                    {"_id": c_oid},
                    {"$set": {"pending_handoff_permission": True}}
                )
            except Exception:
                pass

        return StylistReply(
            "Maazrat, mere paas is sawal ki mukammal maloomat nahi hai. 🌸\n\n"
            f"🛍️ *Aap hamari live boutique website par bhee visit kar saktay hain:*\n{settings.STOREFRONT_URL}\n\n"
            "Kya main yeh chat hamare live human boutique stylist / support agent ko assign kar doon? "
            "Aap 'Haan' ya 'Nahi' likh kar reply karein. 🤝✨"
        )


fashion_assistant = FashionAssistant()

