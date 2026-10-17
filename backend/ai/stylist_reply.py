import re
from typing import Any, Dict, List, Optional


def _clean_stylist_text(text: str) -> str:
    """Cleans responses by removing double asterisks, excessive markdown clutter, and messy formatting."""
    if not text:
        return ""
    # Strip markdown double asterisks completely
    cleaned = text.replace("**", "")
    # Remove any consecutive asterisks (*** etc.)
    cleaned = re.sub(r"\*{2,}", "", cleaned)
    # Normalize excessive newlines
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
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
        cleaned_text = _clean_stylist_text(text)
        obj = str.__new__(cls, cleaned_text)
        obj.order_created = order_created
        obj.order = order
        obj.product_action = product_action
        obj.image_url = image_url
        obj.relevant_products = relevant_products or []
        obj.conversion_nudge = conversion_nudge
        return obj
