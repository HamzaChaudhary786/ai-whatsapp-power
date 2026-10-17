import asyncio
import hashlib
import hmac
from typing import Any, Dict, List, Optional
import httpx
from config.settings import settings


import os

def sanitize_whatsapp_image_url(url: Optional[str]) -> Optional[str]:
    """Ensure image URLs comply with Meta WhatsApp Cloud API requirements (strictly JPEG/PNG, no WebP/AVIF, valid public URL)."""
    if not url:
        return None
    url = url.strip()
    # If URL is a local relative upload path (e.g. /static/uploads/...), resolve with public base URL or fallback
    if url.startswith("/"):
        public_base = getattr(settings, "PUBLIC_BASE_URL", None) or os.getenv("PUBLIC_BASE_URL")
        if public_base:
            url = f"{public_base.rstrip('/')}{url}"
        else:
            # Fallback to high-resolution compliant fashion image so Meta API accepts the payload
            url = "https://images.unsplash.com/photo-1566174053879-31528523f8ae?fm=jpg&fit=crop&w=600&q=80"
    if "images.unsplash.com" in url:
        if "auto=format" in url:
            url = url.replace("auto=format", "fm=jpg")
        elif "fm=" not in url:
            sep = "&" if "?" in url else "?"
            url = f"{url}{sep}fm=jpg"
    return url


class WhatsAppClient:
    """Client for Meta's WhatsApp Cloud API with Outbound Messaging, Templates & Signature Verification."""

    def __init__(self) -> None:
        self.api_version = settings.WHATSAPP_API_VERSION
        self.phone_number_id = settings.WHATSAPP_PHONE_NUMBER_ID
        self.access_token = settings.WHATSAPP_ACCESS_TOKEN
        self.app_secret = settings.WHATSAPP_APP_SECRET
        self.base_url = f"https://graph.facebook.com/{self.api_version}"

    @property
    def headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
        }

    def verify_webhook(self, mode: Optional[str], token: Optional[str], challenge: Optional[str]) -> Optional[str]:
        """Validate Meta webhook subscription challenge using constant-time comparison."""
        expected_token = (settings.WHATSAPP_VERIFY_TOKEN or "").strip()
        if mode == "subscribe" and token and hmac.compare_digest(token.strip(), expected_token):
            return challenge
        return None

    def validate_signature(self, payload_bytes: bytes, signature_header: Optional[str]) -> bool:
        """Validate X-Hub-Signature-256 header using WHATSAPP_APP_SECRET."""
        if not self.app_secret:
            # If app secret not configured in local dev, allow request
            return True
        if not signature_header or not signature_header.startswith("sha256="):
            return False

        expected_sig = "sha256=" + hmac.new(
            self.app_secret.encode("utf-8"),
            payload_bytes,
            hashlib.sha256,
        ).hexdigest()

        return hmac.compare_digest(expected_sig, signature_header)

    async def _post_with_retry(self, endpoint: str, payload: dict[str, Any], max_retries: int = 3) -> dict[str, Any]:
        """Send POST request to WhatsApp Graph API with automatic retries and exponential backoff."""
        url = f"{self.base_url}/{self.phone_number_id}/{endpoint}"
        last_error = None

        for attempt in range(1, max_retries + 1):
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.post(url, headers=self.headers, json=payload)
                    response.raise_for_status()
                    return response.json()
            except httpx.HTTPStatusError as e:
                last_error = e
                # Don't retry client errors (4xx) except 429 rate limit
                if e.response.status_code != 429 and 400 <= e.response.status_code < 500:
                    print(f"[ERROR] WhatsApp API Client Error ({e.response.status_code}): {e.response.text}")
                    raise e
            except httpx.RequestError as e:
                last_error = e

            # Exponential backoff
            await asyncio.sleep(min(2 ** attempt, 8))
            print(f"[WARNING] WhatsApp API request attempt {attempt} failed, retrying...")

        raise last_error or RuntimeError("WhatsApp API request failed after retries")

    async def send_text_message(self, recipient_phone: str, text: str, preview_url: bool = False) -> dict[str, Any]:
        """Send standard text message to recipient."""
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": recipient_phone,
            "type": "text",
            "text": {"preview_url": preview_url, "body": text},
        }
        return await self._post_with_retry("messages", payload)

    async def mark_as_read(self, message_id: str) -> dict[str, Any]:
        """Send read receipt for incoming message."""
        payload = {
            "messaging_product": "whatsapp",
            "status": "read",
            "message_id": message_id,
        }
        return await self._post_with_retry("messages", payload)

    async def send_image_message(self, recipient_phone: str, image_url: str, caption: Optional[str] = None) -> dict[str, Any]:
        """Send image with optional caption."""
        sanitized_url = sanitize_whatsapp_image_url(image_url) or image_url
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": recipient_phone,
            "type": "image",
            "image": {"link": sanitized_url, "caption": caption} if caption else {"link": sanitized_url},
        }
        return await self._post_with_retry("messages", payload)

    async def send_interactive_buttons(self, recipient_phone: str, body_text: str, buttons: List[Dict[str, str]]) -> dict[str, Any]:
        """
        Send interactive quick reply buttons (up to 3 buttons).
        Example: buttons = [{'id': 'btn_1', 'title': 'Yes'}, {'id': 'btn_2', 'title': 'No'}]
        """
        button_elements = [
            {
                "type": "reply",
                "reply": {"id": b["id"], "title": b["title"][:20]},
            }
            for b in buttons[:3]
        ]
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": recipient_phone,
            "type": "interactive",
            "interactive": {
                "type": "button",
                "body": {"text": body_text},
                "action": {"buttons": button_elements},
            },
        }
        return await self._post_with_retry("messages", payload)

    async def send_interactive_list(
        self,
        recipient_phone: str,
        body_text: str,
        button_title: str,
        sections: List[Dict[str, Any]],
    ) -> dict[str, Any]:
        """
        Send interactive list menu (e.g. product categories).
        """
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": recipient_phone,
            "type": "interactive",
            "interactive": {
                "type": "list",
                "body": {"text": body_text},
                "action": {
                    "button": button_title[:20],
                    "sections": sections,
                },
            },
        }
        return await self._post_with_retry("messages", payload)

    async def send_template_message(
        self,
        recipient_phone: str,
        template_name: str,
        language_code: str = "en_US",
        components: Optional[List[Dict[str, Any]]] = None,
    ) -> dict[str, Any]:
        """
        Send Meta approved policy-compliant template message.
        Mandatory outside the 24-hour service window for order confirmations, shipping updates, etc.
        """
        payload: Dict[str, Any] = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": recipient_phone,
            "type": "template",
            "template": {
                "name": template_name,
                "language": {"code": language_code},
            },
        }
        if components:
            payload["template"]["components"] = components

        return await self._post_with_retry("messages", payload)


whatsapp_client = WhatsAppClient()
