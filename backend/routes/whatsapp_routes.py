from typing import Any, Dict, List, Optional
from fastapi import APIRouter, BackgroundTasks, Body, Query, Request
from controllers.whatsapp_controller import whatsapp_controller
from integrations.whatsapp import whatsapp_client

router = APIRouter(prefix="/whatsapp", tags=["WhatsApp Cloud API"])


@router.get("/webhook")
def verify_webhook(
    hub_mode: Optional[str] = Query(None, alias="hub.mode"),
    hub_challenge: Optional[str] = Query(None, alias="hub.challenge"),
    hub_verify_token: Optional[str] = Query(None, alias="hub.verify_token"),
):
    """
    GET: Meta Webhook Subscription Verification Handshake.
    Validates hub.mode == 'subscribe' and hub.verify_token.
    """
    return whatsapp_controller.verify_webhook(hub_mode, hub_verify_token, hub_challenge)


@router.post("/webhook")
async def handle_webhook(request: Request, background_tasks: BackgroundTasks):
    """
    POST: Inbound Webhook Listener with Fast Acknowledgment (<200ms) & HMAC-SHA256 signature verification.
    """
    return await whatsapp_controller.handle_incoming_webhook(request, background_tasks)


@router.post("/send-text")
async def send_text_message(
    to: str = Body(..., description="Recipient phone number with country code e.g. +923001234567"),
    message: str = Body(..., description="Message text body"),
):
    """Send standard outbound text message (24-hour window)."""
    return await whatsapp_client.send_text_message(recipient_phone=to, text=message)


@router.post("/send-template")
async def send_template_message(
    to: str = Body(..., description="Recipient phone number with country code"),
    template_name: str = Body("hello_world", description="Meta approved template name"),
    language_code: str = Body("en_US", description="Template language code"),
    components: Optional[List[Dict[str, Any]]] = Body(None, description="Template variable parameters"),
):
    """
    Send Meta policy-compliant pre-approved template message.
    Required for initiating conversations outside the 24-hour customer window.
    """
    return await whatsapp_client.send_template_message(
        recipient_phone=to,
        template_name=template_name,
        language_code=language_code,
        components=components,
    )


@router.post("/send-interactive-buttons")
async def send_interactive_buttons(
    to: str = Body(..., description="Recipient phone number"),
    body_text: str = Body(..., description="Prompt text above the buttons"),
    buttons: List[Dict[str, str]] = Body(
        ...,
        description="Array of up to 3 buttons e.g. [{'id': 'btn_catalog', 'title': 'Browse Dresses'}]",
    ),
):
    """Send interactive quick-reply buttons (up to 3 buttons)."""
    return await whatsapp_client.send_interactive_buttons(recipient_phone=to, body_text=body_text, buttons=buttons)
