from datetime import datetime, timezone
from typing import Any, Dict, Optional
from pydantic import BaseModel, ConfigDict, Field


class ModelVersionModel(BaseModel):
    """MongoDB Model Version Document Representation for ML Registry & Model Tracking."""
    id: Optional[str] = Field(default=None, alias="_id")
    model_name: str = Field(..., description="ML Model name (e.g. intent_classifier, fashion_recommender)", index=True)
    version: str = Field(..., description="Semantic or tag version (e.g. v1.0.0, 2026.10.11)", index=True)
    trained_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="Timestamp when model was trained")
    dataset_version: str = Field(..., description="Dataset version tag or commit hash used for training", index=True)
    metrics: Dict[str, Any] = Field(default_factory=dict, description="Model evaluation performance metrics (e.g. accuracy, f1_score)")
    artifact_path: str = Field(..., description="Storage path or URI of serialized artifact (e.g. ml/artifacts/intent_model.pkl)")
    is_active: bool = Field(default=False, description="Flag indicating if this version is loaded in production inference", index=True)

    model_config = ConfigDict(
        populate_by_name=True,
        json_schema_extra={
            "example": {
                "model_name": "intent_classifier",
                "version": "v1.2.0",
                "trained_at": "2026-10-11T21:13:00Z",
                "dataset_version": "fashion_intents_v2",
                "metrics": {
                    "accuracy": 0.952,
                    "macro_f1": 0.941,
                    "eval_loss": 0.082
                },
                "artifact_path": "ml/artifacts/intent_model_v1.2.0.pkl",
                "is_active": True,
            }
        },
    )


class ModelVersionCreate(BaseModel):
    model_name: str
    version: str
    dataset_version: str
    metrics: Dict[str, Any] = Field(default_factory=dict)
    artifact_path: str
    trained_at: Optional[datetime] = None
    is_active: bool = False


class ModelVersionUpdate(BaseModel):
    metrics: Optional[Dict[str, Any]] = None
    artifact_path: Optional[str] = None
    is_active: Optional[bool] = None


class ModelVersionResponse(BaseModel):
    id: str
    model_name: str
    version: str
    trained_at: datetime
    dataset_version: str
    metrics: Dict[str, Any]
    artifact_path: str
    is_active: bool

    model_config = ConfigDict(from_attributes=True)
