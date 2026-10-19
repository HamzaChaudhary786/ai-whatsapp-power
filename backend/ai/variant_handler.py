import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from bson import ObjectId

from ai.stylist_reply import StylistReply
from config.settings import settings


class VariantInquiryHandler:
    """Specialized handler for real-time product variant, size, color, and stock inquiries."""

    def _find_product_in_catalog(self, products: List[Dict[str, Any]], raw_text: str) -> Optional[Dict[str, Any]]:
        """Matches a product from active catalog based on name or key tokens."""
        if not raw_text or not products:
            return None

        lowered = raw_text.lower().strip()
        sorted_prods = sorted(products, key=lambda p: len(p.get("name", "")), reverse=True)

        for p in sorted_prods:
            p_name = p.get("name", "").lower()
            if p_name and p_name in lowered:
                return p

        stop_words = {
            "dikhao", "dikhayein", "dikha", "chahiye", "hai", "hain", "kya", "show", "me",
            "please", "tell", "about", "price", "of", "ki", "ka", "ke", "ko", "mujhe",
            "details", "information", "info", "outfit", "options", "kuch", "aur", "or",
            "i", "want", "to", "see", "buy", "order", "karna", "krna", "send", "photo",
            "yeh", "ye", "wali", "wala", "dress", "suit", "color", "size", "stock", "available"
        }
        words = [w for w in re.findall(r"\b\w+\b", lowered) if len(w) >= 3 and w not in stop_words]
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
                return best_prod

        return None

    async def handle_product_variant_inquiry(
        self,
        db: Any,
        user_message: str,
        lowered_msg: str,
        customer_ctx: Dict[str, Any],
        conv_oid: Optional[Any],
    ) -> Optional[StylistReply]:
        """Inspects if customer is querying sizes, colors, or inventory stock for a product,
        querying live MongoDB variants and delivering clear, accurate answers.
        """
        size_keywords = ["size", "sizes", "medium", "small", "large", "xl", "xs", "measurement"]
        color_keywords = ["color", "colors", "colour", "colours", "rang", "shade", "shades"]
        stock_keywords = [
            "stock", "available", "avail", "hai", "hain", "mil jaye ga", "mil jayega",
            "pieces", "piece", "in stock", "out of stock", "mojood", "ha"
        ]

        has_size_kw = any(w in lowered_msg for w in size_keywords)
        has_color_kw = any(w in lowered_msg for w in color_keywords)
        has_stock_kw = any(w in lowered_msg for w in stock_keywords)

        is_variant_inquiry = (
            (has_size_kw and (has_stock_kw or "kya" in lowered_msg or "kaunsa" in lowered_msg or "batao" in lowered_msg or "chahiye" in lowered_msg or "ha" in lowered_msg))
            or (has_color_kw and (has_stock_kw or "koi aur" in lowered_msg or "koi or" in lowered_msg or "aur" in lowered_msg or "kya" in lowered_msg or "kaunsa" in lowered_msg or "batao" in lowered_msg or "ha" in lowered_msg))
            or ("stock" in lowered_msg and has_stock_kw)
        )

        if not is_variant_inquiry:
            return None

        # 1. Resolve Target Product
        products_cursor = db["products"].find({"is_active": True})
        all_products = [p async for p in products_cursor]
        target_product = self._find_product_in_catalog(all_products, user_message)

        if not target_product and customer_ctx.get("active_product_id"):
            for p in all_products:
                if str(p["_id"]) == str(customer_ctx["active_product_id"]):
                    target_product = p
                    break

        if not target_product and customer_ctx.get("active_product_name"):
            act_name = customer_ctx["active_product_name"].lower()
            for p in all_products:
                if p.get("name", "").lower() == act_name:
                    target_product = p
                    break

        if not target_product:
            for m in reversed(customer_ctx.get("recent_messages", [])):
                m_low = m.lower()
                for p in all_products:
                    if p.get("name", "").lower() in m_low:
                        target_product = p
                        break
                if target_product:
                    break

        if not target_product:
            return None

        # Update active product anchor
        customer_ctx["active_product_id"] = str(target_product["_id"])
        customer_ctx["active_product_name"] = target_product["name"]
        if conv_oid:
            try:
                await db["conversations"].update_one(
                    {"_id": conv_oid},
                    {"$set": {
                        "active_product_id": str(target_product["_id"]),
                        "active_product_name": target_product["name"],
                        "last_message_at": datetime.now(timezone.utc),
                    }}
                )
            except Exception:
                pass

        # 2. Fetch Live Variants from MongoDB
        raw_variants = await db["product_variants"].find({"product_id": str(target_product["_id"])}).to_list(length=20)
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
        base_price = float(prices[0]) if prices else (float(target_product.get("price", 7990.0)) if target_product.get("price") else 7990.0)
        prod_store_url = settings.get_product_url(str(target_product["_id"]))

        # 3. SPECIFIC SIZE INQUIRY (e.g., "medium size ha is product ma", "large size available hai?")
        queried_size = None
        size_label = None
        if re.search(r"\b(xs|extra\s*small)\b", lowered_msg):
            queried_size = "XS"
            size_label = "Extra Small (XS)"
        elif re.search(r"\b(xl|extra\s*large|2xl|xxl)\b", lowered_msg):
            queried_size = "XL"
            size_label = "Extra Large (XL)"
        elif re.search(r"\b(m|medium|med)\b", lowered_msg):
            queried_size = "M"
            size_label = "Medium (M)"
        elif re.search(r"\b(l|large)\b", lowered_msg):
            queried_size = "L"
            size_label = "Large (L)"
        elif re.search(r"\b(s|small)\b", lowered_msg):
            queried_size = "S"
            size_label = "Small (S)"

        if queried_size:
            matching_vars = [v for v in variants if v.get("size", "").upper() == queried_size.upper()]
            if matching_vars:
                stock_count = sum(v.get("available_quantity", 0) for v in matching_vars)
                colors_in_size = [v.get("color") for v in matching_vars if v.get("available_quantity", 0) > 0]
                unit_p = matching_vars[0].get("price", base_price)

                if stock_count > 0:
                    reply_msg = (
                        f"✨ Ji bilkul! Hamari *{target_product['name']}* mein *{size_label}* size available hai! 👗\n\n"
                        f"• *Available Stock:* {stock_count} piece(s) mojood hain\n"
                        f"• *Color(s):* {', '.join(colors_in_size) if colors_in_size else 'Standard'}\n"
                        f"• *Price:* PKR {unit_p:,.2f} (Complimentary Free Express Delivery 🚚)\n"
                        f"• *Payment:* Cash on Delivery (COD)\n\n"
                        f"🌐 *View Product on Website:*\n{prod_store_url}\n\n"
                        f"Kya aapka order *{queried_size}* size mein reserve kar doon? "
                        f"Aap bas apna delivery city batayein ya *'Place Order'* reply karein! 🌸✨"
                    )
                else:
                    other_in_stock = [v.get("size") for v in variants if v.get("available_quantity", 0) > 0]
                    reply_msg = (
                        f"⚠️ Maazrat! Hamari *{target_product['name']}* mein *{size_label}* size is waqt out of stock ho chuka hai. 🌸\n\n"
                        f"Lekin hamare paas yeh sizes abhi available hain:\n"
                        f"📏 *Available Sizes:* {', '.join(other_in_stock) if other_in_stock else 'Restocking soon'}\n\n"
                        f"🌐 *View Product on Website:*\n{prod_store_url}\n\n"
                        f"Kya aap in mein se koi size try karna chahein gay? 👗"
                    )
                return StylistReply(
                    reply_msg,
                    image_url=None,
                    product_action={
                        "product_id": str(target_product["_id"]),
                        "product_url": prod_store_url,
                        "name": target_product["name"],
                        "size": queried_size,
                        "price": unit_p,
                        "colors": all_colors,
                        "sizes": all_sizes,
                        "variants": variants,
                    }
                )

        # 4. COLOR INQUIRIES (e.g., "color koi or ha", "aur colors hain", "black color hai?")
        if has_color_kw:
            known_colors = [
                "black", "white", "red", "blue", "green", "beige", "ivory", "pink",
                "maroon", "yellow", "grey", "gray", "emerald", "sage", "navy", "brown",
                "purple", "orange", "gold", "silver"
            ]
            queried_color = None
            for kc in known_colors:
                if re.search(r"\b" + re.escape(kc) + r"\b", lowered_msg):
                    queried_color = kc
                    break

            if queried_color:
                matching_col_vars = [v for v in variants if queried_color.lower() in v.get("color", "").lower()]
                if matching_col_vars:
                    col_stock = sum(v.get("available_quantity", 0) for v in matching_col_vars)
                    col_sizes = [v.get("size") for v in matching_col_vars if v.get("available_quantity", 0) > 0]
                    actual_col_name = matching_col_vars[0].get("color")
                    if col_stock > 0:
                        reply_msg = (
                            f"✨ Ji bilkul! *{target_product['name']}* mein *{actual_col_name}* color available hai! 🎨\n\n"
                            f"• *Available Sizes:* {', '.join(col_sizes) if col_sizes else 'Standard'}\n"
                            f"• *Stock:* {col_stock} piece(s) mojood hain\n"
                            f"• *Price:* PKR {base_price:,.2f} (Complimentary Free Delivery 🚚)\n\n"
                            f"🌐 *View Product on Website:*\n{prod_store_url}\n\n"
                            f"Kya main yeh color aapke liye reserve kar doon? 👗✨"
                        )
                    else:
                        reply_msg = (
                            f"⚠️ Maazrat! *{target_product['name']}* mein *{actual_col_name}* color is waqt out of stock hai. 🌸\n\n"
                            f"Hamare paas yeh colors available hain: *{', '.join(all_colors)}*. ✨\n\n"
                            f"🌐 *View Product on Website:*\n{prod_store_url}"
                        )
                else:
                    reply_msg = (
                        f"Maazrat! Hamari *{target_product['name']}* mein *{queried_color.title()}* color offer nahi hota. ✨\n\n"
                        f"Yeh outfit in colors mein available hai:\n"
                        f"🎨 *Available Colors:* {', '.join(all_colors)}\n\n"
                        f"🌐 *View Product on Website:*\n{prod_store_url}\n\n"
                        f"Agar aapko *{queried_color.title()}* color mein hi outfit dekhna hai toh batayein, main aapko hamari doosri stunning collection dikha sakti hoon! 🌸👗"
                    )
                return StylistReply(
                    reply_msg,
                    image_url=None,
                    product_action={
                        "product_id": str(target_product["_id"]),
                        "product_url": prod_store_url,
                        "name": target_product["name"],
                        "price": base_price,
                        "colors": all_colors,
                        "sizes": all_sizes,
                        "variants": variants,
                    }
                )

            # General color inquiry (e.g. "color koi or ha", "aur colors hain?")
            if len(all_colors) <= 1:
                single_col = all_colors[0] if all_colors else "Natural"
                reply_msg = (
                    f"✨ *{target_product['name']}* is exclusive design mein sirf *{single_col}* color mein aati hai. 🌿\n\n"
                    f"• *Available Sizes:* {', '.join(all_sizes) if all_sizes else 'S, M, L, XL'}\n"
                    f"• *Price:* PKR {base_price:,.2f} (Free Express Delivery 🚚)\n"
                    f"• *Payment:* Cash on Delivery (COD)\n\n"
                    f"🌐 *View Product on Website:*\n{prod_store_url}\n\n"
                    f"Agar aap koi aur color (e.g. Black, Sage Green, Ivory, Emerald) dekhna chahte hain, toh batayein! Main aapko hamari collection mein se similar styles dikha sakti hoon. 👗🌸"
                )
            else:
                col_lines = []
                for c in all_colors:
                    c_sizes = [v.get("size") for v in variants if v.get("color", "").lower() == c.lower() and v.get("available_quantity", 0) > 0]
                    col_lines.append(f"• *{c}* (Sizes: {', '.join(c_sizes) if c_sizes else 'In stock'})")
                reply_msg = (
                    f"✨ Hamari *{target_product['name']}* mein yeh colors available hain:\n\n"
                    f"🎨 *Available Colors:*\n" + "\n".join(col_lines) + f"\n\n"
                    f"• *Price:* PKR {base_price:,.2f} (Free Express Delivery 🚚)\n"
                    f"• *Payment:* Cash on Delivery (COD)\n\n"
                    f"🌐 *View Product on Website:*\n{prod_store_url}\n\n"
                    f"Aapko kaunsa color pasand hai? Main aapke liye foran reserve kar sakti hoon! 👗✨"
                )
            return StylistReply(
                reply_msg,
                image_url=None,
                product_action={
                    "product_id": str(target_product["_id"]),
                    "product_url": prod_store_url,
                    "name": target_product["name"],
                    "price": base_price,
                    "colors": all_colors,
                    "sizes": all_sizes,
                    "variants": variants,
                }
            )

        # 5. GENERAL SIZES OR STOCK INQUIRY (e.g., "sizes kya hain", "stock kitna hai", "available hai?")
        sizes_in_stock = [v.get("size") for v in variants if v.get("available_quantity", 0) > 0]
        total_units = sum(v.get("available_quantity", 0) for v in variants)
        reply_msg = (
            f"✨ Hamari *{target_product['name']}* bilkul in stock hai! 👗\n\n"
            f"📏 *Available Sizes:* {', '.join(sizes_in_stock) if sizes_in_stock else ', '.join(all_sizes)}\n"
            f"🎨 *Available Colors:* {', '.join(all_colors)}\n"
            f"📦 *Total Stock:* {total_units} pieces mojood hain\n"
            f"💵 *Price:* PKR {base_price:,.2f} (Complimentary Free Express Delivery 🚚)\n"
            f"💵 *Payment Method:* Cash on Delivery (COD)\n\n"
            f"🌐 *View Product on Website:*\n{prod_store_url}\n\n"
            f"Aapko kaunsa size aur color chahiye? Main aapka order prepare kar sakti hoon! 🌸"
        )
        return StylistReply(
            reply_msg,
            image_url=None,
            product_action={
                "product_id": str(target_product["_id"]),
                "product_url": prod_store_url,
                "name": target_product["name"],
                "price": base_price,
                "colors": all_colors,
                "sizes": all_sizes,
                "variants": variants,
            }
        )


variant_handler = VariantInquiryHandler()
