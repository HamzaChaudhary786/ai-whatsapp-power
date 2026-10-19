import re
from typing import Optional
from config.settings import settings


def get_product_storefront_url(product_id: Optional[str] = None) -> str:
    """Returns the full storefront website URL for a specific product ID or the root storefront."""
    return settings.get_product_url(product_id)


def clean_chat_reply_text(
    text: str,
    product_id: Optional[str] = None,
    include_store_if_missing: bool = False,
) -> str:
    """
    Sanitizes AI/agent text by:
    1. Completely removing raw image URLs, photo preview links, and 'Product Photo' labels.
    2. Replacing them with the official website URL with product ID (STOREFRONT_URL/<id>)
       or the general website URL (STOREFRONT_URL).
    """
    if not text:
        return ""

    cleaned = str(text)

    # 1. Remove explicit photo lines (e.g. '📸 *Product Photo:* https://...')
    cleaned = re.sub(
        r"📸\s*\*?Product Photo(?: Preview)?:\*?\s*https?://\S+",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )
    cleaned = re.sub(
        r"📸\s*Product Photo(?: Preview)?:\s*https?://\S+",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )
    cleaned = re.sub(
        r"Photo:\s*https?://\S+",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )

    # 2. Remove standalone raw image URLs (Unsplash, static uploads, direct image extensions)
    cleaned = re.sub(
        r"https?://(?:images\.unsplash\.com|[\w.-]+/static/uploads/|[\w.-]+/\S+\.(?:jpg|jpeg|png|webp|gif))\S*",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )

    # 3. Collapse 3+ consecutive newlines into double newlines
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned).strip()

    store_base = settings.get_product_url()

    # 4. If product_id is specified, ensure the direct product URL is in the message
    if product_id:
        clean_pid = str(product_id).strip()
        expected_url = settings.get_product_url(clean_pid)
        if expected_url not in cleaned:
            # If a generic store link without product ID exists, upgrade it to the product ID URL
            if f"{store_base}\n" in cleaned or f"{store_base} " in cleaned or cleaned.endswith(store_base):
                cleaned = cleaned.replace(store_base, expected_url)
            else:
                cleaned += f"\n\n🛍️ *View & Order on Website:*\n{expected_url}"

    elif include_store_if_missing:
        if store_base not in cleaned:
            cleaned += f"\n\n🛍️ *Official Boutique Website:*\n{store_base}"

    return cleaned.strip()
