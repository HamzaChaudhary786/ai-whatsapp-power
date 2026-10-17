from datetime import datetime, timezone
from typing import List, Optional
from bson import ObjectId
from fastapi import HTTPException, status
from db.mongodb import get_database
from models.faq_model import FAQDocumentCreate, FAQDocumentModel, FAQDocumentUpdate


class FAQController:
    """Business logic for Knowledge Base & FAQ Documents."""

    @staticmethod
    async def create_faq(data: FAQDocumentCreate) -> dict:
        db = get_database()
        now = datetime.now(timezone.utc)
        doc = FAQDocumentModel(
            title=data.title,
            topic=data.topic,
            approved_content=data.approved_content,
            language=data.language or "en",
            created_at=now,
            updated_at=now,
        ).model_dump(by_alias=True, exclude={"id"})

        res = await db["faq_documents"].insert_one(doc)
        return {
            "id": str(res.inserted_id),
            "title": data.title,
            "topic": data.topic,
            "approved_content": data.approved_content,
            "language": data.language or "en",
            "created_at": now,
            "updated_at": now,
        }

    @staticmethod
    async def list_faqs(topic: Optional[str] = None, language: Optional[str] = None, limit: int = 50, skip: int = 0) -> List[dict]:
        db = get_database()
        query = {}
        if topic:
            query["topic"] = topic
        if language:
            query["language"] = language

        cursor = db["faq_documents"].find(query).sort("updated_at", -1).skip(skip).limit(limit)
        items = []
        async for doc in cursor:
            items.append({
                "id": str(doc["_id"]),
                "title": doc["title"],
                "topic": doc["topic"],
                "approved_content": doc["approved_content"],
                "language": doc.get("language", "en"),
                "created_at": doc["created_at"],
                "updated_at": doc.get("updated_at", doc["created_at"]),
            })
        return items

    @staticmethod
    async def search_faqs(query_text: str, limit: int = 5) -> List[dict]:
        db = get_database()
        cursor = db["faq_documents"].find(
            {"$text": {"$search": query_text}},
            {"score": {"$meta": "textScore"}},
        ).sort([("score", {"$meta": "textScore"})]).limit(limit)

        items = []
        async for doc in cursor:
            items.append({
                "id": str(doc["_id"]),
                "title": doc["title"],
                "topic": doc["topic"],
                "approved_content": doc["approved_content"],
                "language": doc.get("language", "en"),
                "created_at": doc["created_at"],
                "updated_at": doc.get("updated_at", doc["created_at"]),
            })
        return items

    @staticmethod
    async def update_faq(faq_id: str, data: FAQDocumentUpdate) -> dict:
        db = get_database()
        if not ObjectId.is_valid(faq_id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid FAQ ID")

        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        if not update_dict:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields provided to update")

        update_dict["updated_at"] = datetime.now(timezone.utc)
        res = await db["faq_documents"].update_one(
            {"_id": ObjectId(faq_id)},
            {"$set": update_dict},
        )
        if res.matched_count == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="FAQ not found")

        doc = await db["faq_documents"].find_one({"_id": ObjectId(faq_id)})
        return {
            "id": str(doc["_id"]),
            "title": doc["title"],
            "topic": doc["topic"],
            "approved_content": doc["approved_content"],
            "language": doc.get("language", "en"),
            "created_at": doc["created_at"],
            "updated_at": doc.get("updated_at", doc["created_at"]),
        }


faq_controller = FAQController()
