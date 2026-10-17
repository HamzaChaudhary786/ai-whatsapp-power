import csv
import io
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from bson import ObjectId
from fastapi import HTTPException, status
from db.mongodb import get_database
from models.product_model import ProductCreate, ProductModel, ProductUpdate
from models.product_variant_model import ProductVariantCreate, ProductVariantModel, ProductVariantUpdate


def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    return re.sub(r"[\s_-]+", "-", text).strip("-")


class ProductController:
    """Enterprise Business logic for Products, Multi-Variants, Bulk CSV Import & Export."""

    @staticmethod
    def _invalidate_ai_cache():
        try:
            from ai.recommendation_engine import recommendation_engine
            recommendation_engine.invalidate_index()
        except Exception:
            pass

    @staticmethod
    async def create_product(data: ProductCreate) -> dict:
        db = get_database()
        slug = data.slug or slugify(data.name)

        existing = await db["products"].find_one({"slug": slug})
        if existing:
            # Append short random identifier if slug exists
            slug = f"{slug}-{datetime.now().strftime('%M%S')}"

        now = datetime.now(timezone.utc)
        doc = ProductModel(
            name=data.name,
            slug=slug,
            category=data.category,
            description=data.description,
            image_urls=data.image_urls,
            is_active=data.is_active,
            is_on_sale=data.is_on_sale,
            sale_price=data.sale_price,
            discount_percent=data.discount_percent,
            promo_code=data.promo_code,
            sale_tag=data.sale_tag,
            season=data.season or "Summer",
            is_trending=data.is_trending,
            created_at=now,
            updated_at=now,
        ).model_dump(by_alias=True, exclude={"id"})

        result = await db["products"].insert_one(doc)

        # Ensure category exists in categories collection
        await db["categories"].update_one(
            {"name": data.category},
            {"$setOnInsert": {
                "name": data.category,
                "slug": slugify(data.category),
                "is_active": True,
                "created_at": now,
                "updated_at": now,
            }},
            upsert=True,
        )

        ProductController._invalidate_ai_cache()

        return {
            "id": str(result.inserted_id),
            "name": data.name,
            "slug": slug,
            "category": data.category,
            "description": data.description,
            "image_urls": data.image_urls,
            "is_active": data.is_active,
            "is_on_sale": data.is_on_sale,
            "sale_price": data.sale_price,
            "discount_percent": data.discount_percent,
            "promo_code": data.promo_code,
            "sale_tag": data.sale_tag,
            "season": data.season or "Summer",
            "is_trending": data.is_trending,
            "created_at": now,
            "updated_at": now,
        }

    @staticmethod
    async def create_product_with_variants(payload: Dict[str, Any]) -> dict:
        """Create a product and all its multi-color/multi-size variants in one atomic flow."""
        db = get_database()
        name = payload.get("name", "").strip()
        if not name:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Product name is required")

        category = payload.get("category", "Dresses").strip()
        description = payload.get("description", "")
        image_urls = payload.get("image_urls", [])
        is_active = payload.get("is_active", True)
        is_on_sale_flag = bool(payload.get("is_on_sale", False))
        sale_price = float(payload["sale_price"]) if payload.get("sale_price") not in (None, "") else None
        discount_percent = int(payload["discount_percent"]) if payload.get("discount_percent") not in (None, "") else None
        promo_code = payload.get("promo_code")
        sale_tag = payload.get("sale_tag")
        season = payload.get("season", "Summer")
        is_trending = bool(payload.get("is_trending", False))
        variants_data = payload.get("variants", [])

        variant_prices = [float(v.get("price", 0)) for v in variants_data if v.get("price") is not None]
        base_price = variant_prices[0] if variant_prices else 49.99

        if discount_percent and discount_percent > 0:
            is_on_sale = True
            if sale_price is None or sale_price <= 0:
                sale_price = round(base_price * (1.0 - (discount_percent / 100.0)), 2)
        elif sale_price is not None and 0 < sale_price < base_price:
            is_on_sale = True
            if not discount_percent:
                discount_percent = round(((base_price - sale_price) / base_price) * 100)
        elif is_on_sale_flag and sale_price is not None and sale_price < base_price:
            is_on_sale = True
            if not discount_percent:
                discount_percent = round(((base_price - sale_price) / base_price) * 100)
        else:
            is_on_sale = False
            sale_price = None
            discount_percent = 0

        slug = slugify(name)
        existing = await db["products"].find_one({"slug": slug})
        if existing:
            slug = f"{slug}-{datetime.now().strftime('%M%S')}"

        now = datetime.now(timezone.utc)
        prod_doc = ProductModel(
            name=name,
            slug=slug,
            category=category,
            description=description,
            image_urls=image_urls,
            is_active=is_active,
            is_on_sale=is_on_sale,
            sale_price=sale_price,
            discount_percent=discount_percent,
            promo_code=promo_code,
            sale_tag=sale_tag,
            season=season,
            is_trending=is_trending,
            created_at=now,
            updated_at=now,
        ).model_dump(by_alias=True, exclude={"id"})

        res = await db["products"].insert_one(prod_doc)
        prod_id = str(res.inserted_id)

        # Auto-create category in taxonomy if not present
        await db["categories"].update_one(
            {"name": category},
            {"$setOnInsert": {
                "name": category,
                "slug": slugify(category),
                "is_active": True,
                "created_at": now,
                "updated_at": now,
            }},
            upsert=True,
        )

        inserted_variants = []
        if variants_data:
            base_prefix = re.sub(r"[^A-Za-z0-9]", "", slug.upper())[:4] or "PROD"
            for idx, v in enumerate(variants_data):
                size = (v.get("size") or "Standard").strip()
                color = (v.get("color") or "Default").strip()
                price = float(v.get("price", 49.99))
                qty = int(v.get("available_quantity", v.get("quantity", 10)))
                sku = v.get("sku") or f"{base_prefix}-{color[:3].upper()}-{size[:2].upper()}-{idx+1}"

                # Check SKU collision
                collision = await db["product_variants"].find_one({"sku": sku})
                if collision:
                    sku = f"{sku}-{datetime.now().strftime('%S%f')[:4]}"

                v_doc = ProductVariantModel(
                    product_id=prod_id,
                    sku=sku,
                    size=size,
                    color=color,
                    price=price,
                    currency="PKR",
                    available_quantity=qty,
                    created_at=now,
                    updated_at=now,
                ).model_dump(by_alias=True, exclude={"id"})

                v_res = await db["product_variants"].insert_one(v_doc)
                inserted_variants.append({
                    "id": str(v_res.inserted_id),
                    "product_id": prod_id,
                    "sku": sku,
                    "size": size,
                    "color": color,
                    "price": price,
                    "currency": "PKR",
                    "available_quantity": qty,
                    "created_at": now,
                    "updated_at": now,
                })

        ProductController._invalidate_ai_cache()

        return {
            "id": prod_id,
            "name": name,
            "slug": slug,
            "category": category,
            "description": description,
            "image_urls": image_urls,
            "is_active": is_active,
            "is_on_sale": is_on_sale,
            "sale_price": sale_price,
            "discount_percent": discount_percent,
            "promo_code": promo_code,
            "sale_tag": sale_tag,
            "season": season,
            "is_trending": is_trending,
            "created_at": now,
            "updated_at": now,
            "variants": inserted_variants,
        }

    @staticmethod
    async def update_product(product_id: str, data: ProductUpdate) -> dict:
        db = get_database()
        if not ObjectId.is_valid(product_id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid product ID")

        update_dict = {}
        if data.name is not None:
            update_dict["name"] = data.name.strip()
        if data.slug is not None:
            update_dict["slug"] = slugify(data.slug)
        if data.category is not None:
            update_dict["category"] = data.category.strip()
        if data.description is not None:
            update_dict["description"] = data.description
        if data.image_urls is not None:
            update_dict["image_urls"] = data.image_urls
        if data.is_active is not None:
            update_dict["is_active"] = data.is_active
        if data.is_on_sale is not None or data.sale_price is not None or data.discount_percent is not None:
            curr_prod = await db["products"].find_one({"_id": ObjectId(product_id)})
            if curr_prod:
                v_cur = db["product_variants"].find({"product_id": product_id})
                v_prices = []
                async for v_item in v_cur:
                    if "price" in v_item and v_item["price"]:
                        v_prices.append(float(v_item["price"]))
                base_price = v_prices[0] if v_prices else 49.99

                disc = data.discount_percent if data.discount_percent is not None else curr_prod.get("discount_percent")
                s_price = data.sale_price if data.sale_price is not None else curr_prod.get("sale_price")
                on_sale_flag = data.is_on_sale if data.is_on_sale is not None else curr_prod.get("is_on_sale", False)

                if disc and disc > 0:
                    update_dict["is_on_sale"] = True
                    update_dict["discount_percent"] = disc
                    update_dict["sale_price"] = round(base_price * (1.0 - (disc / 100.0)), 2)
                elif s_price is not None and 0 < s_price < base_price:
                    update_dict["is_on_sale"] = True
                    update_dict["sale_price"] = s_price
                    update_dict["discount_percent"] = round(((base_price - s_price) / base_price) * 100)
                elif on_sale_flag and s_price is not None and s_price < base_price:
                    update_dict["is_on_sale"] = True
                    update_dict["sale_price"] = s_price
                    update_dict["discount_percent"] = round(((base_price - s_price) / base_price) * 100)
                else:
                    update_dict["is_on_sale"] = False
                    update_dict["sale_price"] = None
                    update_dict["discount_percent"] = 0

        if data.promo_code is not None:
            update_dict["promo_code"] = data.promo_code
        if data.sale_tag is not None:
            update_dict["sale_tag"] = data.sale_tag
        if data.season is not None:
            update_dict["season"] = data.season
        if data.is_trending is not None:
            update_dict["is_trending"] = data.is_trending

        update_dict["updated_at"] = datetime.now(timezone.utc)

        res = await db["products"].update_one({"_id": ObjectId(product_id)}, {"$set": update_dict})
        if res.matched_count == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

        ProductController._invalidate_ai_cache()
        return await ProductController.get_product(product_id)

    @staticmethod
    async def delete_product(product_id: str) -> dict:
        db = get_database()
        query = {"slug": product_id}
        if ObjectId.is_valid(product_id):
            query = {"$or": [{"_id": ObjectId(product_id)}, {"slug": product_id}]}

        doc = await db["products"].find_one(query)
        if not doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

        real_id = str(doc["_id"])
        await db["products"].delete_one({"_id": doc["_id"]})

        # Cascade delete variants
        del_v = await db["product_variants"].delete_many({"product_id": real_id})

        ProductController._invalidate_ai_cache()

        return {
            "status": "success",
            "message": f"Product '{doc.get('name')}' and {del_v.deleted_count} variant(s) deleted successfully",
        }

    @staticmethod
    async def list_products(category: Optional[str] = None, is_active: Optional[bool] = None, limit: int = 100, skip: int = 0) -> List[dict]:
        db = get_database()
        query = {}
        if category and category != "All":
            query["category"] = category
        if is_active is not None:
            query["is_active"] = is_active

        try:
            cursor = db["products"].find(query, {"embedding": 0}).sort("created_at", -1).skip(skip).limit(limit)
            docs = [doc async for doc in cursor]
        except Exception as e:
            print(f"[ERROR] ProductController.list_products DB error: {e}")
            return []

        if not docs:
            return []

        # Batch query all variants in a single query instead of N round-trips
        prod_ids = [str(doc["_id"]) for doc in docs]
        variants_cursor = db["product_variants"].find(
            {"product_id": {"$in": prod_ids}},
            {"product_id": 1, "sku": 1, "size": 1, "color": 1, "price": 1, "available_quantity": 1}
        )
        variants_map = {pid: [] for pid in prod_ids}
        async for v in variants_cursor:
            pid = v.get("product_id")
            if pid in variants_map:
                variants_map[pid].append({
                    "id": str(v["_id"]),
                    "sku": v.get("sku"),
                    "size": v.get("size"),
                    "color": v.get("color"),
                    "price": v.get("price"),
                    "available_quantity": v.get("available_quantity", 0),
                })

        # Batch aggregate real sales and order counts from orders collection
        sales_map = {}
        try:
            agg_pipeline = [
                {"$unwind": "$items"},
                {"$match": {"items.product_id": {"$in": prod_ids}}},
                {
                    "$group": {
                        "_id": "$items.product_id",
                        "sales_count": {"$sum": {"$ifNull": ["$items.quantity", 1]}},
                        "order_count": {"$sum": 1},
                    }
                }
            ]
            agg_cursor = db["orders"].aggregate(agg_pipeline)
            async for stat in agg_cursor:
                pid = str(stat.get("_id"))
                if pid:
                    sales_map[pid] = {
                        "sales_count": int(stat.get("sales_count", 0)),
                        "order_count": int(stat.get("order_count", 0)),
                    }
        except Exception as e:
            print(f"[WARNING] ProductController.list_products: Sales aggregation error: {e}")

        # Batch query customer inquiries / demand tracker
        demand_map = {}
        try:
            d_cursor = db["product_demand"].find({"product_id": {"$in": prod_ids}})
            async for d in d_cursor:
                pid = str(d.get("product_id"))
                if pid:
                    demand_map[pid] = int(d.get("inquiry_count", 0))
        except Exception:
            pass

        items = []
        for doc in docs:
            pid = str(doc["_id"])
            variants = variants_map.get(pid, [])
            prices = [v["price"] for v in variants if "price" in v and v["price"] is not None]
            min_price = min(prices) if prices else 0.0
            max_price = max(prices) if prices else 0.0
            total_stock = sum(v.get("available_quantity", 0) for v in variants)

            stat = sales_map.get(pid, {})
            sales_cnt = max(stat.get("sales_count", 0), int(doc.get("sales_count") or 0))
            order_cnt = max(stat.get("order_count", 0), int(doc.get("order_count") or 0))
            inquiry_cnt = max(demand_map.get(pid, 0), int(doc.get("inquiry_count") or 0))

            # ML Trending Score: weighted combination of sales, orders, inquiries and trending flag
            trending_score = round(
                (sales_cnt * 10.0) + (order_cnt * 5.0) + (inquiry_cnt * 2.0) + (5.0 if doc.get("is_trending") else 0.0),
                2
            )

            items.append({
                "id": pid,
                "name": doc["name"],
                "slug": doc["slug"],
                "category": doc["category"],
                "description": doc.get("description"),
                "image_urls": doc.get("image_urls", []),
                "is_active": doc.get("is_active", True),
                "is_on_sale": doc.get("is_on_sale", False),
                "sale_price": doc.get("sale_price"),
                "discount_percent": doc.get("discount_percent"),
                "promo_code": doc.get("promo_code"),
                "sale_tag": doc.get("sale_tag"),
                "season": doc.get("season", "Summer"),
                "is_trending": doc.get("is_trending", False),
                "sales_count": sales_cnt,
                "order_count": order_cnt,
                "inquiry_count": inquiry_cnt,
                "trending_score": trending_score,
                "min_price": min_price,
                "max_price": max_price,
                "total_stock": total_stock,
                "variant_count": len(variants),
                "variants": variants,
                "colors": list(dict.fromkeys(v.get("color") for v in variants if v.get("color"))),
                "sizes": list(dict.fromkeys(v.get("size") for v in variants if v.get("size"))),
                "created_at": doc["created_at"],
                "updated_at": doc.get("updated_at", doc["created_at"]),
            })
        return items

    @staticmethod
    async def get_trending_products(limit: int = 12) -> List[dict]:
        """Fetch products ranked strictly by sales count, order count, and ML demand signals."""
        all_products = await ProductController.list_products(is_active=True, limit=200)

        # Sort strictly by sales_count DESC, order_count DESC, trending_score DESC, is_trending DESC
        sorted_products = sorted(
            all_products,
            key=lambda p: (
                p.get("sales_count", 0),
                p.get("order_count", 0),
                p.get("trending_score", 0.0),
                1 if p.get("is_trending") else 0,
            ),
            reverse=True,
        )
        return sorted_products[:limit]

    @staticmethod
    async def get_product(identifier: str) -> dict:
        db = get_database()
        query = {"slug": identifier}
        if ObjectId.is_valid(identifier):
            query = {"$or": [{"_id": ObjectId(identifier)}, {"slug": identifier}]}

        doc = await db["products"].find_one(query)
        if not doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

        variants_cursor = db["product_variants"].find({"product_id": str(doc["_id"])}).sort("created_at", 1)
        variants = []
        async for v in variants_cursor:
            variants.append({
                "id": str(v["_id"]),
                "product_id": v["product_id"],
                "sku": v["sku"],
                "size": v.get("size"),
                "color": v.get("color"),
                "price": v["price"],
                "currency": v.get("currency", "PKR"),
                "available_quantity": v.get("available_quantity", 0),
                "created_at": v.get("created_at"),
                "updated_at": v.get("updated_at"),
            })

        prices = [v["price"] for v in variants if "price" in v and v["price"] is not None]
        min_price = min(prices) if prices else 0.0
        max_price = max(prices) if prices else 0.0
        total_stock = sum(v.get("available_quantity", 0) for v in variants)

        # Single product sales aggregation
        sales_cnt = int(doc.get("sales_count") or 0)
        order_cnt = int(doc.get("order_count") or 0)
        inquiry_cnt = int(doc.get("inquiry_count") or 0)
        try:
            pid_str = str(doc["_id"])
            agg_res = await db["orders"].aggregate([
                {"$unwind": "$items"},
                {"$match": {"items.product_id": pid_str}},
                {
                    "$group": {
                        "_id": "$items.product_id",
                        "sales_count": {"$sum": {"$ifNull": ["$items.quantity", 1]}},
                        "order_count": {"$sum": 1},
                    }
                }
            ]).to_list(1)
            if agg_res:
                sales_cnt = max(sales_cnt, int(agg_res[0].get("sales_count", 0)))
                order_cnt = max(order_cnt, int(agg_res[0].get("order_count", 0)))

            d_doc = await db["product_demand"].find_one({"product_id": pid_str})
            if d_doc:
                inquiry_cnt = max(inquiry_cnt, int(d_doc.get("inquiry_count", 0)))
        except Exception:
            pass

        trending_score = round(
            (sales_cnt * 10.0) + (order_cnt * 5.0) + (inquiry_cnt * 2.0) + (5.0 if doc.get("is_trending") else 0.0),
            2
        )

        return {
            "id": str(doc["_id"]),
            "name": doc["name"],
            "slug": doc["slug"],
            "category": doc["category"],
            "description": doc.get("description"),
            "image_urls": doc.get("image_urls", []),
            "is_active": doc.get("is_active", True),
            "is_on_sale": doc.get("is_on_sale", False),
            "sale_price": doc.get("sale_price"),
            "discount_percent": doc.get("discount_percent"),
            "promo_code": doc.get("promo_code"),
            "sale_tag": doc.get("sale_tag"),
            "season": doc.get("season", "Summer"),
            "is_trending": doc.get("is_trending", False),
            "sales_count": sales_cnt,
            "order_count": order_cnt,
            "inquiry_count": inquiry_cnt,
            "trending_score": trending_score,
            "min_price": min_price,
            "max_price": max_price,
            "total_stock": total_stock,
            "variant_count": len(variants),
            "variants": variants,
            "colors": list(dict.fromkeys(v.get("color") for v in variants if v.get("color"))),
            "sizes": list(dict.fromkeys(v.get("size") for v in variants if v.get("size"))),
            "created_at": doc["created_at"],
            "updated_at": doc.get("updated_at", doc["created_at"]),
        }

    @staticmethod
    async def create_variant(product_id: str, data: ProductVariantCreate) -> dict:
        db = get_database()
        if not ObjectId.is_valid(product_id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid product ID")

        product = await db["products"].find_one({"_id": ObjectId(product_id)})
        if not product:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent product not found")

        sku = data.sku.strip()
        existing_sku = await db["product_variants"].find_one({"sku": sku})
        if existing_sku:
            sku = f"{sku}-{datetime.now().strftime('%S%f')[:4]}"

        now = datetime.now(timezone.utc)
        doc = ProductVariantModel(
            product_id=product_id,
            sku=sku,
            size=data.size,
            color=data.color,
            price=data.price,
            currency=data.currency,
            available_quantity=data.available_quantity,
            created_at=now,
            updated_at=now,
        ).model_dump(by_alias=True, exclude={"id"})

        result = await db["product_variants"].insert_one(doc)
        return {
            "id": str(result.inserted_id),
            "product_id": product_id,
            "sku": sku,
            "size": data.size,
            "color": data.color,
            "price": data.price,
            "currency": data.currency,
            "available_quantity": data.available_quantity,
            "created_at": now,
            "updated_at": now,
        }

    @staticmethod
    async def delete_variant(variant_id: str) -> dict:
        db = get_database()
        if not ObjectId.is_valid(variant_id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid variant ID")

        res = await db["product_variants"].delete_one({"_id": ObjectId(variant_id)})
        if res.deleted_count == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Variant not found")

        return {"status": "success", "message": "Variant deleted"}

    @staticmethod
    async def update_variant_stock(variant_id: str, new_quantity: int) -> dict:
        db = get_database()
        if not ObjectId.is_valid(variant_id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid variant ID")

        now = datetime.now(timezone.utc)
        res = await db["product_variants"].update_one(
            {"_id": ObjectId(variant_id)},
            {"$set": {"available_quantity": new_quantity, "updated_at": now}},
        )
        if res.matched_count == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Variant not found")

        doc = await db["product_variants"].find_one({"_id": ObjectId(variant_id)})
        return {
            "id": str(doc["_id"]),
            "product_id": doc["product_id"],
            "sku": doc["sku"],
            "size": doc.get("size"),
            "color": doc.get("color"),
            "price": doc["price"],
            "currency": doc.get("currency", "PKR"),
            "available_quantity": doc.get("available_quantity", 0),
            "created_at": doc.get("created_at"),
            "updated_at": doc.get("updated_at"),
        }

    @staticmethod
    async def bulk_import_from_json(items: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Bulk import products and variants with category auto-generation."""
        db = get_database()
        imported_products = 0
        imported_variants = 0
        created_categories = set()
        errors = []

        now = datetime.now(timezone.utc)

        for idx, row in enumerate(items):
            try:
                name = (row.get("name") or row.get("title") or "").strip()
                if not name:
                    continue

                category = (row.get("category") or "Dresses").strip()
                description = row.get("description", "")
                img_raw = row.get("image_urls") or row.get("image_url") or []
                if isinstance(img_raw, str):
                    for d in ["|", ";", "\n"]:
                        img_raw = img_raw.replace(d, ",")
                    image_urls = [u.strip().strip("'\"") for u in img_raw.split(",") if u.strip().strip("'\"")]
                elif isinstance(img_raw, list):
                    image_urls = [str(u).strip().strip("'\"") for u in img_raw if str(u).strip().strip("'\"")]
                else:
                    image_urls = []
                image_urls = list(dict.fromkeys(image_urls))

                if not image_urls:
                    image_urls = ["https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=600&q=80"]

                # Ensure category exists
                cat_slug = slugify(category)
                cat_exists = await db["categories"].find_one({"name": category})
                if not cat_exists:
                    await db["categories"].insert_one({
                        "name": category,
                        "slug": cat_slug,
                        "description": f"{category} boutique fashion collection",
                        "image_url": image_urls[0],
                        "icon": "Sparkles",
                        "display_order": 10,
                        "is_active": True,
                        "created_at": now,
                        "updated_at": now,
                    })
                    created_categories.add(category)

                # Check if product already exists by name
                slug = slugify(name)
                row_price = float(row.get("price", 49.99))
                is_on_sale_flag = bool(row.get("is_on_sale") or row.get("on_sale", False))
                sale_price = float(row["sale_price"]) if row.get("sale_price") not in (None, "") else None
                discount_percent = int(row["discount_percent"]) if row.get("discount_percent") not in (None, "") else None

                # Professional discount calculation logic
                if discount_percent and discount_percent > 0:
                    is_on_sale = True
                    if sale_price is None or sale_price <= 0:
                        sale_price = round(row_price * (1.0 - (discount_percent / 100.0)), 2)
                elif sale_price is not None and 0 < sale_price < row_price:
                    is_on_sale = True
                    if not discount_percent:
                        discount_percent = round(((row_price - sale_price) / row_price) * 100)
                elif is_on_sale_flag and sale_price is not None and sale_price < row_price:
                    is_on_sale = True
                    if not discount_percent:
                        discount_percent = round(((row_price - sale_price) / row_price) * 100)
                else:
                    # If discount is 0 or not on sale: price is exact regular price
                    is_on_sale = False
                    sale_price = None
                    discount_percent = 0

                promo_code = row.get("promo_code")
                sale_tag = row.get("sale_tag")
                season = row.get("season", "Summer")
                is_trending = bool(row.get("is_trending", False))

                prod = await db["products"].find_one({"$or": [{"name": name}, {"slug": slug}]})
                if not prod:
                    prod_doc = ProductModel(
                        name=name,
                        slug=slug,
                        category=category,
                        description=description,
                        image_urls=image_urls,
                        is_active=True,
                        is_on_sale=is_on_sale,
                        sale_price=sale_price,
                        discount_percent=discount_percent,
                        promo_code=promo_code,
                        sale_tag=sale_tag,
                        season=season,
                        is_trending=is_trending,
                        created_at=now,
                        updated_at=now,
                    ).model_dump(by_alias=True, exclude={"id"})
                    p_res = await db["products"].insert_one(prod_doc)
                    prod_id = str(p_res.inserted_id)
                    imported_products += 1
                else:
                    prod_id = str(prod["_id"])
                    # Merge newly imported image URLs with existing product images
                    existing_imgs = prod.get("image_urls") or []
                    merged_imgs = list(dict.fromkeys(existing_imgs + image_urls))
                    update_fields = {"updated_at": now}
                    if merged_imgs != existing_imgs:
                        update_fields["image_urls"] = merged_imgs
                    update_fields["is_on_sale"] = is_on_sale
                    update_fields["sale_price"] = sale_price
                    update_fields["discount_percent"] = discount_percent
                    if promo_code:
                        update_fields["promo_code"] = promo_code
                    if sale_tag:
                        update_fields["sale_tag"] = sale_tag

                    await db["products"].update_one(
                        {"_id": prod["_id"]},
                        {"$set": update_fields}
                    )

                # Parse variants
                # Supports either explicit variants array or row fields: color, size, price, stock (single or comma-separated)
                v_list = row.get("variants")
                if not v_list:
                    raw_color = str(row.get("color") or row.get("colors") or "Default")
                    raw_size = str(row.get("size") or row.get("sizes") or "Standard")
                    raw_stock_val = (
                        row.get("stock_quantity")
                        if row.get("stock_quantity") is not None
                        else (
                            row.get("available_quantity")
                            if row.get("available_quantity") is not None
                            else (row.get("stock") if row.get("stock") is not None else row.get("quantity", 10))
                        )
                    )
                    raw_stock = str(raw_stock_val)
                    raw_price = float(row.get("price", 49.99))
                    raw_sku = (row.get("sku") or "").strip()

                    # Standardize delimiters
                    clean_color = raw_color
                    for d in ["/", "|", ";"]:
                        clean_color = clean_color.replace(d, ",")
                    c_list = [c.strip() for c in clean_color.split(",") if c.strip()] or ["Default"]

                    clean_size = raw_size
                    for d in ["/", "|", ";"]:
                        clean_size = clean_size.replace(d, ",")
                    s_list = [s.strip() for s in clean_size.split(",") if s.strip()] or ["Standard"]

                    clean_stock = raw_stock
                    for d in ["/", "|", ";"]:
                        clean_stock = clean_stock.replace(d, ",")

                    st_list = []
                    if "," in clean_stock:
                        for s_item in clean_stock.split(","):
                            try:
                                st_list.append(int(float(s_item.strip())))
                            except ValueError:
                                st_list.append(10)
                    else:
                        try:
                            st_list = [int(float(clean_stock.strip()))]
                        except ValueError:
                            st_list = [10]

                    v_list = []
                    for c_val in c_list:
                        for s_i, s_val in enumerate(s_list):
                            curr_qty = st_list[s_i] if s_i < len(st_list) else st_list[-1]
                            if raw_sku:
                                if raw_sku.upper().endswith(f"-{s_val.upper()}") or raw_sku.upper().endswith(f"_{s_val.upper()}"):
                                    item_sku = raw_sku
                                elif len(s_list) > 1 or len(c_list) > 1:
                                    item_sku = f"{raw_sku}-{s_val.upper()}"
                                else:
                                    item_sku = raw_sku
                            else:
                                item_sku = None

                            v_list.append({
                                "color": c_val,
                                "size": s_val,
                                "price": raw_price,
                                "available_quantity": curr_qty,
                                "sku": item_sku,
                            })

                base_prefix = re.sub(r"[^A-Za-z0-9]", "", slug.upper())[:4] or "PROD"
                for v_idx, v in enumerate(v_list):
                    color = (v.get("color") or "Default").strip()
                    size = (v.get("size") or "Standard").strip()
                    price = float(v.get("price", 49.99))
                    qty = int(v.get("available_quantity", v.get("stock", v.get("quantity", 10))))
                    sku = v.get("sku")

                    # Check if variant already exists for this product with the same color & size
                    v_exists = await db["product_variants"].find_one({
                        "product_id": prod_id,
                        "color": color,
                        "size": size,
                    })

                    # If not found by (product_id, color, size), check if sku was provided
                    if not v_exists and sku:
                        v_by_sku = await db["product_variants"].find_one({"sku": sku})
                        if v_by_sku:
                            if v_by_sku.get("product_id") == prod_id and v_by_sku.get("color") == color and v_by_sku.get("size") == size:
                                v_exists = v_by_sku
                            else:
                                # SKU conflict with another size or product; make unique by appending size
                                sku = f"{sku}-{size.upper()}"
                                v_exists = await db["product_variants"].find_one({"sku": sku})

                    if not sku:
                        sku = f"{base_prefix}-{color[:3].upper()}-{size[:2].upper()}-{v_idx+1}"

                    if v_exists:
                        await db["product_variants"].update_one(
                            {"_id": v_exists["_id"]},
                            {"$set": {
                                "price": price,
                                "available_quantity": qty,
                                "size": size,
                                "color": color,
                                "sku": sku,
                                "updated_at": now,
                            }},
                        )
                    else:
                        await db["product_variants"].insert_one({
                            "product_id": prod_id,
                            "sku": sku,
                            "size": size,
                            "color": color,
                            "price": price,
                            "currency": "PKR",
                            "available_quantity": qty,
                            "created_at": now,
                            "updated_at": now,
                        })
                    imported_variants += 1

            except Exception as row_err:
                errors.append(f"Row {idx + 1}: {str(row_err)}")

        return {
            "success": True,
            "imported_products": imported_products,
            "imported_variants": imported_variants,
            "created_categories": list(created_categories),
            "errors": errors,
        }

    @staticmethod
    async def export_to_csv() -> str:
        """Export all products and variants to a CSV formatted string in high performance batch."""
        db = get_database()
        output = io.StringIO()
        writer = csv.writer(output)

        # Header
        writer.writerow([
            "Product Name",
            "Category",
            "Description",
            "Image URLs",
            "SKU",
            "Color",
            "Size",
            "Price",
            "Stock Quantity",
            "Status",
            "Is On Sale",
            "Sale Price",
            "Discount %",
            "Promo Code",
            "Sale Tag",
            "Season",
        ])

        # 1. Fetch only necessary fields for maximum speed
        products = await db["products"].find(
            {},
            {"name": 1, "category": 1, "description": 1, "image_urls": 1, "is_active": 1, "is_on_sale": 1, "sale_price": 1, "discount_percent": 1, "promo_code": 1, "sale_tag": 1, "season": 1},
        ).sort("name", 1).to_list(length=1000)

        all_variants = await db["product_variants"].find(
            {},
            {"product_id": 1, "sku": 1, "color": 1, "size": 1, "price": 1, "available_quantity": 1},
        ).to_list(length=10000)

        # Group variants by product_id
        variants_by_prod = {}
        for v in all_variants:
            p_id = str(v.get("product_id"))
            variants_by_prod.setdefault(p_id, []).append(v)

        for prod in products:
            prod_id = str(prod["_id"])
            p_name = prod["name"]
            category = prod["category"]
            desc = prod.get("description", "")
            imgs = ", ".join(prod.get("image_urls", []))
            is_active = "Active" if prod.get("is_active", True) else "Inactive"
            is_on_sale = "Yes" if prod.get("is_on_sale", False) else "No"
            sale_price = prod.get("sale_price") or ""
            disc_percent = prod.get("discount_percent") or ""
            promo_code = prod.get("promo_code") or ""
            sale_tag = prod.get("sale_tag") or ""
            season = prod.get("season") or "Summer"

            variants = variants_by_prod.get(prod_id, [])
            if not variants:
                writer.writerow([p_name, category, desc, imgs, "", "", "", "", 0, is_active, is_on_sale, sale_price, disc_percent, promo_code, sale_tag, season])
            else:
                for v in variants:
                    writer.writerow([
                        p_name,
                        category,
                        desc,
                        imgs,
                        v.get("sku", ""),
                        v.get("color", ""),
                        v.get("size", ""),
                        v.get("price", 0.0),
                        v.get("available_quantity", 0),
                        is_active,
                        is_on_sale,
                        sale_price,
                        disc_percent,
                        promo_code,
                        sale_tag,
                        season,
                    ])

        return output.getvalue()

    @staticmethod
    async def get_recommendations(
        query: str = "",
        customer_phone: Optional[str] = None,
        customer_id: Optional[str] = None,
        limit: int = 6,
    ) -> List[dict]:
        """Fetch personalized, ML scored recommendations."""
        from ai.recommendation_engine import recommendation_engine
        db = get_database()
        return await recommendation_engine.get_personalized_recommendations(
            db=db,
            user_message=query,
            customer_phone=customer_phone,
            customer_id=customer_id,
            limit=limit,
        )


product_controller = ProductController()
