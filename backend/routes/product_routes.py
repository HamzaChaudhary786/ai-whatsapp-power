import csv
import io
import os
import uuid
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Body, Depends, File, HTTPException, Query, Response, UploadFile, status
from controllers.product_controller import product_controller
from models.product_model import ProductCreate, ProductResponse, ProductUpdate
from models.product_variant_model import ProductVariantCreate, ProductVariantResponse
from utils.dependencies import require_staff

router = APIRouter(prefix="/products", tags=["Products & Catalog"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB per image


@router.post("/upload-images")
async def upload_product_images(files: List[UploadFile] = File(...), _staff: dict = Depends(require_staff)):
    """Upload multiple local product images with strict validation (Staff/Admin access only)."""
    urls = []
    for f in files:
        if not f.filename:
            continue
        ext = os.path.splitext(f.filename)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid file type '{ext}'. Only {', '.join(sorted(ALLOWED_EXTENSIONS))} images are permitted.",
            )
        if f.content_type and f.content_type not in ALLOWED_MIME_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid MIME type '{f.content_type}'. Only image files are permitted.",
            )
        content = await f.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File exceeds maximum allowed size of 10MB.",
            )
        unique_name = f"luxe_{uuid.uuid4().hex[:12]}{ext}"
        filepath = os.path.join(UPLOAD_DIR, unique_name)
        with open(filepath, "wb") as out_file:
            out_file.write(content)
        urls.append(f"/static/uploads/{unique_name}")
    return {"urls": urls}


@router.post("/", response_model=ProductResponse)
async def create_product(data: ProductCreate, _staff: dict = Depends(require_staff)):
    """Add a new product to the catalog (Staff/Admin access only)."""
    return await product_controller.create_product(data)


@router.post("/with-variants")
async def create_product_with_variants(payload: Dict[str, Any] = Body(...), _staff: dict = Depends(require_staff)):
    """Create a product along with multiple size and color variants in one single action (Staff/Admin access only)."""
    return await product_controller.create_product_with_variants(payload)


@router.get("/")
async def list_products(
    category: Optional[str] = Query(None, description="Filter by category"),
    is_active: Optional[bool] = Query(None, description="Filter active status"),
    limit: int = Query(100, ge=1, le=200),
    skip: int = Query(0, ge=0),
):
    """List products with variants, price range, and total stock (Public)."""
    return await product_controller.list_products(category=category, is_active=is_active, limit=limit, skip=skip)


@router.get("/trending")
async def get_trending_products(limit: int = Query(12, ge=1, le=50)):
    """List top trending products ordered strictly by sales volume, order count, and ML demand (Public)."""
    return await product_controller.get_trending_products(limit=limit)


@router.get("/export-csv")
async def export_products_csv(_staff: dict = Depends(require_staff)):
    """Export complete product catalog and variants to a downloadable CSV file (Staff/Admin access only)."""
    csv_content = await product_controller.export_to_csv()
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=boutique_catalog_export.csv"},
    )


@router.post("/bulk-import")
async def bulk_import_products(items: List[Dict[str, Any]] = Body(...), _staff: dict = Depends(require_staff)):
    """Bulk import products and variants from JSON payload (Staff/Admin access only)."""
    return await product_controller.bulk_import_from_json(items)


@router.post("/bulk-import-csv")
async def bulk_import_csv(file: UploadFile = File(...), _staff: dict = Depends(require_staff)):
    """Upload and parse a CSV file of products & variants (Staff/Admin access only). Supports multiple comma-separated image URLs."""
    content = await file.read()
    decoded = content.decode("utf-8-sig", errors="ignore").lstrip("\ufeff")
    reader = csv.DictReader(io.StringIO(decoded))

    rows = []
    for r in reader:
        # Standardize field names flexibly
        r_clean = {k.lstrip("\ufeff").strip().lower(): (v.strip() if isinstance(v, str) else v) for k, v in r.items() if k}

        name = (
            r.get("Product Name") or r.get("name") or r.get("Title") or r.get("title") or
            r_clean.get("product name") or r_clean.get("name") or r_clean.get("title") or ""
        ).strip()
        if not name:
            continue
        category = (
            r.get("Category") or r.get("category") or
            r_clean.get("category") or "Dresses"
        ).strip()
        description = (
            r.get("Description") or r.get("description") or
            r_clean.get("description") or ""
        ).strip()

        # Extract multiple comma-separated image URLs (e.g. "url1, url2, url3")
        image_urls_raw = (
            r.get("Image URLs") or r.get("Image URL") or r.get("image_urls") or r.get("image_url") or
            r.get("Images") or r.get("images") or r.get("Image") or r.get("image") or
            r_clean.get("image urls") or r_clean.get("image url") or r_clean.get("image_urls") or
            r_clean.get("image_url") or r_clean.get("images") or r_clean.get("image") or ""
        )

        parsed_images = []
        if isinstance(image_urls_raw, str) and image_urls_raw.strip():
            # Support comma, semicolon, pipe, and newline delimiters
            temp_str = image_urls_raw
            for delimiter in ["|", ";", "\n"]:
                temp_str = temp_str.replace(delimiter, ",")
            for u in temp_str.split(","):
                clean_url = u.strip().strip("'\"")
                if clean_url and clean_url not in parsed_images:
                    parsed_images.append(clean_url)

        sku = (r.get("SKU") or r.get("sku") or r_clean.get("sku") or "").strip()
        color = (r.get("Color") or r.get("color") or r_clean.get("color") or "Default").strip()
        size = (r.get("Size") or r.get("size") or r_clean.get("size") or "Standard").strip()
        price_str = (r.get("Price") or r.get("price") or r_clean.get("price") or "49.99").strip()
        stock_str = (r.get("Stock Quantity") or r.get("stock") or r.get("quantity") or r_clean.get("stock quantity") or r_clean.get("stock") or "10").strip()

        try:
            price = float(price_str.replace("$", "").replace(",", "").strip())
        except ValueError:
            price = 49.99

        # Parse multi-size (e.g. "S,M,L,XL" or "S, M, L, XL" or "S/M/L/XL" or single "S")
        if "," in size:
            sizes = [s.strip() for s in size.split(",") if s.strip()]
        elif "/" in size and not ("/" in name or "/" in category):
            sizes = [s.strip() for s in size.split("/") if s.strip()]
        elif "|" in size:
            sizes = [s.strip() for s in size.split("|") if s.strip()]
        else:
            sizes = [size] if size else ["Standard"]

        # Parse multi-color (e.g. "Green, Blue" or single "Green")
        if "," in color:
            colors = [c.strip() for c in color.split(",") if c.strip()]
        elif "/" in color:
            colors = [c.strip() for c in color.split("/") if c.strip()]
        elif "|" in color:
            colors = [c.strip() for c in color.split("|") if c.strip()]
        else:
            colors = [color] if color else ["Default"]

        # Parse stock quantities (e.g. "10,11,23,19" or "10 / 11 / 23 / 19" or single "10")
        stock_values = []
        clean_stock_str = stock_str
        for delimiter in ["/", "|", ";"]:
            clean_stock_str = clean_stock_str.replace(delimiter, ",")
        if "," in clean_stock_str:
            for s_item in clean_stock_str.split(","):
                try:
                    stock_values.append(int(float(s_item.strip())))
                except ValueError:
                    stock_values.append(10)
        else:
            try:
                stock_values = [int(float(clean_stock_str.strip()))]
            except ValueError:
                stock_values = [10]

        # Generate variant records for each color and size combination
        row_variants = []
        for col in colors:
            for sz_idx, sz in enumerate(sizes):
                curr_stock = stock_values[sz_idx] if sz_idx < len(stock_values) else stock_values[-1]
                
                # Smart unique SKU generation
                if sku:
                    clean_sku = sku.strip()
                    if clean_sku.upper().endswith(f"-{sz.upper()}") or clean_sku.upper().endswith(f"_{sz.upper()}"):
                        v_sku = clean_sku
                    elif len(sizes) > 1 or len(colors) > 1:
                        v_sku = f"{clean_sku}-{sz.upper()}"
                    else:
                        v_sku = clean_sku
                else:
                    v_sku = None

                row_variants.append({
                    "sku": v_sku,
                    "color": col,
                    "size": sz,
                    "price": price,
                    "available_quantity": curr_stock,
                })

        is_on_sale_val = r.get("Is On Sale") or r.get("is_on_sale") or r.get("Sale") or r_clean.get("is on sale") or ""
        is_on_sale_flag = str(is_on_sale_val).strip().lower() in ["true", "1", "yes", "y"]
        sale_price_raw = r.get("Sale Price") or r.get("sale_price") or r_clean.get("sale price") or ""
        sale_price = None
        if sale_price_raw:
            try:
                sale_price = float(sale_price_raw.replace("$", "").replace(",", "").strip())
            except ValueError:
                sale_price = None
        disc_raw = r.get("Discount %") or r.get("discount_percent") or r_clean.get("discount %") or ""
        discount_percent = None
        if disc_raw:
            try:
                discount_percent = int(float(disc_raw.replace("%", "").strip()))
            except ValueError:
                discount_percent = None

        # Professional discount calculation:
        # If discount % is provided and > 0, calculate sale_price
        if discount_percent and discount_percent > 0:
            is_on_sale = True
            if sale_price is None or sale_price <= 0:
                sale_price = round(price * (1.0 - (discount_percent / 100.0)), 2)
        elif sale_price is not None and 0 < sale_price < price:
            is_on_sale = True
            if not discount_percent:
                discount_percent = round(((price - sale_price) / price) * 100)
        elif is_on_sale_flag and sale_price is not None and sale_price < price:
            is_on_sale = True
            if not discount_percent:
                discount_percent = round(((price - sale_price) / price) * 100)
        else:
            # If discount is 0 or not on sale: product price is exact original price
            is_on_sale = False
            sale_price = None
            discount_percent = 0

        promo_code = (r.get("Promo Code") or r.get("promo_code") or r_clean.get("promo code") or "").strip() or None
        sale_tag = (r.get("Sale Tag") or r.get("sale_tag") or r_clean.get("sale tag") or "").strip() or None
        season = (r.get("Season") or r.get("season") or r_clean.get("season") or "Summer").strip()

        rows.append({
            "name": name,
            "category": category,
            "description": description,
            "image_urls": parsed_images,
            "sku": sku,
            "color": colors[0] if colors else "Default",
            "size": sizes[0] if sizes else "Standard",
            "price": price,
            "stock": sum(stock_values),
            "variants": row_variants,
            "is_on_sale": is_on_sale,
            "sale_price": sale_price,
            "discount_percent": discount_percent,
            "promo_code": promo_code,
            "sale_tag": sale_tag,
            "season": season,
        })

    return await product_controller.bulk_import_from_json(rows)


@router.get("/{identifier}")
async def get_product(identifier: str):
    """Get single product with all its variants by slug or ObjectId (Public)."""
    return await product_controller.get_product(identifier)


@router.put("/{product_id}")
async def update_product(product_id: str, data: ProductUpdate, _staff: dict = Depends(require_staff)):
    """Update product details (Staff/Admin access only)."""
    return await product_controller.update_product(product_id, data)


@router.delete("/{product_id}")
async def delete_product(product_id: str, _staff: dict = Depends(require_staff)):
    """Delete a product and all of its associated variants (Staff/Admin access only)."""
    return await product_controller.delete_product(product_id)


@router.post("/{product_id}/variants", response_model=ProductVariantResponse)
async def create_product_variant(product_id: str, data: ProductVariantCreate, _staff: dict = Depends(require_staff)):
    """Add a size/color variant to an existing product (Staff/Admin access only)."""
    return await product_controller.create_variant(product_id, data)


@router.delete("/variants/{variant_id}")
async def delete_product_variant(variant_id: str, _staff: dict = Depends(require_staff)):
    """Delete an individual product variant (Staff/Admin access only)."""
    return await product_controller.delete_variant(variant_id)


@router.patch("/variants/{variant_id}/stock", response_model=ProductVariantResponse)
async def update_variant_stock(variant_id: str, quantity: int = Body(..., embed=True, ge=0), _staff: dict = Depends(require_staff)):
    """Update inventory count for a specific variant (Staff/Admin access only)."""
    return await product_controller.update_variant_stock(variant_id, quantity)
