from typing import List
from fastapi import APIRouter, Depends, Query
from controllers.customer_controller import customer_controller
from models.customer_model import ConsentStatus, CustomerCreate, CustomerResponse
from utils.dependencies import require_staff

router = APIRouter(prefix="/customers", tags=["Customers"])


@router.post("/", response_model=CustomerResponse)
async def create_or_get_customer(data: CustomerCreate):
    """Create a new customer or fetch if whatsapp_id already exists (Public for checkout)."""
    return await customer_controller.create_or_get_customer(data)


@router.get("/", response_model=List[CustomerResponse])
async def list_customers(
    limit: int = Query(50, ge=1, le=100),
    skip: int = Query(0, ge=0),
    _staff: dict = Depends(require_staff),
):
    """List all customers paginated (Staff/Admin access only)."""
    return await customer_controller.list_customers(limit=limit, skip=skip)


@router.get("/{identifier}", response_model=CustomerResponse)
async def get_customer(identifier: str, _staff: dict = Depends(require_staff)):
    """Get customer by ObjectId or WhatsApp ID (Staff/Admin access only)."""
    return await customer_controller.get_customer(identifier)


@router.patch("/{customer_id}/consent", response_model=CustomerResponse)
async def update_consent(
    customer_id: str,
    consent: ConsentStatus = Query(...),
    _staff: dict = Depends(require_staff),
):
    """Update customer WhatsApp communication consent status (Staff/Admin access only)."""
    return await customer_controller.update_consent(customer_id, consent)
