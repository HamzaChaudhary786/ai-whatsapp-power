from datetime import datetime, timezone
from typing import List, Optional
from bson import ObjectId
from fastapi import HTTPException, status
from db.mongodb import get_database
from models.customer_model import ConsentStatus, CustomerCreate, CustomerModel, CustomerUpdate
from utils.phone_utils import normalize_pakistan_phone


class CustomerController:
    """Business logic for Customer management."""

    @staticmethod
    def _format_customer(doc: dict) -> dict:
        return {
            "id": str(doc["_id"]),
            "whatsapp_id": doc.get("whatsapp_id", ""),
            "phone": doc.get("phone") or doc.get("whatsapp_id", ""),
            "name": doc.get("name"),
            "email": doc.get("email"),
            "address": doc.get("address"),
            "city": doc.get("city"),
            "consent_status": doc.get("consent_status", ConsentStatus.PENDING),
            "marketing_opt_in": doc.get("marketing_opt_in", True),
            "created_at": doc.get("created_at"),
            "updated_at": doc.get("updated_at", doc.get("created_at")),
        }

    @staticmethod
    async def create_or_get_customer(data: CustomerCreate) -> dict:
        db = get_database()
        clean_wa = normalize_pakistan_phone(data.whatsapp_id or data.phone)
        raw_ph = data.phone or data.whatsapp_id

        lookup_conditions = [
            {"whatsapp_id": clean_wa},
            {"phone": clean_wa},
            {"phone": raw_ph},
            {"whatsapp_id": raw_ph},
        ]
        if clean_wa.startswith("92"):
            pk_local = f"0{clean_wa[2:]}"
            lookup_conditions.append({"phone": pk_local})
            lookup_conditions.append({"whatsapp_id": pk_local})

        existing = await db["customers"].find_one({"$or": lookup_conditions})
        if existing:
            return CustomerController._format_customer(existing)

        now = datetime.now(timezone.utc)
        doc = CustomerModel(
            whatsapp_id=clean_wa or raw_ph,
            phone=raw_ph,
            name=data.name,
            email=data.email,
            address=data.address,
            city=data.city,
            consent_status=data.consent_status or ConsentStatus.PENDING,
            marketing_opt_in=data.marketing_opt_in if data.marketing_opt_in is not None else True,
            created_at=now,
            updated_at=now,
        ).model_dump(by_alias=True, exclude={"id"})

        result = await db["customers"].insert_one(doc)
        doc["_id"] = result.inserted_id
        return CustomerController._format_customer(doc)

    @staticmethod
    async def get_customer(identifier: str) -> dict:
        db = get_database()
        query = {"whatsapp_id": identifier}
        if ObjectId.is_valid(identifier):
            query = {"$or": [{"_id": ObjectId(identifier)}, {"whatsapp_id": identifier}, {"phone": identifier}]}

        customer = await db["customers"].find_one(query)
        if not customer:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")

        return CustomerController._format_customer(customer)

    @staticmethod
    async def update_consent(customer_id: str, consent: ConsentStatus) -> dict:
        db = get_database()
        if not ObjectId.is_valid(customer_id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid customer ID")

        now = datetime.now(timezone.utc)
        result = await db["customers"].update_one(
            {"_id": ObjectId(customer_id)},
            {"$set": {"consent_status": consent.value, "updated_at": now}},
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")

        return await CustomerController.get_customer(customer_id)

    @staticmethod
    async def list_customers(limit: int = 100, skip: int = 0) -> List[dict]:
        db = get_database()
        cursor = db["customers"].find().sort("created_at", -1).skip(skip).limit(limit)
        items = []
        async for doc in cursor:
            items.append(CustomerController._format_customer(doc))
        return items


customer_controller = CustomerController()
