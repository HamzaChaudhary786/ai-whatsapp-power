import asyncio
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from bson import ObjectId
from fastapi import HTTPException

from ai.stylist_reply import StylistReply
from models.order_model import OrderCreate, OrderItem, AddressSnapshot, OrderStatus
from controllers.order_controller import OrderController
from utils.email_service import email_service
from utils.phone_utils import normalize_pakistan_phone


class CheckoutHandler:
    """Professional e-commerce conversational checkout state machine for WhatsApp AI."""

    def _extract_order_fields_from_text(
        self,
        user_message: str,
        user_phone: str,
        saved_name: Optional[str] = None,
        saved_addr: Optional[str] = None,
        saved_city: Optional[str] = None,
        saved_email: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Extracts customer name, delivery address, city, size, color, and qty from message."""
        known_cities = [
            "Sahiwal", "Lahore", "Karachi", "Islamabad", "Rawalpindi",
            "Faisalabad", "Multan", "Peshawar", "Quetta", "Sialkot", "Gujranwala",
            "Hyderabad", "Sukkur", "Bahawalpur", "Sargodha", "Abbottabad",
            "Okara", "Kasur", "Gujrat", "Jhelum", "Sheikhupura", "Mardan", "Swat",
            "Rahim Yar Khan", "Bahawalnagar", "Muzaffargarh", "Dera Ghazi Khan",
            "Mirpur", "Muzaffarabad", "Wah Cantt", "Taxila", "Chiniot", "Kamoke",
            "Hafizabad", "Mandi Bahauddin", "Khanewal", "Vehari", "Attock", "Jhang",
            "Pakpattan", "Chichawatni", "Kot Radha Kishan", "Daska", "Muridke"
        ]

        extracted_name = None
        extracted_email = saved_email
        extracted_phone = user_phone
        address_str = saved_addr
        extracted_city = saved_city
        extracted_color = None
        extracted_size = None
        extracted_qty = 1

        lines = [line.strip() for line in user_message.split("\n") if line.strip()]
        for line in lines:
            line_clean = line.replace("*", "").strip()
            if ":" in line_clean:
                k, v = line_clean.split(":", 1)
                k_low = k.strip().lower()
                v_raw = v.strip()
                v_val = re.split(r"(?:[━─═]{2,}|💡|📸|tip:|photo:|http)", v_raw, flags=re.I)[0].strip()
                if not v_val or v_val.startswith("["):
                    continue
                if "name" in k_low and "product" not in k_low:
                    extracted_name = v_val
                elif "email" in k_low:
                    extracted_email = v_val
                elif "address" in k_low or "street" in k_low or "destination" in k_low or "pata" in k_low:
                    address_str = v_val
                elif "city" in k_low or "shehar" in k_low:
                    extracted_city = v_val
                elif "color" in k_low or "colour" in k_low or "rang" in k_low:
                    extracted_color = v_val
                elif "size" in k_low:
                    extracted_size = v_val.upper()
                elif any(q_term in k_low for q_term in ["quatity", "quantity", "qty", "item", "count"]):
                    m_qty = re.search(r"\d+", v_val)
                    if m_qty:
                        extracted_qty = int(m_qty.group(0))
                elif "phone" in k_low or "mobile" in k_low or "whatsapp" in k_low:
                    extracted_phone = v_val

        field_markers = [
            ("name", re.compile(r"(?:\*?\s*(?:your\s+name|cust(?:omer)?\s+name|naam)\s*:\s*)", re.I)),
            ("phone", re.compile(r"(?:\*?\s*(?:phone(?:\s*number)?|mobile|whatsapp)\s*:\s*)", re.I)),
            ("email", re.compile(r"(?:\*?\s*email\s*:\s*)", re.I)),
            ("product_name", re.compile(r"(?:\*?\s*product(?:\s*name)?\s*:\s*)", re.I)),
            ("color", re.compile(r"(?:\*?\s*(?:product\s+color|color|colour|rang)\s*:\s*)", re.I)),
            ("size", re.compile(r"(?:\*?\s*(?:product\s+size|size|measurement)\s*:\s*)", re.I)),
            ("qty", re.compile(r"(?:\*?\s*(?:quantity|qty|item|count)\s*:\s*)", re.I)),
            ("address", re.compile(r"(?:\*?\s*(?:address|delivery\s+address|street|destination|pata)\s*:\s*)", re.I)),
            ("city", re.compile(r"(?:\*?\s*(?:city|shehar)\s*:\s*)", re.I)),
        ]

        found_spans = []
        for ftype, reg in field_markers:
            for m in reg.finditer(user_message):
                found_spans.append((m.start(), m.end(), ftype))

        found_spans.sort(key=lambda x: x[0])
        for idx, (start_idx, end_idx, ftype) in enumerate(found_spans):
            next_start = found_spans[idx + 1][0] if idx + 1 < len(found_spans) else len(user_message)
            raw_chunk = user_message[end_idx:next_start]
            chunk_lines = [l.strip().strip("*").strip() for l in raw_chunk.split("\n") if l.strip()]
            first_l = chunk_lines[0] if chunk_lines else ""
            raw_val = re.split(r"(?:[━─═]{2,}|💡|📸|tip:|photo:|http)", first_l, flags=re.I)[0].strip().strip("*").strip()
            if raw_val.startswith("[") and raw_val.endswith("]"):
                continue
            if "[" in raw_val:
                raw_val = re.sub(r'\[.*?\]', '', raw_val).strip()
            if not raw_val:
                continue

            if ftype == "name" and "product" not in raw_val.lower() and not raw_val.lower().startswith("phone"):
                extracted_name = raw_val
            elif ftype == "phone":
                m_ph = re.search(r'\+?\d[\d\s-]{7,15}', raw_val)
                if m_ph:
                    extracted_phone = m_ph.group(0).replace(" ", "")
            elif ftype == "email":
                m_em = re.search(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+', raw_val)
                if m_em:
                    extracted_email = m_em.group(0)
            elif ftype == "color":
                extracted_color = raw_val
            elif ftype == "size":
                m_sz = re.search(r'\b(XS|S|M|L|XL|XXL|EXTRA SMALL|SMALL|MEDIUM|LARGE|EXTRA LARGE)\b', raw_val, re.I)
                if m_sz:
                    extracted_size = m_sz.group(1).upper()
                else:
                    extracted_size = raw_val.split()[0].upper()
            elif ftype == "qty":
                m_q = re.search(r'\d+', raw_val)
                if m_q:
                    extracted_qty = int(m_q.group(0))
            elif ftype == "address":
                cleaned_addr = raw_val
                for _, other_reg in field_markers:
                    cleaned_addr = other_reg.sub('', cleaned_addr)
                address_str = cleaned_addr.strip().strip("*, ")
            elif ftype == "city":
                clean_c = raw_val.strip().strip("*, ")
                for kc in known_cities:
                    if kc.lower() in clean_c.lower():
                        clean_c = kc
                        break
                extracted_city = clean_c

        # Fallback email match
        if not extracted_email:
            email_match = re.search(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+', user_message)
            if email_match:
                extracted_email = email_match.group(0)

        # Fallback city match
        if not extracted_city:
            for c in known_cities:
                if re.search(r'\b' + re.escape(c) + r'\b', user_message, re.IGNORECASE):
                    extracted_city = c
                    break

        if extracted_city:
            clean_c = re.split(r"(?:[━─═]{2,}|💡|📸|tip:|photo:|http|\n)", str(extracted_city), flags=re.I)[0].strip().strip("*, ")
            for kc in known_cities:
                if kc.lower() in clean_c.lower():
                    clean_c = kc
                    break
            extracted_city = clean_c

        # Fallback name match
        if not extracted_name:
            name_patterns = [
                r"(?:my name is|name is|i am)\s*([a-zA-Z\s]{2,30})",
                r"(?:naam:?|name:?)\s*([a-zA-Z\s]{2,30})",
            ]
            for pat in name_patterns:
                m_name = re.search(pat, user_message, re.IGNORECASE)
                if m_name:
                    extracted_name = m_name.group(1).strip()
                    break

        # Fallback address detection
        address_indicators = [
            "street", "ground", "road", "house", "near", "sector", "colony", "block",
            "mohallah", "town", "floor", "apt", "flat", "st#", "h#", "bazar", "chowk", "phase",
            "gali", "makan", "pata", "address", "qasba", "village", "chak"
        ]
        if not address_str:
            for l in lines:
                l_low = l.lower()
                if any(ind in l_low for ind in address_indicators):
                    address_str = re.split(r"(?:[━─═]{2,}|💡|📸|tip:|photo:|http)", l, flags=re.I)[0].strip().strip('*, ')
                    break

        if address_str and not extracted_city:
            for kc in known_cities:
                if re.search(r'\b' + re.escape(kc) + r'\b', address_str, re.IGNORECASE):
                    extracted_city = kc
                    address_str = re.sub(rf'(?i),?\s*{re.escape(kc)}\s*$', '', address_str).strip('*, ')
                    break

        # Fallback size detection
        if not extracted_size:
            if re.search(r"\b(xs|extra\s*small)\b", user_message, re.I):
                extracted_size = "XS"
            elif re.search(r"\b(xl|extra\s*large|2xl|xxl)\b", user_message, re.I):
                extracted_size = "XL"
            elif re.search(r"\b(large|size\s*l|\bl\b)\b", user_message, re.I):
                extracted_size = "L"
            elif re.search(r"\b(medium|size\s*m|\bm\b)\b", user_message, re.I):
                extracted_size = "M"
            elif re.search(r"\b(small|size\s*s|\bs\b)\b", user_message, re.I):
                extracted_size = "S"

        # Quantity detection
        m_q = re.search(r"(\d+)\s*(?:item|piece|suit|dress|shirt|tem|qty)", user_message.lower())
        if m_q:
            extracted_qty = int(m_q.group(1))

        return {
            "name": extracted_name or saved_name,
            "email": extracted_email or saved_email,
            "phone": extracted_phone or user_phone,
            "address": address_str or saved_addr,
            "city": extracted_city or saved_city,
            "color": extracted_color,
            "size": extracted_size,
            "qty": extracted_qty,
        }

    def _render_order_review_card(self, session: Dict[str, Any]) -> str:
        """Renders the professional e-commerce Itemized Order Summary Card with confirmation call to action."""
        prod_name = session.get("product_name", "Fashion Outfit")
        prod_img = session.get("product_image", "")
        size = session.get("selected_size", "Standard")
        color = session.get("selected_color", "Standard")
        qty = session.get("quantity", 1)
        price = session.get("unit_price", 0.0)
        total = session.get("total", price * qty)
        name = session.get("customer_name") or "Valued Customer"
        phone = session.get("customer_phone", "")
        addr = session.get("street_address", "Delivery Address")
        city = session.get("city", "City")
        photo_line = f"\n\n📸 *Product Photo:* {prod_img}" if prod_img else ""

        return (
            f"🛍️ *ORDER REVIEW & CONFIRMATION* 📋✨\n"
            f"━━━━━━━━━━━━━━━━━━━━\n"
            f"👗 *Product:* {prod_name}\n"
            f"📏 *Size:* {size}\n"
            f"🎨 *Color:* {color}\n"
            f"🔢 *Quantity:* {qty} Piece(s)\n"
            f"💵 *Item Price:* PKR {price:,.2f}\n"
            f"🚚 *Delivery Charges:* FREE (Complimentary Express)\n"
            f"💰 *Total Payable (COD):* PKR {total:,.2f}\n\n"
            f"📍 *Delivery Destination:*\n"
            f"👤 *Recipient:* {name}\n"
            f"📱 *Phone:* {phone}\n"
            f"🏠 *Address:* {addr}, {city}\n"
            f"💵 *Payment Method:* Cash on Delivery (COD)\n"
            f"━━━━━━━━━━━━━━━━━━━━{photo_line}\n\n"
            f"👉 Order book karne ke liye *'CONFIRM'* (ya *'HAAN'*) reply karein!\n"
            f"*(Size/Address change karne ke liye naya size ya address share karein, ya cancel karne ke liye 'CANCEL' reply karein)* 🌸📦"
        )

    async def handle_active_checkout_session(
        self,
        db: Any,
        conv_doc: Dict[str, Any],
        user_phone: str,
        user_message: str,
        lowered_msg: str,
        words_in_msg: set,
        customer_ctx: Dict[str, Any],
    ) -> Optional[StylistReply]:
        """State machine for multi-turn conversational checkout: AWAITING_VARIANT -> AWAITING_ADDRESS -> AWAITING_CONFIRMATION."""
        session = conv_doc.get("checkout_session", {})
        step = session.get("step")
        if not step:
            return None

        # 1. Cancellation Check
        cancel_words = {"cancel", "nahi", "nahin", "no", "stop", "rehne", "rehn", "mat"}
        is_cancel = bool(words_in_msg.intersection(cancel_words)) or any(
            p in lowered_msg for p in [
                "order cancel", "cancel order", "cancel kardo", "cancel krdo",
                "rehne do", "rehn de", "nahi chahiye", "mat karo", "cancel this", "order ni chahiye"
            ]
        )
        if is_cancel:
            await db["conversations"].update_one(
                {"_id": conv_doc["_id"]},
                {
                    "$unset": {"checkout_session": ""},
                    "$set": {"last_message_at": datetime.now(timezone.utc)}
                }
            )
            return StylistReply(
                "🌸 Theek hai, order booking cancel kar di gayi hai. Koi baat nahi! ✨\n\n"
                "Agar aap koi doosri dress dekhna chahein ya koi sawal poochna chahein, toh main Aria hazir hoon! 👗🌿"
            )

        target_pid = session.get("product_id")
        raw_variants = await db["product_variants"].find({"product_id": str(target_pid)}).to_list(length=10) if target_pid else []
        variants = [
            {
                "id": str(v.get("_id", "")),
                "_id": str(v.get("_id", "")),
                "sku": v.get("sku", ""),
                "size": v.get("size", "Standard"),
                "color": v.get("color", "Default"),
                "price": float(v.get("price", 0.0)) if v.get("price") is not None else 0.0,
                "available_quantity": int(v.get("available_quantity", 0)),
            }
            for v in raw_variants
        ]
        all_sizes = list(dict.fromkeys(v.get("size") for v in variants if v.get("size")))
        all_colors = list(dict.fromkeys(v.get("color") for v in variants if v.get("color")))

        # =====================================================================
        # STATE A: AWAITING_VARIANT
        # =====================================================================
        if step == "AWAITING_VARIANT":
            detected_size = None
            if re.search(r"\b(xs|extra\s*small)\b", lowered_msg):
                detected_size = "XS"
            elif re.search(r"\b(xl|extra\s*large|2xl|xxl)\b", lowered_msg):
                detected_size = "XL"
            elif re.search(r"\b(m|medium|med)\b", lowered_msg):
                detected_size = "M"
            elif re.search(r"\b(l|large)\b", lowered_msg):
                detected_size = "L"
            elif re.search(r"\b(s|small)\b", lowered_msg):
                detected_size = "S"

            detected_color = None
            for col in all_colors:
                if col.lower() in lowered_msg:
                    detected_color = col
                    break

            if detected_size:
                session["selected_size"] = detected_size
                matching_var = None
                for v in variants:
                    if v.get("size", "").upper() == detected_size.upper():
                        if not detected_color or v.get("color", "").lower() == detected_color.lower():
                            matching_var = v
                            break
                if not matching_var and variants:
                    for v in variants:
                        if v.get("size", "").upper() == detected_size.upper():
                            matching_var = v
                            break

                if matching_var:
                    if matching_var.get("available_quantity", 0) <= 0:
                        in_stock_sizes = [v.get("size") for v in variants if v.get("available_quantity", 0) > 0]
                        return StylistReply(
                            f"⚠️ Maazrat! Hamari *{session.get('product_name')}* mein *{detected_size}* size is waqt out of stock hai. 🌸\n\n"
                            f"Hamare paas yeh sizes abhi available hain: *{', '.join(in_stock_sizes)}*.\n\n"
                            f"Aap in mein se kaunsa size lena chahein gay? 📏"
                        )
                    session["unit_price"] = float(matching_var.get("price") or session.get("unit_price", 0.0))
                    session["subtotal"] = session["unit_price"] * session.get("quantity", 1)
                    session["total"] = session["subtotal"]
                    session["variant_id"] = str(matching_var.get("id") or matching_var.get("_id") or "")
                    session["sku"] = matching_var.get("sku", "")
                    if matching_var.get("color") and not session.get("selected_color"):
                        session["selected_color"] = matching_var.get("color")

            if detected_color and not session.get("selected_color"):
                session["selected_color"] = detected_color

            size_needed = len(all_sizes) > 1 and not session.get("selected_size")
            color_needed = len(all_colors) > 1 and not session.get("selected_color")

            if size_needed:
                return StylistReply(
                    f"Baraye meharbani apna *Size* muntakhib karein: *{', '.join(all_sizes)}*. 📏\n"
                    f"Aapko kaunsa size chahiye? (Reply: S, M, L, ya XL) ✨"
                )
            if color_needed:
                return StylistReply(
                    f"Aapka size *{session.get('selected_size')}* note ho gaya hai! Baraye meharbani apna *Color* choose karein: *{', '.join(all_colors)}*. 🎨\n"
                    f"Aapko kaunsa color chahiye? ✨"
                )

            if not session.get("selected_size") and all_sizes:
                session["selected_size"] = all_sizes[0]
            if not session.get("selected_color") and all_colors:
                session["selected_color"] = all_colors[0]

            has_complete_address = bool(session.get("street_address") and session.get("city"))
            if not has_complete_address:
                session["step"] = "AWAITING_ADDRESS"
                session["updated_at"] = datetime.now(timezone.utc)
                await db["conversations"].update_one(
                    {"_id": conv_doc["_id"]},
                    {"$set": {"checkout_session": session, "last_message_at": datetime.now(timezone.utc)}}
                )
                return StylistReply(
                    f"Zabardast! Aapka *{session.get('product_name')}* (Size: *{session.get('selected_size')}*, Color: *{session.get('selected_color')}*) select ho gaya hai. 👗✨\n\n"
                    f"Free Express Delivery 🚚 ke liye baraye meharbani apni delivery details send karein:\n\n"
                    f"📝 *Delivery Details:*\n"
                    f"• *Full Name:* [Aapka Naam]\n"
                    f"• *Delivery Address:* [House/Street #, Area]\n"
                    f"• *City:* [Shehar ka Naam]"
                )

            session["step"] = "AWAITING_CONFIRMATION"
            session["updated_at"] = datetime.now(timezone.utc)
            await db["conversations"].update_one(
                {"_id": conv_doc["_id"]},
                {"$set": {"checkout_session": session, "last_message_at": datetime.now(timezone.utc)}}
            )
            review_text = self._render_order_review_card(session)
            return StylistReply(review_text, image_url=session.get("product_image"))

        # =====================================================================
        # STATE B: AWAITING_ADDRESS
        # =====================================================================
        elif step == "AWAITING_ADDRESS":
            extracted = self._extract_order_fields_from_text(
                user_message, user_phone,
                saved_name=session.get("customer_name"),
                saved_addr=session.get("street_address"),
                saved_city=session.get("city"),
                saved_email=session.get("customer_email"),
            )
            if extracted.get("address") and extracted.get("city"):
                session["street_address"] = extracted["address"]
                session["city"] = extracted["city"]
                if extracted.get("name"):
                    session["customer_name"] = extracted["name"]
                if extracted.get("email"):
                    session["customer_email"] = extracted["email"]
                session["step"] = "AWAITING_CONFIRMATION"
                session["updated_at"] = datetime.now(timezone.utc)
                await db["conversations"].update_one(
                    {"_id": conv_doc["_id"]},
                    {"$set": {"checkout_session": session, "last_message_at": datetime.now(timezone.utc)}}
                )
                review_text = self._render_order_review_card(session)
                return StylistReply(review_text, image_url=session.get("product_image"))
            else:
                return StylistReply(
                    f"Aapki address details complete nahi hain. 🌸\n\n"
                    f"Baraye meharbani apna complete delivery address aur shehar (city) send karein taake hum aapka parcel book kar sakein! 🚚📦\n\n"
                    f"Format: *[House / Street #, Area, City]*"
                )

        # =====================================================================
        # STATE C: AWAITING_CONFIRMATION
        # =====================================================================
        elif step == "AWAITING_CONFIRMATION":
            affirmative_words = {"confirm", "haan", "han", "yes", "ji", "jee", "ok", "theek", "thik", "bilkul", "sure", "y", "pls", "please"}
            is_affirmative = bool(words_in_msg.intersection(affirmative_words)) or any(
                p in lowered_msg for p in [
                    "kar do", "kardo", "kr do", "krdo", "book kar do", "book krdo", "order kar do",
                    "order kardo", "confirm kar do", "confirm kardo", "confirm order", "place order",
                    "send karo", "bhej do", "bhej dein", "deliver kar do", "deliver kardo", "haan kar do", "yes confirm"
                ]
            )

            # Check if customer wants to update address or size
            extracted_update = self._extract_order_fields_from_text(
                user_message, user_phone,
                saved_name=session.get("customer_name"),
                saved_addr=None,
                saved_city=None,
                saved_email=session.get("customer_email"),
            )
            has_new_address = bool(extracted_update.get("address") and extracted_update.get("city"))

            new_size = None
            if re.search(r"\b(xs|extra\s*small)\b", lowered_msg):
                new_size = "XS"
            elif re.search(r"\b(xl|extra\s*large|2xl|xxl)\b", lowered_msg):
                new_size = "XL"
            elif re.search(r"\b(m|medium|med)\b", lowered_msg) and "confirm" not in lowered_msg:
                new_size = "M"
            elif re.search(r"\b(l|large)\b", lowered_msg):
                new_size = "L"
            elif re.search(r"\b(s|small)\b", lowered_msg):
                new_size = "S"

            if has_new_address:
                session["street_address"] = extracted_update["address"]
                session["city"] = extracted_update["city"]
                if extracted_update.get("name"):
                    session["customer_name"] = extracted_update["name"]
                session["updated_at"] = datetime.now(timezone.utc)
                await db["conversations"].update_one(
                    {"_id": conv_doc["_id"]},
                    {"$set": {"checkout_session": session, "last_message_at": datetime.now(timezone.utc)}}
                )
                updated_review = self._render_order_review_card(session)
                return StylistReply(
                    f"✅ *Delivery Address Updated!*\n\n{updated_review}",
                    image_url=session.get("product_image")
                )

            if new_size and new_size != session.get("selected_size"):
                matching_var = next((v for v in variants if v.get("size", "").upper() == new_size.upper()), None)
                if matching_var and matching_var.get("available_quantity", 0) > 0:
                    session["selected_size"] = new_size
                    session["unit_price"] = float(matching_var.get("price") or session.get("unit_price", 0.0))
                    session["subtotal"] = session["unit_price"] * session.get("quantity", 1)
                    session["total"] = session["subtotal"]
                    session["variant_id"] = str(matching_var.get("id") or matching_var.get("_id") or "")
                    session["sku"] = matching_var.get("sku", "")
                    session["updated_at"] = datetime.now(timezone.utc)
                    await db["conversations"].update_one(
                        {"_id": conv_doc["_id"]},
                        {"$set": {"checkout_session": session, "last_message_at": datetime.now(timezone.utc)}}
                    )
                    updated_review = self._render_order_review_card(session)
                    return StylistReply(
                        f"✅ *Size Updated to {new_size}!*\n\n{updated_review}",
                        image_url=session.get("product_image")
                    )

            if is_affirmative:
                # Place live order in MongoDB only upon explicit customer confirmation!
                try:
                    norm_phone = normalize_pakistan_phone(user_phone)
                    db_customer = await db["customers"].find_one({
                        "$or": [
                            {"phone": user_phone},
                            {"whatsapp_id": user_phone},
                            {"phone": norm_phone},
                            {"whatsapp_id": norm_phone},
                        ]
                    })
                    cust_id_str = str(db_customer["_id"]) if db_customer else "guest"

                    order_payload = OrderCreate(
                        customer_id=cust_id_str,
                        items=[
                            OrderItem(
                                product_id=session["product_id"],
                                variant_id=session.get("variant_id"),
                                name=session.get("product_name", "Fashion Outfit"),
                                sku=session.get("sku") or "LUXE-DEFAULT",
                                unit_price=session.get("unit_price", 0.0),
                                quantity=session.get("quantity", 1),
                                total_price=session.get("total", 0.0),
                                image_url=session.get("product_image"),
                                color=session.get("selected_color", "Standard"),
                                size=session.get("selected_size", "M"),
                            )
                        ],
                        subtotal=session.get("subtotal", 0.0),
                        delivery_fee=session.get("delivery_fee", 0.0),
                        total=session.get("total", 0.0),
                        currency="PKR",
                        address_snapshot=AddressSnapshot(
                            full_name=session.get("customer_name") or "Valued Customer",
                            phone=session.get("customer_phone") or user_phone,
                            email=session.get("customer_email"),
                            street_address=session.get("street_address", ""),
                            city=session.get("city", ""),
                        ),
                        status=OrderStatus.PENDING,
                    )

                    created_order = await OrderController.create_order(order_payload)
                    order_num = created_order["order_number"]

                    # Update customer profile in DB
                    clean_phone = normalize_pakistan_phone(user_phone)
                    await db["customers"].update_one(
                        {"$or": [
                            {"phone": user_phone},
                            {"whatsapp_id": user_phone},
                            {"phone": clean_phone},
                            {"whatsapp_id": clean_phone},
                            {"phone": f"+{clean_phone}"},
                            {"phone": f"0{clean_phone[2:]}" if clean_phone.startswith("92") else clean_phone},
                        ]},
                        {"$set": {
                            "name": session.get("customer_name"),
                            "address": session.get("street_address"),
                            "city": session.get("city"),
                            **({"email": session.get("customer_email")} if session.get("customer_email") else {}),
                            "updated_at": datetime.now(timezone.utc),
                        }}
                    )

                    # Send email confirmation
                    if session.get("customer_email"):
                        try:
                            asyncio.create_task(
                                email_service.send_order_confirmation(
                                    recipient_email=session["customer_email"],
                                    customer_name=session.get("customer_name") or "Valued Customer",
                                    order_number=order_num,
                                    total_amount=session.get("total", 0.0),
                                    currency="PKR",
                                    items=[{
                                        "name": session.get("product_name"),
                                        "size": session.get("selected_size"),
                                        "color": session.get("selected_color"),
                                        "quantity": session.get("quantity", 1),
                                        "unit_price": session.get("unit_price", 0.0),
                                        "total_price": session.get("total", 0.0),
                                        "image_url": session.get("product_image"),
                                    }],
                                    delivery_address=f"{session.get('street_address')}, {session.get('city')}",
                                )
                            )
                        except Exception as em_err:
                            print(f"[WARNING] Async email dispatch error: {em_err}")

                    # Clear checkout_session from conversations
                    await db["conversations"].update_one(
                        {"_id": conv_doc["_id"]},
                        {
                            "$unset": {"checkout_session": ""},
                            "$set": {"last_message_at": datetime.now(timezone.utc)}
                        }
                    )

                    celebration_msg = (
                        f"🎉 *ORDER CONFIRMED & BOOKED!* 🛍️✨\n\n"
                        f"Aapka order kamyabi se confirm ho chuka hai! Hamari atelier team aapka package dispatch ke liye pack kar rahi hai. 🚚📦\n\n"
                        f"📋 *Order Confirmation Details:*\n"
                        f"━━━━━━━━━━━━━━━━━━━━\n"
                        f"🆔 *Order Number:* #{order_num}\n"
                        f"👗 *Item:* {session.get('product_name')}\n"
                        f"📏 *Size:* {session.get('selected_size')} | *Color:* {session.get('selected_color')}\n"
                        f"🔢 *Quantity:* {session.get('quantity', 1)} Piece\n"
                        f"💰 *Total Payable:* PKR {session.get('total', 0.0):,.2f} (Cash on Delivery)\n"
                        f"👤 *Customer:* {session.get('customer_name')}\n"
                        f"📍 *Delivery Destination:* {session.get('street_address')}, {session.get('city')}\n"
                        f"━━━━━━━━━━━━━━━━━━━━\n\n"
                        f"📸 *Product Photo:* {session.get('product_image')}\n\n"
                        f"Aapko WhatsApp aur Email par confirmation dispatch note send kar diya gaya hai. "
                        f"Kisi bhi waqt status check karne ke liye *'Track my order'* reply karein. "
                        f"Thank you for shopping with us! 🌸👗"
                    )

                    return StylistReply(
                        celebration_msg,
                        order_created=True,
                        order=created_order,
                        image_url=session.get("product_image"),
                    )

                except HTTPException as http_err:
                    return StylistReply(
                        f"⚠️ *Stock Notice:*\n\n"
                        f"Maazrat! {http_err.detail}\n\n"
                        f"Kya aap koi doosra size ya outfit choose karna chahein gay? 🌸👗"
                    )
                except Exception as err:
                    print(f"[ERROR] Failed to place confirmed order: {err}")
                    return StylistReply(
                        f"⚠️ Order register karte waqt masla aya. Hamari team foran isay resolve kar rahi hai. "
                        f"Aap 'Talk to staff' keh kar hamare agent se rabta kar sakte hain! 🌸🤝"
                    )

            return StylistReply(
                f"Aapka order review tayar hai! 📋✨\n\n"
                f"• *Item:* {session.get('product_name')} (Size: *{session.get('selected_size')}*, Color: *{session.get('selected_color')}*)\n"
                f"• *Total COD:* PKR {session.get('total', 0.0):,.2f}\n"
                f"• *Delivery:* {session.get('street_address')}, {session.get('city')}\n\n"
                f"👉 Order finalize karne ke liye *'CONFIRM'* ya *'HAAN'* reply karein!\n"
                f"❌ Agar order cancel karna ho toh *'CANCEL'* reply karein. 🌸"
            )

        return None

    async def start_or_continue_checkout(
        self,
        db: Any,
        user_phone: str,
        user_message: str,
        intent: str,
        customer_ctx: Dict[str, Any],
        catalog_ctx: List[Dict[str, Any]],
        conv_doc: Optional[Dict[str, Any]] = None,
        conv_oid: Optional[Any] = None,
    ) -> Optional[StylistReply]:
        """Detects order placement intent, validates product, size, and address, presenting an itemized review card before placing."""
        lowered = user_message.lower().strip()

        order_trigger_phrases = [
            "place my order", "place order", "want to place", "order this", "order now",
            "reserve my order", "reserve this", "reserve", "book my order", "buy this",
            "want to order", "confirm order", "send to my address", "place order large",
            "want large size", "want small size", "want medium size", "i want to buy",
            "order kar do", "order karo", "order krdo", "order karna hai", "order kardo",
            "book kar do", "book krdo", "buy karna hai", "kharidna hai", "mangwana hai",
            "order book karein", "order confirm karein", "bhej dein", "deliver kar dein",
            "deliver kardo", "yeh address hai", "mera address", "deliver yahan karein",
            "send to", "ship to", "parcel bhej do", "order laga do", "order book kr den",
            "order book kardo", "order krna h", "order krna hy", "address note karein"
        ]
        has_form_fields = (
            "your name" in lowered or "product name" in lowered or "delivery address" in lowered or
            ("address:" in lowered and "city:" in lowered) or
            ("name:" in lowered and "city:" in lowered) or
            ("name:" in lowered and "size:" in lowered) or
            ("address" in lowered and "sahiwal" in lowered) or
            ("jahaz ground" in lowered) or
            ("street" in lowered and "city" in lowered)
        )

        is_order_intent = (
            intent in ["place_order", "provide_address"]
            or any(p in lowered for p in order_trigger_phrases)
            or has_form_fields
        )

        if not is_order_intent:
            return None

        # Resolve Target Product
        matched_product = None
        products_cursor = db["products"].find({"is_active": True})
        all_products = [p async for p in products_cursor]

        for p in all_products:
            p_name = p.get("name", "").lower()
            if p_name in lowered:
                matched_product = p
                break

        if not matched_product and customer_ctx.get("active_product_id"):
            for p in all_products:
                if str(p["_id"]) == str(customer_ctx["active_product_id"]):
                    matched_product = p
                    break

        if not matched_product and customer_ctx.get("active_product_name"):
            act_name = customer_ctx["active_product_name"].lower()
            for p in all_products:
                if p.get("name", "").lower() == act_name:
                    matched_product = p
                    break

        if not matched_product:
            for msg_line in reversed(customer_ctx.get("recent_messages", [])):
                msg_low = msg_line.lower()
                for p in all_products:
                    if p.get("name", "").lower() in msg_low:
                        matched_product = p
                        break
                if matched_product:
                    break

        if not matched_product and all_products:
            best_score = 0
            for p in all_products:
                p_name = p.get("name", "").lower()
                name_tokens = [w for w in p_name.split() if len(w) > 3]
                score = sum(2 if re.search(rf"\b{re.escape(t)}\b", lowered) else 0 for t in name_tokens)
                if score > best_score and score >= 2:
                    best_score = score
                    matched_product = p

        if not matched_product:
            sample_prods = [p.get("name") for p in all_products[:3] if p.get("name")]
            sample_str = ", ".join(sample_prods) if sample_prods else "our featured collection"
            return StylistReply(
                f"Aap hamari collection mein se kaunsa outfit order karna chahte hain? 👗✨\n\n"
                f"• Jaise ke: *{sample_str}*\n\n"
                f"Aap outfit ka naam share karein taake main aapke liye book kar sakoon! 🌸"
            )

        if conv_oid:
            try:
                await db["conversations"].update_one(
                    {"_id": conv_oid},
                    {"$set": {
                        "active_product_id": str(matched_product["_id"]),
                        "active_product_name": matched_product["name"],
                        "last_message_at": datetime.now(timezone.utc),
                    }}
                )
            except Exception:
                pass

        raw_variants = await db["product_variants"].find({"product_id": str(matched_product["_id"])}).to_list(length=10)
        variants = [
            {
                "id": str(v.get("_id", "")),
                "_id": str(v.get("_id", "")),
                "sku": v.get("sku", ""),
                "size": v.get("size", "Standard"),
                "color": v.get("color", "Default"),
                "price": float(v.get("price", 0.0)) if v.get("price") is not None else 0.0,
                "available_quantity": int(v.get("available_quantity", 0)),
            }
            for v in raw_variants
        ]
        all_colors = list(dict.fromkeys(v.get("color") for v in variants if v.get("color")))
        all_sizes = list(dict.fromkeys(v.get("size") for v in variants if v.get("size")))
        prices = [v.get("price", 0.0) for v in variants if "price" in v and v.get("price")]
        base_price = float(prices[0]) if prices else (float(matched_product.get("price", 7990.0)) if matched_product.get("price") else 7990.0)
        prod_img = matched_product.get("image_urls", [None])[0] if matched_product.get("image_urls") else "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=600&q=80"

        norm_user_phone = normalize_pakistan_phone(user_phone)
        db_customer = await db["customers"].find_one({
            "$or": [
                {"phone": user_phone},
                {"whatsapp_id": user_phone},
                {"phone": norm_user_phone},
                {"whatsapp_id": norm_user_phone},
            ]
        })
        saved_name = db_customer.get("name") if db_customer and db_customer.get("name") and db_customer.get("name") not in ["Valued Shopper", "Storefront Guest"] else None
        saved_addr = db_customer.get("address") if db_customer else None
        saved_city = db_customer.get("city") if db_customer else None
        saved_email = db_customer.get("email") if db_customer else None

        extracted = self._extract_order_fields_from_text(
            user_message, user_phone,
            saved_name=saved_name,
            saved_addr=saved_addr,
            saved_city=saved_city,
            saved_email=saved_email,
        )

        extracted_size = extracted.get("size")
        extracted_color = extracted.get("color")
        extracted_qty = extracted.get("qty", 1)
        extracted_name = extracted.get("name") or saved_name
        address_str = extracted.get("address") or saved_addr
        extracted_city = extracted.get("city") or saved_city
        extracted_email = extracted.get("email") or saved_email

        # 1. Ask for Size if not provided and product offers multiple sizes
        if len(all_sizes) > 1 and not extracted_size:
            session_data = {
                "step": "AWAITING_VARIANT",
                "product_id": str(matched_product["_id"]),
                "product_name": matched_product["name"],
                "product_image": prod_img,
                "selected_size": None,
                "selected_color": extracted_color or (all_colors[0] if len(all_colors) == 1 else None),
                "quantity": extracted_qty,
                "unit_price": base_price,
                "subtotal": base_price * extracted_qty,
                "delivery_fee": 0.0,
                "total": base_price * extracted_qty,
                "customer_name": extracted_name,
                "customer_phone": user_phone,
                "customer_email": extracted_email,
                "street_address": address_str,
                "city": extracted_city,
                "updated_at": datetime.now(timezone.utc),
            }
            if conv_oid:
                await db["conversations"].update_one(
                    {"_id": conv_oid},
                    {"$set": {"checkout_session": session_data, "last_message_at": datetime.now(timezone.utc)}}
                )
            color_str = f"\n🎨 *Available Color:* {all_colors[0]}" if len(all_colors) == 1 else (f"\n🎨 *Available Colors:* {', '.join(all_colors)}" if all_colors else "")
            return StylistReply(
                f"🛍️ *Order Booking: {matched_product['name']}* 👗✨\n\n"
                f"• *Price:* PKR {base_price:,.2f} (Complimentary Free Express Delivery 🚚)\n"
                f"• *Payment Method:* Cash on Delivery (COD)\n\n"
                f"Baraye meharbani pehle apna *Size* muntakhib karein:\n"
                f"📏 *Available Sizes:* {', '.join(all_sizes)}{color_str}\n\n"
                f"Aapko kaunsa size chahiye? (Reply: S, M, L, ya XL) 🌸",
                image_url=prod_img
            )

        # 2. Ask for Color if not provided and product offers multiple colors
        if len(all_colors) > 1 and not extracted_color:
            session_data = {
                "step": "AWAITING_VARIANT",
                "product_id": str(matched_product["_id"]),
                "product_name": matched_product["name"],
                "product_image": prod_img,
                "selected_size": extracted_size or (all_sizes[0] if all_sizes else "M"),
                "selected_color": None,
                "quantity": extracted_qty,
                "unit_price": base_price,
                "subtotal": base_price * extracted_qty,
                "delivery_fee": 0.0,
                "total": base_price * extracted_qty,
                "customer_name": extracted_name,
                "customer_phone": user_phone,
                "customer_email": extracted_email,
                "street_address": address_str,
                "city": extracted_city,
                "updated_at": datetime.now(timezone.utc),
            }
            if conv_oid:
                await db["conversations"].update_one(
                    {"_id": conv_oid},
                    {"$set": {"checkout_session": session_data, "last_message_at": datetime.now(timezone.utc)}}
                )
            return StylistReply(
                f"🛍️ *Order Booking: {matched_product['name']}* 👗✨\n\n"
                f"Aapka size *{session_data['selected_size']}* note ho gaya hai. Baraye meharbani apna pasandeeda *Color* choose karein:\n"
                f"🎨 *Available Colors:* {', '.join(all_colors)}\n\n"
                f"Aapko kaunsa color chahiye? 🌸",
                image_url=prod_img
            )

        final_size = extracted_size or (all_sizes[0] if all_sizes else "M")
        final_color = extracted_color or (all_colors[0] if all_colors else "Standard")

        matching_var = None
        for v in variants:
            if v.get("size", "").upper() == final_size.upper():
                if v.get("color", "").lower() == final_color.lower() or final_color.lower() == "standard":
                    matching_var = v
                    break
        if not matching_var and variants:
            for v in variants:
                if v.get("size", "").upper() == final_size.upper():
                    matching_var = v
                    break
        if not matching_var and variants:
            matching_var = variants[0]

        unit_price = float(matching_var.get("price") or base_price) if matching_var else base_price
        subtotal = unit_price * extracted_qty
        total_val = subtotal

        # 3. Ask for Address if missing
        if not address_str or not extracted_city:
            session_data = {
                "step": "AWAITING_ADDRESS",
                "product_id": str(matched_product["_id"]),
                "product_name": matched_product["name"],
                "product_image": prod_img,
                "selected_size": final_size,
                "selected_color": final_color,
                "quantity": extracted_qty,
                "unit_price": unit_price,
                "subtotal": subtotal,
                "delivery_fee": 0.0,
                "total": total_val,
                "customer_name": extracted_name,
                "customer_phone": user_phone,
                "customer_email": extracted_email,
                "street_address": address_str,
                "city": extracted_city,
                "sku": matching_var.get("sku", "") if matching_var else "",
                "variant_id": str(matching_var.get("id") or matching_var.get("_id") or "") if matching_var else "",
                "updated_at": datetime.now(timezone.utc),
            }
            if conv_oid:
                await db["conversations"].update_one(
                    {"_id": conv_oid},
                    {"$set": {"checkout_session": session_data, "last_message_at": datetime.now(timezone.utc)}}
                )
            return StylistReply(
                f"Great! Aapka *{matched_product['name']}* (Size: *{final_size}*, Color: *{final_color}*) select ho gaya hai. 👗✨\n\n"
                f"Free Express Delivery 🚚 ke liye baraye meharbani apni delivery details send karein:\n\n"
                f"📝 *Delivery Details:*\n"
                f"• *Full Name:* [Aapka Naam]\n"
                f"• *Delivery Address:* [House/Street #, Area]\n"
                f"• *City:* [Shehar ka Naam]"
            )

        # 4. Both Variant and Address are ready -> Present Itemized Order Summary Card!
        session_data = {
            "step": "AWAITING_CONFIRMATION",
            "product_id": str(matched_product["_id"]),
            "product_name": matched_product["name"],
            "product_image": prod_img,
            "selected_size": final_size,
            "selected_color": final_color,
            "quantity": extracted_qty,
            "unit_price": unit_price,
            "subtotal": subtotal,
            "delivery_fee": 0.0,
            "total": total_val,
            "customer_name": extracted_name or "Valued Customer",
            "customer_phone": user_phone,
            "customer_email": extracted_email,
            "street_address": address_str,
            "city": extracted_city,
            "sku": matching_var.get("sku", "") if matching_var else "",
            "variant_id": str(matching_var.get("id") or matching_var.get("_id") or "") if matching_var else "",
            "updated_at": datetime.now(timezone.utc),
        }
        if conv_oid:
            await db["conversations"].update_one(
                {"_id": conv_oid},
                {"$set": {"checkout_session": session_data, "last_message_at": datetime.now(timezone.utc)}}
            )

        review_text = self._render_order_review_card(session_data)
        return StylistReply(review_text, image_url=prod_img)


checkout_handler = CheckoutHandler()
