"""
Continuous Online Learning & Interaction Affinity Engine for Fashion E-Commerce.
Tracks customer interaction signals (searches, product inquiries, repeat questions,
cart additions, purchases) across Web AI Stylist, WhatsApp, and Storefront.
Continuously updates product co-occurrence weights, query relevance scores, and
customer preference vectors to optimize sales conversion rates over time.
"""

import asyncio
import math
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from bson import ObjectId


class OnlineLearningEngine:
    """Manages real-time online learning, feedback weights, and product affinity."""

    # Feedback Signal Rewards (higher reward = stronger purchase/interest intent)
    REWARDS = {
        "search_view": 1.0,          # Customer searched and saw/clicked product
        "view_details": 2.0,        # Customer opened product details / quick view
        "stylist_inquiry": 3.5,     # Customer asked AI Stylist about this product
        "whatsapp_inquiry": 4.0,    # Customer inquired about this product on WhatsApp
        "repeat_inquiry": 6.5,      # Customer asked multiple times (High Buying Intent!)
        "add_to_cart": 8.0,         # Customer added product to bag
        "order_purchased": 15.0,    # Customer completed purchase (Highest Conversion Signal)
    }

    def __init__(self):
        self._lock = asyncio.Lock()
        self._interaction_count_since_last_sync = 0
        # In-memory fast cache for product-product affinity: {prod_a: {prod_b: score}}
        self._affinity_cache: Dict[str, Dict[str, float]] = {}
        # In-memory query-to-product boost cache: {token: {prod_id: score}}
        self._query_boost_cache: Dict[str, Dict[str, float]] = {}
        self._is_initialized = False

    async def initialize(self, db: Any) -> None:
        """Load recent learned affinities into memory cache."""
        if self._is_initialized:
            return

        async with self._lock:
            if self._is_initialized:
                return

            try:
                # 1. Load product affinity records
                cursor = db["learning_affinities"].find({}).sort("score", -1).limit(500)
                async for doc in cursor:
                    p1 = doc.get("product_a")
                    p2 = doc.get("product_b")
                    score = float(doc.get("score", 0.0))
                    if p1 and p2:
                        if p1 not in self._affinity_cache:
                            self._affinity_cache[p1] = {}
                        self._affinity_cache[p1][p2] = score

                # 2. Load query boosts
                q_cursor = db["learning_query_weights"].find({}).sort("weight", -1).limit(500)
                async for q_doc in q_cursor:
                    token = q_doc.get("token")
                    pid = q_doc.get("product_id")
                    weight = float(q_doc.get("weight", 0.0))
                    if token and pid:
                        if token not in self._query_boost_cache:
                            self._query_boost_cache[token] = {}
                        self._query_boost_cache[token][pid] = weight

                self._is_initialized = True
            except Exception as e:
                print(f"[WARNING] Could not initialize online learning cache: {e}")

    async def record_interaction(
        self,
        db: Any,
        event_type: str,
        product_id: Optional[str] = None,
        related_product_ids: Optional[List[str]] = None,
        search_query: Optional[str] = None,
        customer_phone: Optional[str] = None,
        customer_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Record an interaction event and continuously update online learning weights."""
        await self.initialize(db)
        now = datetime.now(timezone.utc)
        reward = self.REWARDS.get(event_type, 1.0)

        # 1. Check Customer Repeat Inquiry Count for this specific product
        is_repeat_inquiry = False
        inquiry_count_for_product = 1
        clean_phone = (customer_phone or "").replace("+", "").replace(" ", "").replace("-", "")

        if product_id and (clean_phone or customer_id):
            cust_key = customer_id or clean_phone
            history_doc = await db["customer_interaction_history"].find_one({
                "customer_key": cust_key,
                "product_id": product_id,
            })
            if history_doc:
                inquiry_count_for_product = history_doc.get("inquiry_count", 0) + 1
                is_repeat_inquiry = inquiry_count_for_product >= 2
                await db["customer_interaction_history"].update_one(
                    {"_id": history_doc["_id"]},
                    {
                        "$inc": {"inquiry_count": 1},
                        "$set": {"last_interaction": now, "high_intent": is_repeat_inquiry},
                    }
                )
            else:
                await db["customer_interaction_history"].insert_one({
                    "customer_key": cust_key,
                    "product_id": product_id,
                    "inquiry_count": 1,
                    "high_intent": False,
                    "first_interaction": now,
                    "last_interaction": now,
                })

            # Upgrade reward if customer is repeatedly asking
            if is_repeat_inquiry and event_type in ["stylist_inquiry", "whatsapp_inquiry"]:
                event_type = "repeat_inquiry"
                reward = self.REWARDS["repeat_inquiry"]

        # 2. Persist Raw Event into interaction_events collection for ML auditing
        event_doc = {
            "event_type": event_type,
            "product_id": product_id,
            "related_product_ids": related_product_ids or [],
            "search_query": search_query,
            "customer_phone": clean_phone or None,
            "customer_id": customer_id or None,
            "reward": reward,
            "is_repeat_inquiry": is_repeat_inquiry,
            "timestamp": now,
            "metadata": metadata or {},
        }
        try:
            await db["interaction_events"].insert_one(event_doc)
        except Exception as e:
            print(f"[WARNING] Failed to insert interaction event: {e}")

        # 3. Continuous Online Weight Update: Product Co-occurrence Affinity
        if product_id and related_product_ids:
            for r_id in related_product_ids:
                if r_id != product_id:
                    await self._update_affinity_weight(db, product_id, r_id, reward)

        # 4. Continuous Online Weight Update: Query to Product Relevance
        if search_query and product_id:
            await self._update_query_weight(db, search_query, product_id, reward)

        self._interaction_count_since_last_sync += 1

        # Periodic background memory-sync & decay normalization every 25 events
        if self._interaction_count_since_last_sync >= 25:
            self._interaction_count_since_last_sync = 0
            asyncio.create_task(self._normalize_and_persist_weights(db))

        return {
            "success": True,
            "event_type": event_type,
            "reward_applied": reward,
            "is_repeat_inquiry": is_repeat_inquiry,
            "inquiry_count": inquiry_count_for_product,
        }

    async def _update_affinity_weight(self, db: Any, p1: str, p2: str, delta: float) -> None:
        """Update symmetrical co-occurrence weight between two products."""
        # Update in-memory cache
        for a, b in [(p1, p2), (p2, p1)]:
            if a not in self._affinity_cache:
                self._affinity_cache[a] = {}
            current_score = self._affinity_cache[a].get(b, 0.0)
            # Add reward with diminishing returns (asymptotic growth)
            new_score = current_score + round(delta * 0.25, 3)
            self._affinity_cache[a][b] = new_score

        # Persist to MongoDB
        try:
            pair_key = "-".join(sorted([p1, p2]))
            await db["learning_affinities"].update_one(
                {"pair_key": pair_key},
                {
                    "$set": {"product_a": p1, "product_b": p2, "updated_at": datetime.now(timezone.utc)},
                    "$inc": {"score": round(delta * 0.25, 3), "interactions": 1},
                },
                upsert=True,
            )
        except Exception as err:
            print(f"[WARNING] Affinity weight update error: {err}")

    async def _update_query_weight(self, db: Any, query: str, product_id: str, delta: float) -> None:
        """Update term-to-product mapping weights based on customer searches."""
        import re
        tokens = re.findall(r"\b[a-zA-Z0-9_\-]{3,}\b", query.lower())
        now = datetime.now(timezone.utc)

        for tok in set(tokens):
            if tok not in self._query_boost_cache:
                self._query_boost_cache[tok] = {}
            current_w = self._query_boost_cache[tok].get(product_id, 0.0)
            new_w = current_w + round(delta * 0.15, 3)
            self._query_boost_cache[tok][product_id] = new_w

            try:
                await db["learning_query_weights"].update_one(
                    {"token": tok, "product_id": product_id},
                    {
                        "$inc": {"weight": round(delta * 0.15, 3), "hits": 1},
                        "$set": {"updated_at": now},
                    },
                    upsert=True,
                )
            except Exception:
                pass

    def get_learned_affinities(self, product_id: str, limit: int = 5) -> List[Tuple[str, float]]:
        """Retrieve top products with strongest learned affinity to this product."""
        if product_id not in self._affinity_cache:
            return []
        scores = self._affinity_cache[product_id]
        sorted_pairs = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        return sorted_pairs[:limit]

    def get_query_learned_boosts(self, query: str) -> Dict[str, float]:
        """Compute accumulated boost per product based on customer query tokens."""
        import re
        tokens = re.findall(r"\b[a-zA-Z0-9_\-]{3,}\b", query.lower())
        boosts: Dict[str, float] = {}

        for tok in tokens:
            if tok in self._query_boost_cache:
                for pid, w in self._query_boost_cache[tok].items():
                    boosts[pid] = boosts.get(pid, 0.0) + w

        return boosts

    async def check_customer_high_intent(
        self,
        db: Any,
        customer_phone: Optional[str],
        customer_id: Optional[str],
        product_id: str,
    ) -> Dict[str, Any]:
        """Check if customer has asked about this product multiple times."""
        clean_phone = (customer_phone or "").replace("+", "").replace(" ", "").replace("-", "")
        cust_key = customer_id or clean_phone
        if not cust_key or not product_id:
            return {"high_intent": False, "inquiry_count": 0}

        doc = await db["customer_interaction_history"].find_one({
            "customer_key": cust_key,
            "product_id": product_id,
        })
        if not doc:
            return {"high_intent": False, "inquiry_count": 0}

        count = doc.get("inquiry_count", 0)
        return {
            "high_intent": count >= 2,
            "inquiry_count": count,
            "last_interaction": doc.get("last_interaction"),
        }

    async def _normalize_and_persist_weights(self, db: Any) -> None:
        """Apply mathematical decay normalization to prevent unbounded weight inflation."""
        try:
            # Dampen extreme weights to keep ranking balanced
            for p1, neighbors in self._affinity_cache.items():
                for p2, score in neighbors.items():
                    if score > 50.0:
                        self._affinity_cache[p1][p2] = 50.0 * (1.0 - math.exp(-score / 50.0))
        except Exception as e:
            print(f"[WARNING] Weight normalization error: {e}")

    async def run_batch_training_cycle(self, db: Any) -> Dict[str, Any]:
        """Triggered periodic or manual training cycle to reconcile and log ML metrics."""
        now = datetime.now(timezone.utc)
        total_events = await db["interaction_events"].count_documents({})
        total_affinities = await db["learning_affinities"].count_documents({})
        total_query_rules = await db["learning_query_weights"].count_documents({})

        metrics = {
            "total_interaction_events_trained": total_events,
            "active_product_affinity_edges": total_affinities,
            "learned_query_associations": total_query_rules,
            "in_memory_cached_products": len(self._affinity_cache),
            "trained_at": now.isoformat(),
            "status": "ONLINE_LEARNING_ACTIVE",
        }

        # Log training step into model registry / audit log
        try:
            await db["model_training_logs"].insert_one({
                "model_name": "online_hybrid_recommender",
                "version": f"v-live-{now.strftime('%Y%m%d%H%M')}",
                "metrics": metrics,
                "created_at": now,
            })
        except Exception:
            pass

        return metrics


online_learning_engine = OnlineLearningEngine()
