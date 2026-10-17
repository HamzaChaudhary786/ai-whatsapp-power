import csv
import io
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Body, Depends, File, Query, Response, UploadFile
from controllers.category_controller import category_controller
from models.category_model import CategoryCreate, CategoryResponse, CategoryUpdate
from utils.dependencies import require_staff

router = APIRouter(prefix="/categories", tags=["Categories Taxonomy"])


@router.get("/", response_model=List[CategoryResponse])
async def list_categories(
    include_inactive: bool = Query(False, description="Include inactive categories"),
):
    """Retrieve all categories with their real-time product counts (Public)."""
    return await category_controller.list_categories(include_inactive=include_inactive)


@router.get("/export-csv")
async def export_categories_csv():
    """Export all categories to a downloadable CSV (Public/Staff)."""
    csv_content = await category_controller.export_to_csv()
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=boutique_categories_export.csv"},
    )


@router.post("/bulk-import")
async def bulk_import_categories(items: List[Dict[str, Any]] = Body(...), _staff: dict = Depends(require_staff)):
    """Bulk import categories from JSON payload (Staff/Admin access only)."""
    return await category_controller.bulk_import_from_json(items)


@router.post("/bulk-import-csv")
async def bulk_import_categories_csv(file: UploadFile = File(...), _staff: dict = Depends(require_staff)):
    """Upload and parse a CSV file of categories (Staff/Admin access only)."""
    content = await file.read()
    decoded = content.decode("utf-8-sig", errors="ignore").lstrip("\ufeff")
    reader = csv.DictReader(io.StringIO(decoded))

    rows = []
    for r in reader:
        r_clean = {k.lstrip("\ufeff").strip().lower(): (v.strip() if isinstance(v, str) else v) for k, v in r.items() if k}
        name = (
            r.get("Category Name") or r.get("Category") or r.get("name") or r.get("title") or
            r_clean.get("category name") or r_clean.get("category") or r_clean.get("name") or r_clean.get("title") or ""
        ).strip()
        if not name:
            continue
        slug = (r.get("Slug") or r.get("slug") or r_clean.get("slug") or "").strip()
        description = (r.get("Description") or r.get("description") or r_clean.get("description") or "").strip()
        image_url = (
            r.get("Image URL") or r.get("image_url") or r.get("Image") or
            r_clean.get("image url") or r_clean.get("image_url") or r_clean.get("image") or ""
        ).strip()
        icon = (r.get("Icon") or r.get("icon") or r_clean.get("icon") or "Sparkles").strip()
        display_order = r.get("Display Order") or r.get("display_order") or r_clean.get("display order") or r_clean.get("display_order") or 0
        is_active = r.get("Is Active") if r.get("Is Active") is not None else (
            r_clean.get("is active") if r_clean.get("is active") is not None else True
        )

        rows.append({
            "name": name,
            "slug": slug,
            "description": description,
            "image_url": image_url,
            "icon": icon,
            "display_order": display_order,
            "is_active": is_active,
        })

    return await category_controller.bulk_import_from_json(rows)


@router.get("/{identifier}", response_model=CategoryResponse)
async def get_category(identifier: str):
    """Get single category details by slug or ObjectId (Public)."""
    return await category_controller.get_category(identifier)


@router.post("/", response_model=CategoryResponse)
async def create_category(data: CategoryCreate, _staff: dict = Depends(require_staff)):
    """Create a new category in the catalog taxonomy (Staff/Admin access only)."""
    return await category_controller.create_category(data)


@router.put("/{identifier}", response_model=CategoryResponse)
async def update_category(identifier: str, data: CategoryUpdate, _staff: dict = Depends(require_staff)):
    """Update category properties and cascade name changes to products (Staff/Admin access only)."""
    return await category_controller.update_category(identifier, data)


@router.delete("/{identifier}")
async def delete_category(identifier: str, _staff: dict = Depends(require_staff)):
    """Delete a category (prevents deletion if products exist) (Staff/Admin access only)."""
    return await category_controller.delete_category(identifier)
