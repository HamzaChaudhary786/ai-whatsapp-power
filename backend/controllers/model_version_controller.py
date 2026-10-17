from datetime import datetime, timezone
from typing import List, Optional
from bson import ObjectId
from fastapi import HTTPException, status
from db.mongodb import get_database
from models.model_version_model import ModelVersionCreate, ModelVersionModel, ModelVersionUpdate


class ModelVersionController:
    """Business logic for ML Model Version Registry & Tracking."""

    @staticmethod
    async def register_version(data: ModelVersionCreate) -> dict:
        db = get_database()
        existing = await db["model_versions"].find_one({
            "model_name": data.model_name,
            "version": data.version,
        })
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Model '{data.model_name}' version '{data.version}' is already registered",
            )

        now = data.trained_at or datetime.now(timezone.utc)
        doc = ModelVersionModel(
            model_name=data.model_name,
            version=data.version,
            dataset_version=data.dataset_version,
            metrics=data.metrics,
            artifact_path=data.artifact_path,
            trained_at=now,
            is_active=data.is_active,
        ).model_dump(by_alias=True, exclude={"id"})

        if data.is_active:
            # Deactivate previous active versions of the same model
            await db["model_versions"].update_many(
                {"model_name": data.model_name},
                {"$set": {"is_active": False}},
            )

        res = await db["model_versions"].insert_one(doc)
        return {
            "id": str(res.inserted_id),
            "model_name": data.model_name,
            "version": data.version,
            "dataset_version": data.dataset_version,
            "metrics": data.metrics,
            "artifact_path": data.artifact_path,
            "trained_at": now,
            "is_active": data.is_active,
        }

    @staticmethod
    async def list_versions(model_name: Optional[str] = None, limit: int = 50) -> List[dict]:
        db = get_database()
        query = {}
        if model_name:
            query["model_name"] = model_name

        cursor = db["model_versions"].find(query).sort("trained_at", -1).limit(limit)
        items = []
        async for doc in cursor:
            items.append({
                "id": str(doc["_id"]),
                "model_name": doc["model_name"],
                "version": doc["version"],
                "dataset_version": doc.get("dataset_version"),
                "metrics": doc.get("metrics", {}),
                "artifact_path": doc.get("artifact_path"),
                "trained_at": doc["trained_at"],
                "is_active": doc.get("is_active", False),
            })
        return items

    @staticmethod
    async def activate_version(version_id: str) -> dict:
        db = get_database()
        if not ObjectId.is_valid(version_id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid version ID")

        target = await db["model_versions"].find_one({"_id": ObjectId(version_id)})
        if not target:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model version not found")

        # Deactivate all versions of this model
        await db["model_versions"].update_many(
            {"model_name": target["model_name"]},
            {"$set": {"is_active": False}},
        )

        # Activate selected version
        await db["model_versions"].update_one(
            {"_id": ObjectId(version_id)},
            {"$set": {"is_active": True}},
        )

        target["is_active"] = True
        return {
            "id": str(target["_id"]),
            "model_name": target["model_name"],
            "version": target["version"],
            "dataset_version": target.get("dataset_version"),
            "metrics": target.get("metrics", {}),
            "artifact_path": target.get("artifact_path"),
            "trained_at": target["trained_at"],
            "is_active": True,
        }


model_version_controller = ModelVersionController()
