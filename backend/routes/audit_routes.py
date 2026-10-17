from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from controllers.audit_controller import audit_controller
from models.audit_log_model import AuditLogResponse
from utils.dependencies import require_admin

router = APIRouter(prefix="/audit-logs", tags=["Audit & Security Logs"])


@router.get("/", response_model=List[AuditLogResponse])
async def list_audit_logs(
    actor_user_id: Optional[str] = Query(None, description="Filter by user ID"),
    action: Optional[str] = Query(None, description="Filter by action name"),
    entity_type: Optional[str] = Query(None, description="Filter by collection/entity"),
    entity_id: Optional[str] = Query(None, description="Filter by target entity ID"),
    limit: int = Query(50, ge=1, le=100),
    skip: int = Query(0, ge=0),
    _admin: dict = Depends(require_admin),
):
    """Retrieve security audit events (Admin Only)."""
    return await audit_controller.list_audit_logs(
        actor_user_id=actor_user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        limit=limit,
        skip=skip,
    )


@router.get("/{log_id}", response_model=AuditLogResponse)
async def get_audit_log(log_id: str, _admin: dict = Depends(require_admin)):
    """Get single audit log entry by ID (Admin Only)."""
    return await audit_controller.get_audit_log(log_id)
