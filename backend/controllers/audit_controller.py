from typing import List, Optional
from bson import ObjectId
from fastapi import HTTPException, status
from db.mongodb import get_database


class AuditController:
    """Business logic for system activity & security audit logging."""

    @staticmethod
    async def list_audit_logs(
        actor_user_id: Optional[str] = None,
        action: Optional[str] = None,
        entity_type: Optional[str] = None,
        entity_id: Optional[str] = None,
        limit: int = 50,
        skip: int = 0,
    ) -> List[dict]:
        db = get_database()
        query = {}
        if actor_user_id:
            query["actor_user_id"] = actor_user_id
        if action:
            query["action"] = action
        if entity_type:
            query["entity_type"] = entity_type
        if entity_id:
            query["entity_id"] = entity_id

        cursor = db["audit_logs"].find(query).sort("created_at", -1).skip(skip).limit(limit)
        items = []
        async for doc in cursor:
            items.append({
                "id": str(doc["_id"]),
                "actor_user_id": doc.get("actor_user_id"),
                "action": doc["action"],
                "entity_type": doc["entity_type"],
                "entity_id": doc.get("entity_id"),
                "created_at": doc["created_at"],
                "metadata": doc.get("metadata", {}),
            })
        return items

    @staticmethod
    async def get_audit_log(log_id: str) -> dict:
        db = get_database()
        if not ObjectId.is_valid(log_id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid log ID")

        doc = await db["audit_logs"].find_one({"_id": ObjectId(log_id)})
        if not doc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Audit log entry not found")

        return {
            "id": str(doc["_id"]),
            "actor_user_id": doc.get("actor_user_id"),
            "action": doc["action"],
            "entity_type": doc["entity_type"],
            "entity_id": doc.get("entity_id"),
            "created_at": doc["created_at"],
            "metadata": doc.get("metadata", {}),
        }


audit_controller = AuditController()
