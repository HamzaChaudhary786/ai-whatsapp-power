from typing import List, Optional
from fastapi import APIRouter, Body, Depends, Query
from controllers.conversation_controller import conversation_controller
from models.conversation_model import ConversationResponse, ConversationStatus
from models.message_model import MessageResponse
from utils.dependencies import require_staff

router = APIRouter(prefix="/conversations", tags=["Conversations & Chats"])


@router.get("/", response_model=List[ConversationResponse])
async def list_conversations(
    status: Optional[ConversationStatus] = Query(None, description="Filter by status"),
    limit: int = Query(50, ge=1, le=100),
    skip: int = Query(0, ge=0),
    _staff: dict = Depends(require_staff),
):
    """List customer chat threads with live status (Staff/Admin access only)."""
    return await conversation_controller.list_conversations(status_filter=status, limit=limit, skip=skip)


@router.get("/{conversation_id}/messages", response_model=List[MessageResponse])
async def get_messages(
    conversation_id: str,
    limit: int = Query(100, ge=1, le=200),
    _staff: dict = Depends(require_staff),
):
    """Retrieve message history for a conversation (Staff/Admin access only)."""
    return await conversation_controller.get_messages(conversation_id, limit=limit)


@router.post("/{conversation_id}/messages", response_model=MessageResponse)
async def send_agent_message(
    conversation_id: str,
    text: str = Body(..., embed=True),
    image_url: Optional[str] = Body(None, embed=True),
    _staff: dict = Depends(require_staff),
):
    """Send an outbound reply or product card to customer via WhatsApp from dashboard (Staff/Admin access only)."""
    return await conversation_controller.send_agent_message(conversation_id, text, image_url)


@router.patch("/{conversation_id}/assign", response_model=ConversationResponse)
async def assign_agent(
    conversation_id: str,
    user_id: Optional[str] = Body("AI_BOT", embed=True),
    _staff: dict = Depends(require_staff),
):
    """Assign human staff agent for live support handoff or AI_BOT to hand back to AI Stylist (Staff/Admin access only)."""
    return await conversation_controller.assign_agent(conversation_id, user_id)
