import csv
import io
import re
from datetime import datetime, timezone
from typing import List, Optional
from bson import ObjectId
from fastapi import HTTPException, status
from db.mongodb import get_database
from models.category_model import CategoryCreate, CategoryModel, CategoryUpdate


def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    return re.sub(r"[\s_-]+", "-", text).strip("-")


class CategoryController:
    """Business logic for Product Categories Taxonomy."""

    @staticmethod
    async def list_categories(include_inactive: bool = False) -> List[dict]:
        db = get_database()
        query = {} if include_inactive else {"is_active": True}

        try:
            # Seed defaults if collection has no items
            count = await db["categories"].count_documents({})
            if count == 0:
                await CategoryController.seed_default_categories()

            cursor = db["categories"].find(query).sort([("display_order", 1), ("name", 1)])
            categories = []
            async for doc in cursor:
                cat_name = doc["name"]
                # Count products belonging to this category
                prod_count = await db["products"].count_documents({"category": cat_name})
                categories.append({
                    "id": str(doc["_id"]),
                    "name": doc["name"],
                    "slug": doc["slug"],
                    "description": doc.get("description"),
                    "image_url": doc.get("image_url"),
                    "icon": doc.get("icon", "Sparkles"),
                    "display_order": doc.get("display_order", 0),
                    "is_active": doc.get("is_active", True),
                    "product_count": prod_count,
                    "created_at": doc.get("created_at", datetime.now(timezone.utc)),
                    "updated_at": doc.get("updated_at", datetime.now(timezone.utc)),
                })
            return categories
        except Exception as e:
            print(f"[ERROR] CategoryController.list_categories DB error: {e}")
            return []

    @staticmethod
    async def get_category(identifier: str) -> dict:
        db = get_database()
        query = {"slug": identifier}
        if ObjectId.is_valid(identifier):
            query = {"$or": [{"_id": ObjectId(identifier)}, {"slug": identifier}]}

        doc = await db["categories"].find_one(query)
        if not doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

        prod_count = await db["products"].count_documents({"category": doc["name"]})
        return {
            "id": str(doc["_id"]),
            "name": doc["name"],
            "slug": doc["slug"],
            "description": doc.get("description"),
            "image_url": doc.get("image_url"),
            "icon": doc.get("icon", "Sparkles"),
            "display_order": doc.get("display_order", 0),
            "is_active": doc.get("is_active", True),
            "product_count": prod_count,
            "created_at": doc.get("created_at", datetime.now(timezone.utc)),
            "updated_at": doc.get("updated_at", datetime.now(timezone.utc)),
        }

    @staticmethod
    async def create_category(data: CategoryCreate) -> dict:
        db = get_database()
        slug = data.slug or slugify(data.name)

        existing = await db["categories"].find_one({"$or": [{"slug": slug}, {"name": data.name}]})
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Category '{data.name}' or slug '{slug}' already exists",
            )

        now = datetime.now(timezone.utc)
        doc = CategoryModel(
            name=data.name.strip(),
            slug=slug,
            description=data.description,
            image_url=data.image_url,
            icon=data.icon or "Sparkles",
            display_order=data.display_order,
            is_active=data.is_active,
            created_at=now,
            updated_at=now,
        ).model_dump(by_alias=True, exclude={"id"})

        res = await db["categories"].insert_one(doc)
        return {
            "id": str(res.inserted_id),
            "name": data.name.strip(),
            "slug": slug,
            "description": data.description,
            "image_url": data.image_url,
            "icon": data.icon or "Sparkles",
            "display_order": data.display_order,
            "is_active": data.is_active,
            "product_count": 0,
            "created_at": now,
            "updated_at": now,
        }

    @staticmethod
    async def update_category(identifier: str, data: CategoryUpdate) -> dict:
        db = get_database()
        query = {"slug": identifier}
        if ObjectId.is_valid(identifier):
            query = {"$or": [{"_id": ObjectId(identifier)}, {"slug": identifier}]}

        existing = await db["categories"].find_one(query)
        if not existing:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

        update_dict = {}
        old_name = existing["name"]
        new_name = data.name.strip() if data.name else None

        if new_name and new_name != old_name:
            update_dict["name"] = new_name
            update_dict["slug"] = slugify(new_name)
        if data.description is not None:
            update_dict["description"] = data.description
        if data.image_url is not None:
            update_dict["image_url"] = data.image_url
        if data.icon is not None:
            update_dict["icon"] = data.icon
        if data.display_order is not None:
            update_dict["display_order"] = data.display_order
        if data.is_active is not None:
            update_dict["is_active"] = data.is_active

        update_dict["updated_at"] = datetime.now(timezone.utc)

        await db["categories"].update_one({"_id": existing["_id"]}, {"$set": update_dict})

        # If category name changed, cascade update to products
        if new_name and new_name != old_name:
            await db["products"].update_many(
                {"category": old_name},
                {"$set": {"category": new_name}},
            )

        return await CategoryController.get_category(str(existing["_id"]))

    @staticmethod
    async def delete_category(identifier: str) -> dict:
        db = get_database()
        query = {"slug": identifier}
        if ObjectId.is_valid(identifier):
            query = {"$or": [{"_id": ObjectId(identifier)}, {"slug": identifier}]}

        existing = await db["categories"].find_one(query)
        if not existing:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

        # Check if products exist in category
        prod_count = await db["products"].count_documents({"category": existing["name"]})
        if prod_count > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot delete category '{existing['name']}' because it contains {prod_count} product(s). Reassign products first.",
            )

        await db["categories"].delete_one({"_id": existing["_id"]})
        return {"status": "success", "message": f"Category '{existing['name']}' deleted successfully"}

    @staticmethod
    async def seed_default_categories() -> None:
        db = get_database()
        defaults = [
            {
                "name": "Dresses",
                "slug": "dresses",
                "description": "Elegant gowns, cocktail midi dresses, and casual linen frocks.",
                "image_url": "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=600&q=80",
                "icon": "Sparkles",
                "display_order": 1,
            },
            {
                "name": "Tops & Shirts",
                "slug": "tops-shirts",
                "description": "Crisp linen button-downs, silk blouses, and everyday tailored shirts.",
                "image_url": "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=600&q=80",
                "icon": "Shirt",
                "display_order": 2,
            },
            {
                "name": "Outerwear & Jackets",
                "slug": "outerwear-jackets",
                "description": "Cashmere blend coats, structured tailored blazers, and trench coats.",
                "image_url": "https://images.unsplash.com/photo-1539533018447-63fcce667883?auto=format&fit=crop&w=600&q=80",
                "icon": "Layers",
                "display_order": 3,
            },
            {
                "name": "Pants & Bottoms",
                "slug": "pants-bottoms",
                "description": "Tailored trousers, linen wide-leg pants, and chic denim skirts.",
                "image_url": "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=600&q=80",
                "icon": "Tag",
                "display_order": 4,
            },
            {
                "name": "Accessories & Bags",
                "slug": "accessories-bags",
                "description": "Structured leather totes, statement belts, and boutique silk scarves.",
                "image_url": "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=600&q=80",
                "icon": "ShoppingBag",
                "display_order": 5,
            },
        ]

        now = datetime.now(timezone.utc)
        for item in defaults:
            await db["categories"].update_one(
                {"slug": item["slug"]},
                {
                    "$setOnInsert": {
                        "name": item["name"],
                        "slug": item["slug"],
                        "description": item["description"],
                        "image_url": item["image_url"],
                        "icon": item["icon"],
                        "display_order": item["display_order"],
                        "is_active": True,
                        "created_at": now,
                        "updated_at": now,
                    }
                },
                upsert=True,
            )

    @staticmethod
    async def bulk_import_from_json(items: List[dict]) -> dict:
        """Bulk import or upsert categories from JSON records."""
        db = get_database()
        imported_count = 0
        updated_count = 0
        errors = []
        now = datetime.now(timezone.utc)

        for idx, row in enumerate(items):
            try:
                name = (
                    row.get("Category Name") or row.get("name") or row.get("category") or ""
                ).strip()
                if not name:
                    continue

                slug = (row.get("Slug") or row.get("slug") or slugify(name)).strip()
                description = (row.get("Description") or row.get("description") or "").strip() or None
                image_url = (row.get("Image URL") or row.get("image_url") or "").strip() or None
                icon = (row.get("Icon") or row.get("icon") or "Sparkles").strip() or "Sparkles"

                disp_order_val = row.get("Display Order") or row.get("display_order") or 0
                try:
                    display_order = int(disp_order_val)
                except (ValueError, TypeError):
                    display_order = 0

                active_val = row.get("Is Active") if row.get("Is Active") is not None else row.get("is_active", True)
                if isinstance(active_val, str):
                    is_active = active_val.strip().lower() in ["true", "1", "yes", "y"]
                else:
                    is_active = bool(active_val)

                existing = await db["categories"].find_one({"$or": [{"slug": slug}, {"name": name}]})
                if existing:
                    await db["categories"].update_one(
                        {"_id": existing["_id"]},
                        {"$set": {
                            "name": name,
                            "slug": slug,
                            "description": description if description is not None else existing.get("description"),
                            "image_url": image_url if image_url is not None else existing.get("image_url"),
                            "icon": icon,
                            "display_order": display_order,
                            "is_active": is_active,
                            "updated_at": now,
                        }}
                    )
                    updated_count += 1
                else:
                    doc = CategoryModel(
                        name=name,
                        slug=slug,
                        description=description,
                        image_url=image_url or "https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=600&q=80",
                        icon=icon,
                        display_order=display_order,
                        is_active=is_active,
                        created_at=now,
                        updated_at=now,
                    ).model_dump(by_alias=True, exclude={"id"})
                    await db["categories"].insert_one(doc)
                    imported_count += 1
            except Exception as e:
                errors.append(f"Row {idx + 1}: {str(e)}")

        return {
            "success": True,
            "imported_count": imported_count,
            "imported_categories": imported_count,
            "updated_categories": updated_count,
            "errors": errors,
        }

    @staticmethod
    async def export_to_csv() -> str:
        """Export all categories to CSV formatted string."""
        db = get_database()
        output = io.StringIO()
        writer = csv.writer(output)

        writer.writerow([
            "Category Name",
            "Slug",
            "Description",
            "Image URL",
            "Icon",
            "Display Order",
            "Is Active",
        ])

        cursor = db["categories"].find({}).sort([("display_order", 1), ("name", 1)])
        async for doc in cursor:
            writer.writerow([
                doc.get("name", ""),
                doc.get("slug", ""),
                doc.get("description", "") or "",
                doc.get("image_url", "") or "",
                doc.get("icon", "Sparkles"),
                doc.get("display_order", 0),
                "Yes" if doc.get("is_active", True) else "No",
            ])

        return output.getvalue()


category_controller = CategoryController()

