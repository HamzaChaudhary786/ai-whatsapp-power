from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from controllers.model_version_controller import model_version_controller
from models.model_version_model import ModelVersionCreate, ModelVersionResponse
from utils.dependencies import require_admin

router = APIRouter(prefix="/model-versions", tags=["ML Model Registry"])


@router.post("/", response_model=ModelVersionResponse)
async def register_model_version(data: ModelVersionCreate, _admin: dict = Depends(require_admin)):
    """Register a new ML model version with evaluation metrics (Admin Only)."""
    return await model_version_controller.register_version(data)


@router.get("/", response_model=List[ModelVersionResponse])
async def list_model_versions(model_name: Optional[str] = Query(None, description="Filter by model name")):
    """List all registered model versions."""
    return await model_version_controller.list_versions(model_name=model_name)


@router.patch("/{version_id}/activate", response_model=ModelVersionResponse)
async def activate_model_version(version_id: str, _admin: dict = Depends(require_admin)):
    """Activate a model version for live production inference (Admin Only)."""
    return await model_version_controller.activate_version(version_id)
