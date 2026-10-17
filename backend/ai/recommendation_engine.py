import asyncio
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from bson import ObjectId

from ai.demand_tracker import demand_tracker
from ai.ml_recommender import ml_recommender
from ai.online_learning import online_learning_engine


# Fashion taxonomy for entity extraction
FASHION_CATEGORIES = {
    "maxi": ["maxi", "evening dress", "evening gown", "slip maxi", "gown"],
    "gown": ["gown", "gala dress", "evening gown", "slit gown", "tiered gown"],
    "dress": ["dress", "frock", "midi dress", "day dress", "cocktail dress"],
    "kurti": ["kurti", "tunic", "kameez", "traditional tunic"],
    "eastern": ["shalwar kameez", "eastern set", "suit", "anarkali", "dupatta"],
    "top": ["top", "blouse", "casual tee", "shirt", "button-down", "silk blouse"],
    "blazer": ["blazer", "power suit", "coat", "jacket", "formal suit"],
    "denim": ["jeans", "denim", "pants", "trousers", "high-rise"],
    "suit": ["suit", "2 piece", "3 piece", "co-ord", "coord", "set", "two piece"],
    "shirt": ["shirt", "top", "tee", "blouse", "button-down", "collar shirt"],
}

FASHION_STYLES = {
    "stylish": ["stylish", "style", "chic", "trend", "trendy", "trending", "fashionable", "glamorous", "glam", "vogue", "luxe", "luxury", "classy", "aesthetic", "statement", "latest"],
    "casual": ["casual", "daily wear", "relaxed", "minimal", "comfy", "comfortable", "simple", "everyday"],
    "formal": ["formal", "office", "executive", "power", "business", "interview", "meeting"],
    "traditional": ["traditional", "desi", "eastern", "ethnic", "festive", "culture", "eid"],
}

FASHION_COLORS = {
    "emerald": ["emerald", "green", "sabz", "dark green"],
    "green": ["green", "emerald", "olive", "mint", "sabz"],
    "red": ["red", "crimson", "ruby", "maroon", "laal", "scarlet"],
    "crimson": ["crimson", "red", "deep red"],
    "black": ["black", "midnight", "obsidian", "kala", "dark"],
    "gold": ["gold", "rose gold", "champagne", "shimmer", "metallic"],
    "pink": ["pink", "blush", "rose", "gulabi", "magenta"],
    "blue": ["blue", "sapphire", "navy", "neela", "royal blue"],
    "plum": ["plum", "purple", "violet", "berry"],
    "white": ["white", "ivory", "pearl", "cream", "safaid"],
}

FASHION_FABRICS = [
    "satin", "velvet", "sequin", "silk", "chiffon", "crepe", 
    "tulle", "cotton", "linen", "lawn", "denim", "georgette", "organza"
]

FASHION_OCCASIONS = [
    "party", "wedding", "shaadi", "shadi", "valima", "mehndi", 
    "gala", "dinner", "date", "casual", "office", "formal", "eid", "festive"
]


class FashionRecommendationEngine:
    """Smart Hybrid ML & Demand-Driven Recommender for Fashion Boutique.
    
    Responsibilities:
    1. Extract customer intent, style, color, fabric, and occasion entities from natural dialogue.
    2. Vectorize user queries using TF-IDF and compute sub-millisecond Cosine Similarity.
    3. Track real-time product demand velocity across WhatsApp and Web AI Stylist.
    4. Dynamically rank and score products based on semantic relevance, demand velocity, and customer taste.
    5. Generate cross-selling bundles and high-converting conversational closing nudges.
    """

    def __init__(self):
        self._index_lock = asyncio.Lock()
        self._indexed_count = 0

    def invalidate_index(self) -> None:
        """Invalidate in-memory ML recommender vector index so it re-indexes on the next query."""
        self._indexed_count = 0
        ml_recommender.is_indexed = False
        print("[INFO] Recommender catalog index invalidated. Will re-index on next query.")

    async def ensure_catalog_indexed(self, db: Any) -> None:
        """Lazily initialize ML semantic vector index in memory from MongoDB."""
        if ml_recommender.is_indexed and self._indexed_count > 0:
            return

        async with self._index_lock:
            if ml_recommender.is_indexed and self._indexed_count > 0:
                return

            try:
                cursor = db["products"].find({"is_active": True})
                products = [doc async for doc in cursor]
                if not products:
                    cursor = db["products"].find({})
                    products = [doc async for doc in cursor]

                if not products:
                    return

                # Fetch variants to enrich colors and sizes in batch
                prod_ids = [str(p["_id"]) for p in products]
                v_cursor = db["product_variants"].find(
                    {"product_id": {"$in": prod_ids}},
                    {"product_id": 1, "color": 1, "size": 1}
                )
                variants_by_prod: Dict[str, List[Dict[str, Any]]] = {pid: [] for pid in prod_ids}
                async for v in v_cursor:
                    pid = v.get("product_id")
                    if pid in variants_by_prod:
                        variants_by_prod[pid].append(v)

                for p in products:
                    pid = str(p["_id"])
                    vars_ = variants_by_prod.get(pid, [])
                    colors = list(set(v.get("color", "") for v in vars_ if v.get("color")))
                    sizes = list(set(v.get("size", "") for v in vars_ if v.get("size")))
                    p["_variant_colors"] = " ".join(colors)
                    p["_variant_sizes"] = " ".join(sizes)

                ml_recommender.build_index(products)
                self._indexed_count = len(products)
            except Exception as e:
                print(f"[WARNING] Could not build ML recommender catalog index: {e}")

    @staticmethod
    def extract_fashion_entities(text: str) -> Dict[str, Any]:
        """Extract categories, colors, fabrics, occasions, styles, and budget from user message."""
        lowered = text.lower()
        extracted: Dict[str, Any] = {
            "categories": [],
            "colors": [],
            "fabrics": [],
            "occasions": [],
            "styles": [],
            "max_price": None,
        }

        # Categories
        for cat_key, synonyms in FASHION_CATEGORIES.items():
            if any(syn in lowered for syn in synonyms):
                extracted["categories"].append(cat_key)

        # Colors
        for color_key, synonyms in FASHION_COLORS.items():
            if any(syn in lowered for syn in synonyms):
                extracted["colors"].append(color_key)

        # Fabrics
        for fabric in FASHION_FABRICS:
            if fabric in lowered:
                extracted["fabrics"].append(fabric)

        # Occasions
        for occ in FASHION_OCCASIONS:
            if occ in lowered:
                extracted["occasions"].append(occ)

        # Styles (stylish, casual, formal, traditional, chic)
        for style_key, synonyms in FASHION_STYLES.items():
            if any(syn in lowered for syn in synonyms):
                extracted["styles"].append(style_key)

        # Price / Budget extraction (e.g. under 80, less than $100, budget 50)
        price_match = re.search(r"(?:under|below|less than|max|budget|tak)?\s*(?:\$|rs|pkr)?\s*(\d{2,5})\s*(?:dollars|\$|usd|rs|pkr)?", lowered)
        if price_match:
            try:
                val = float(price_match.group(1))
                if 20 <= val <= 5000:
                    extracted["max_price"] = val
            except Exception:
                pass

        return extracted

    async def get_personalized_recommendations(
        self,
        db: Any,
        user_message: str = "",
        customer_phone: Optional[str] = None,
        customer_id: Optional[str] = None,
        limit: int = 6,
        source: str = "whatsapp",
        exclude_product_ids: Optional[List[str]] = None,
    ) -> List[Dict[str, Any]]:
        """Fetch ranked, personalized, demand-aware product recommendations with optional exclusions."""
        # 1. Ensure ML Vector Index is ready in memory
        await self.ensure_catalog_indexed(db)

        # 2. Extract explicit fashion entities
        entities = self.extract_fashion_entities(user_message)

        # 3. Compute Semantic ML Cosine Similarity matches
        semantic_matches: List[Tuple[str, float]] = []
        if user_message.strip():
            semantic_matches = ml_recommender.search_semantic(user_message, top_k=25)
        semantic_scores_by_id: Dict[str, float] = dict(semantic_matches)

        # 4. Fetch customer taste if available
        customer_taste: Dict[str, Any] = {}
        if customer_id and ObjectId.is_valid(customer_id):
            c_doc = await db["customers"].find_one({"_id": ObjectId(customer_id)})
            if c_doc:
                customer_taste = c_doc.get("taste_profile") or {}
        elif customer_phone:
            clean_phone = customer_phone.replace("+", "").replace(" ", "").replace("-", "")
            c_doc = await db["customers"].find_one({"$or": [{"phone": customer_phone}, {"whatsapp_id": clean_phone}]})
            if c_doc:
                customer_taste = c_doc.get("taste_profile") or {}

        # 5. Build candidate products query
        clean_exclude_ids = [str(e) for e in (exclude_product_ids or []) if e]
        candidate_ids = [cid for cid in semantic_scores_by_id.keys() if cid not in clean_exclude_ids]
        clauses = []
        if entities["categories"]:
            for c in entities["categories"]:
                clauses.append({"category": {"$regex": c, "$options": "i"}})
                clauses.append({"name": {"$regex": c, "$options": "i"}})
        if entities["colors"]:
            for col in entities["colors"]:
                clauses.append({"name": {"$regex": col, "$options": "i"}})
                clauses.append({"description": {"$regex": col, "$options": "i"}})
        if entities["fabrics"]:
            for fab in entities["fabrics"]:
                clauses.append({"name": {"$regex": fab, "$options": "i"}})
                clauses.append({"description": {"$regex": fab, "$options": "i"}})
        if entities.get("styles"):
            for sty in entities["styles"]:
                if sty == "stylish":
                    clauses.append({"name": {"$regex": "luxe|silk|satin|velvet|gown|maxi|blazer|chic|stylish|dress|kurti", "$options": "i"}})
                    clauses.append({"description": {"$regex": "luxe|silk|satin|velvet|gown|maxi|blazer|chic|stylish|dress|kurti", "$options": "i"}})
                else:
                    clauses.append({"name": {"$regex": sty, "$options": "i"}})
                    clauses.append({"description": {"$regex": sty, "$options": "i"}})

        # 5. Fetch candidate products:
        # A. Always fetch top ML Semantic Vector matches directly first (guarantees high-confidence matches are NEVER cut off)
        exclude_objs = [ObjectId(eid) for eid in clean_exclude_ids if ObjectId.is_valid(eid)]
        semantic_docs: List[Dict[str, Any]] = []
        if candidate_ids:
            try:
                obj_ids = [ObjectId(cid) for cid in candidate_ids if ObjectId.is_valid(cid) and ObjectId(cid) not in exclude_objs]
                if obj_ids:
                    s_cursor = db["products"].find({"_id": {"$in": obj_ids}, "is_active": True}, {"embedding": 0})
                    semantic_docs = [doc async for doc in s_cursor]
            except Exception as sem_err:
                print(f"[WARNING] Semantic docs fetch error: {sem_err}")

        candidate_docs = list(semantic_docs)

        # B. If semantic docs don't fill candidate quota (up to 35), fetch additional entity/keyword matches
        if len(candidate_docs) < 35 and clauses:
            fetched_ids = [doc["_id"] for doc in candidate_docs] + exclude_objs
            additional_query: Dict[str, Any] = {
                "is_active": True,
                "_id": {"$nin": fetched_ids},
                "$or": clauses,
            }
            extra_cursor = db["products"].find(additional_query, {"embedding": 0}).limit(35 - len(candidate_docs))
            extra_docs = [doc async for doc in extra_cursor]
            candidate_docs.extend(extra_docs)

        # Fallback if no candidate matches found
        if not candidate_docs:
            fallback_q: Dict[str, Any] = {"is_active": True}
            if exclude_objs:
                fallback_q["_id"] = {"$nin": exclude_objs}
            fallback_cursor = db["products"].find(fallback_q, {"embedding": 0}).sort("created_at", -1).limit(25)
            candidate_docs = [doc async for doc in fallback_cursor]

        if not candidate_docs:
            # If everything was excluded, reset exclusions and pull top catalog pieces
            fallback_cursor = db["products"].find({"is_active": True}, {"embedding": 0}).sort("created_at", -1).limit(25)
            candidate_docs = [doc async for doc in fallback_cursor]

        if not candidate_docs:
            return []

        # 6. Batch fetch variants & real-time demand stats
        prod_ids = [str(doc["_id"]) for doc in candidate_docs]
        variants_cursor = db["product_variants"].find(
            {"product_id": {"$in": prod_ids}},
            {"product_id": 1, "sku": 1, "size": 1, "color": 1, "price": 1, "available_quantity": 1}
        )
        variants_by_prod: Dict[str, List[Dict[str, Any]]] = {pid: [] for pid in prod_ids}
        async for v in variants_cursor:
            pid = v.get("product_id")
            if pid in variants_by_prod:
                clean_v = {
                    "id": str(v["_id"]) if "_id" in v else str(v.get("id", "")),
                    "product_id": str(pid),
                    "sku": v.get("sku") or "",
                    "size": v.get("size") or "Standard",
                    "color": v.get("color") or "Default",
                    "price": float(v.get("price", 0.0)) if v.get("price") is not None else 0.0,
                    "available_quantity": int(v.get("available_quantity", 0)),
                }
                variants_by_prod[pid].append(clean_v)

        demand_stats = await demand_tracker.get_demand_stats(db, prod_ids)

        # Fetch learned query boosts from online learning engine
        learned_query_boosts = online_learning_engine.get_query_learned_boosts(user_message) if user_message else {}

        # 7. Hybrid Scoring Formula (ML Semantic + Demand Velocity + Customer Taste + Learned Affinities + Stock)
        scored_products: List[Tuple[float, Dict[str, Any]]] = []

        fav_cats = customer_taste.get("favorite_categories", {})
        fav_cols = customer_taste.get("favorite_colors", {})
        fav_styles = customer_taste.get("favorite_styles", {})

        for doc in candidate_docs:
            pid = str(doc["_id"])
            p_name = doc.get("name", "").lower()
            p_cat = doc.get("category", "").lower()
            p_desc = doc.get("description", "").lower()
            variants = variants_by_prod.get(pid, [])
            d_info = demand_stats.get(pid, {})

            prices = [v.get("price", 0.0) for v in variants if "price" in v and v.get("price") is not None]
            min_price = min(prices) if prices else 49.99
            max_price = max(prices) if prices else 49.99
            v_colors = [v.get("color", "").lower() for v in variants if v.get("color")]
            v_sizes = list(set(v.get("size", "") for v in variants if v.get("size")))
            total_stock = sum(v.get("available_quantity", 0) for v in variants)

            score = 0.0

            # A. ML Semantic Cosine Similarity Score (0.0 to 1.0 mapped to up to 35.0 points)
            sem_sim = semantic_scores_by_id.get(pid, 0.0)
            score += sem_sim * 35.0

            # B. Entity Matches
            for cat in entities["categories"]:
                if cat in p_cat:
                    score += 15.0
                if cat in p_name:
                    score += 10.0

            for col in entities["colors"]:
                if col in p_name:
                    score += 12.0
                elif any(col in vc for vc in v_colors):
                    score += 10.0
                elif col in p_desc:
                    score += 5.0

            for fab in entities["fabrics"]:
                if fab in p_name:
                    score += 8.0
                elif fab in p_desc:
                    score += 6.0

            for occ in entities["occasions"]:
                if occ in p_name or occ in p_desc or occ in p_cat:
                    score += 8.0

            for sty in entities.get("styles", []):
                if sty == "stylish":
                    if any(kw in (p_name + " " + p_desc) for kw in ["silk", "satin", "velvet", "gown", "maxi", "blazer", "chic", "luxe"]):
                        score += 14.0
                    else:
                        score += 7.0
                elif sty in p_name or sty in p_desc:
                    score += 10.0

            # C. Real-Time Demand Velocity Boost (Popular on WhatsApp / Stylist)
            recent_vel = d_info.get("recent_velocity", 0)
            inq_total = d_info.get("inquiry_count", 0)
            if recent_vel >= 5:
                score += min(recent_vel * 1.5, 15.0)
            elif inq_total >= 3:
                score += min(inq_total * 0.8, 8.0)

            # D. Customer Taste Personalization Boost
            for f_cat, weight in fav_cats.items():
                if f_cat.lower() in p_cat:
                    score += min(weight * 2.0, 10.0)

            for f_col, weight in fav_cols.items():
                if f_col.lower() in p_name or any(f_col.lower() in vc for vc in v_colors):
                    score += min(weight * 2.0, 8.0)

            for f_sty, weight in fav_styles.items():
                if f_sty.lower() in p_name or f_sty.lower() in p_desc:
                    score += min(weight * 2.0, 8.0)

            # E. Price Constraints
            if entities["max_price"]:
                if min_price <= entities["max_price"]:
                    score += 10.0
                else:
                    score -= 15.0

            # F. Stock Availability
            if total_stock > 0:
                score += 5.0
            else:
                score -= 10.0

            # G. Online Learned Query Boost (Continuous Model Improvement)
            l_boost = learned_query_boosts.get(pid, 0.0)
            if l_boost > 0:
                score += min(l_boost * 2.5, 15.0)

            orig_colors = list(dict.fromkeys(v.get("color").strip() for v in variants if v.get("color")))
            orig_sizes = list(dict.fromkeys(v.get("size").strip() for v in variants if v.get("size")))

            # Format item display
            price_display = f"PKR {min_price:,.2f}" if min_price == max_price else f"PKR {min_price:,.2f} - PKR {max_price:,.2f}"
            image_url = doc.get("image_urls", [None])[0] if doc.get("image_urls") else "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=400&q=80"
            comp_cats = ml_recommender.get_complementary_categories(doc.get("category", ""))

            item_data = {
                "id": pid,
                "name": doc["name"],
                "slug": doc.get("slug"),
                "category": doc.get("category"),
                "price": price_display,
                "min_price": min_price,
                "max_price": max_price,
                "image_url": image_url,
                "colors": ", ".join(orig_colors) if orig_colors else "Standard",
                "sizes": ", ".join(orig_sizes) if orig_sizes else "Free Size",
                "color_list": orig_colors,
                "size_list": orig_sizes,
                "variants": variants,
                "description": doc.get("description", ""),
                "score": round(score, 2),
                "semantic_similarity": round(sem_sim, 3),
                "demand_badge": d_info.get("badge"),
                "inquiry_count": inq_total,
                "complementary_categories": comp_cats,
                "in_stock": total_stock > 0,
            }

            scored_products.append((score, item_data))

        scored_products.sort(key=lambda x: x[0], reverse=True)
        if clean_exclude_ids:
            filtered_scored = [sp for sp in scored_products if sp[1]["id"] not in clean_exclude_ids]
            if filtered_scored:
                scored_products = filtered_scored
        top_recs = [item for _, item in scored_products[:limit]]

        # 8. Background Demand & Online Learning Logging
        if top_recs:
            top_ids = [p["id"] for p in top_recs[:3]]
            asyncio.create_task(
                demand_tracker.record_inquiry(
                    db=db,
                    matched_product_ids=top_ids,
                    categories=entities.get("categories"),
                    styles=entities.get("styles"),
                    customer_phone=customer_phone,
                    customer_id=customer_id,
                    source=source,
                )
            )
            asyncio.create_task(
                online_learning_engine.record_interaction(
                    db=db,
                    event_type="stylist_inquiry" if source == "stylist" else "whatsapp_inquiry",
                    product_id=top_ids[0] if top_ids else None,
                    related_product_ids=top_ids[1:] if len(top_ids) > 1 else None,
                    search_query=user_message if user_message else None,
                    customer_phone=customer_phone,
                    customer_id=customer_id,
                )
            )

        return top_recs

    async def get_relevant_and_cross_sell_products(
        self,
        db: Any,
        product_id: str,
        customer_phone: Optional[str] = None,
        customer_id: Optional[str] = None,
        limit: int = 3,
    ) -> List[Dict[str, Any]]:
        """Fetch complementary cross-sell outfits and accessories specifically for a given product."""
        target = None
        if ObjectId.is_valid(product_id):
            target = await db["products"].find_one({"_id": ObjectId(product_id)})
        if not target:
            target = await db["products"].find_one({"slug": product_id})
        if not target:
            return []

        target_cat = target.get("category", "")
        comp_categories = ml_recommender.get_complementary_categories(target_cat)

        # Retrieve online learned affinities
        learned_pairs = online_learning_engine.get_learned_affinities(str(target["_id"]), limit=6)
        learned_affinity_map = dict(learned_pairs)

        clauses = []
        for c in comp_categories:
            clauses.append({"category": {"$regex": c, "$options": "i"}})
            clauses.append({"name": {"$regex": c, "$options": "i"}})

        learned_ids = [ObjectId(pid) for pid, _ in learned_pairs if ObjectId.is_valid(pid)]
        if learned_ids:
            clauses.append({"_id": {"$in": learned_ids}})

        query: Dict[str, Any] = {
            "is_active": True,
            "_id": {"$ne": target["_id"]},
        }
        if clauses:
            query["$or"] = clauses

        cursor = db["products"].find(query, {"embedding": 0}).limit(20)
        candidates = [doc async for doc in cursor]

        if not candidates:
            fb_cursor = db["products"].find(
                {"is_active": True, "_id": {"$ne": target["_id"]}},
                {"embedding": 0}
            ).limit(10)
            candidates = [doc async for doc in fb_cursor]

        if not candidates:
            return []

        cand_ids = [str(c["_id"]) for c in candidates]
        v_cursor = db["product_variants"].find(
            {"product_id": {"$in": cand_ids}},
            {"product_id": 1, "sku": 1, "size": 1, "color": 1, "price": 1, "available_quantity": 1}
        )
        v_map: Dict[str, List[Dict[str, Any]]] = {cid: [] for cid in cand_ids}
        async for v in v_cursor:
            cid = v.get("product_id")
            if cid in v_map:
                clean_v = {
                    "id": str(v["_id"]) if "_id" in v else str(v.get("id", "")),
                    "product_id": str(cid),
                    "sku": v.get("sku") or "",
                    "size": v.get("size") or "Standard",
                    "color": v.get("color") or "Default",
                    "price": float(v.get("price", 0.0)) if v.get("price") is not None else 0.0,
                    "available_quantity": int(v.get("available_quantity", 0)),
                }
                v_map[cid].append(clean_v)

        demand_map = await demand_tracker.get_demand_stats(db, cand_ids)

        scored = []
        for c in candidates:
            cid = str(c["_id"])
            c_cat = c.get("category", "").lower()
            vars_ = v_map.get(cid, [])
            prices = [v.get("price", 0.0) for v in vars_ if "price" in v and v.get("price") is not None]
            min_p = min(prices) if prices else 49.99
            max_p = max(prices) if prices else 49.99
            stock = sum(v.get("available_quantity", 0) for v in vars_)
            colors = list(set(v.get("color", "") for v in vars_ if v.get("color")))
            sizes = list(set(v.get("size", "") for v in vars_ if v.get("size")))

            score = 10.0
            aff_boost = learned_affinity_map.get(cid, 0.0)
            score += aff_boost * 3.5

            if any(comp in c_cat for comp in comp_categories):
                score += 15.0

            if stock > 0:
                score += 5.0
            score += min(demand_map.get(cid, {}).get("recent_velocity", 0) * 1.5, 10.0)

            price_display = f"PKR {min_p:,.2f}" if min_p == max_p else f"PKR {min_p:,.2f} - PKR {max_p:,.2f}"
            image_url = c.get("image_urls", [None])[0] if c.get("image_urls") else "https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=400&q=80"

            item_data = {
                "id": cid,
                "name": c["name"],
                "slug": c.get("slug"),
                "category": c.get("category"),
                "price": price_display,
                "min_price": min_p,
                "max_price": max_p,
                "image_url": image_url,
                "colors": ", ".join(colors) if colors else "Standard",
                "sizes": ", ".join(sizes) if sizes else "Free Size",
                "color_list": colors,
                "size_list": sizes,
                "variants": vars_,
                "description": c.get("description", ""),
                "score": round(score, 2),
                "learned_affinity": round(aff_boost, 2),
                "in_stock": stock > 0,
                "paired_with": target["name"],
                "social_proof": demand_map.get(cid, {}).get("badge"),
            }
            scored.append((score, item_data))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [item for _, item in scored[:limit]]

    @staticmethod
    def generate_conversion_nudge(
        product_name: str,
        relevant_items: Optional[List[Dict[str, Any]]] = None,
        inquiry_count: int = 1,
    ) -> str:
        """Formulate a high-converting styling incentive and closing call-to-action."""
        if inquiry_count >= 2:
            nudge = (
                f"🔥 VIP Style Offer: For {product_name}, enjoy Complimentary Express Delivery "
                f"& an exclusive 10% VIP Discount (Code: VIPSTYLE10)! 🌿"
            )
        else:
            nudge = (
                f"💡 Recommendation: {product_name} is trending with high demand. "
                f"Would you like me to reserve your size with Free Delivery?"
            )

        if relevant_items:
            paired_names = " & ".join(p['name'] for p in relevant_items[:2])
            nudge += f"\n\n✨ Complete The Look: Pairs beautifully with {paired_names}."

        return nudge


recommendation_engine = FashionRecommendationEngine()
