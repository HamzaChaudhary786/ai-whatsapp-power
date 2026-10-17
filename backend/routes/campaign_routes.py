from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from models.campaign_model import CampaignCreate, CampaignResponse
from controllers.campaign_controller import campaign_controller
from utils.dependencies import require_staff

router = APIRouter(prefix="/campaigns", tags=["Marketing & Campaigns"])


@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_campaign(data: CampaignCreate, _staff: dict = Depends(require_staff)):
    """Create a new promotional campaign or sale offer (Staff/Admin access only)."""
    return await campaign_controller.create_campaign(data)


@router.get("/", response_model=List[dict])
async def list_campaigns(limit: int = 50, _staff: dict = Depends(require_staff)):
    """List recent promotional campaigns with delivery stats (Staff/Admin access only)."""
    return await campaign_controller.list_campaigns(limit=limit)


@router.get("/active", response_model=Optional[dict])
async def get_active_campaign():
    """Get active promotional offer for customer storefront banner (Public)."""
    return await campaign_controller.get_active_campaign()


@router.post("/{campaign_id}/broadcast", response_model=dict)
async def send_broadcast(campaign_id: str, _staff: dict = Depends(require_staff)):
    """Launch multi-channel promotional broadcast via WhatsApp and Email (Staff/Admin access only)."""
    return await campaign_controller.send_broadcast(campaign_id)
