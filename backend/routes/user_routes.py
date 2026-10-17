from typing import Optional
from fastapi import APIRouter, Body, Depends, status
from controllers.user_controller import user_controller
from models.user_model import UserCreate
from utils.dependencies import require_admin, require_staff

router = APIRouter(prefix="/users", tags=["Users & Staff Management"])


@router.get("/")
async def get_all_users(limit: int = 100, _staff: dict = Depends(require_staff)):
    """List all accounts (Staff/Admin access only)."""
    return await user_controller.list_users(limit)


@router.post("/staff", status_code=status.HTTP_201_CREATED)
async def create_staff(data: UserCreate, _admin: dict = Depends(require_admin)):
    """Create a new Staff or Admin user account (Admin only)."""
    return await user_controller.create_staff_user(data)


@router.get("/{user_id}")
async def get_user(user_id: str, _staff: dict = Depends(require_staff)):
    """Retrieve details of a specific user account (Staff/Admin access only)."""
    return await user_controller.get_user_by_id(user_id)


@router.delete("/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(require_staff)):
    """Delete a staff or customer account (Admin/Staff access). Only Admin can delete Admin accounts."""
    return await user_controller.delete_user(user_id, current_user=current_user)


@router.patch("/{user_id}/status")
async def toggle_status(user_id: str, is_active: bool = Body(..., embed=True), _admin: dict = Depends(require_admin)):
    """Activate or deactivate a user account (Admin only)."""
    return await user_controller.toggle_status(user_id, is_active)
