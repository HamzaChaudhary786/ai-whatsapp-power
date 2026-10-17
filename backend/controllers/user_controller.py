import asyncio
from datetime import datetime, timezone
from typing import List, Optional
from bson import ObjectId
from fastapi import HTTPException, status
from db.mongodb import get_database
from models.user_model import UserCreate, UserModel, UserResponse, UserRole, UserUpdate
from utils.security import get_password_hash


class UserController:
    """Handles CRUD operations on MongoDB User collection & Staff Management."""

    @staticmethod
    def _format_user(doc: dict) -> dict:
        return {
            "id": str(doc["_id"]),
            "email": doc["email"],
            "full_name": doc.get("full_name") or doc["email"].split("@")[0],
            "phone": doc.get("phone"),
            "address": doc.get("address"),
            "city": doc.get("city"),
            "role": doc.get("role", "USER"),
            "is_active": doc.get("is_active", True),
            "created_at": doc.get("created_at"),
        }

    @staticmethod
    async def get_user_by_id(user_id: str) -> dict:
        db = get_database()
        if not ObjectId.is_valid(user_id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user ID")

        user = await db["users"].find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        return UserController._format_user(user)

    @staticmethod
    async def list_users(limit: int = 100) -> list[dict]:
        db = get_database()
        cursor = db["users"].find().sort("created_at", -1).limit(limit)
        users = []
        async for doc in cursor:
            users.append(UserController._format_user(doc))
        return users

    @staticmethod
    async def create_staff_user(data: UserCreate) -> dict:
        """Allows Admin to create new Staff or Admin team members."""
        db = get_database()
        existing = await db["users"].find_one({"email": data.email})
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"An account with email {data.email} already exists.",
            )

        now = datetime.now(timezone.utc)
        target_role = data.role or UserRole.STAFF
        # Ensure role is only STAFF or ADMIN for this endpoint
        if str(target_role) not in ["STAFF", "ADMIN"]:
            target_role = UserRole.STAFF

        pwd_hash = await asyncio.to_thread(get_password_hash, data.password)

        doc = UserModel(
            email=data.email,
            full_name=data.full_name,
            phone=data.phone,
            address=data.address,
            city=data.city,
            password_hash=pwd_hash,
            role=target_role,
            is_active=True,
            created_at=now,
        ).model_dump(by_alias=True, exclude={"id"})

        res = await db["users"].insert_one(doc)
        doc["_id"] = res.inserted_id

        # Audit log
        await db["audit_logs"].insert_one({
            "actor_user_id": None,
            "action": "STAFF_USER_CREATED",
            "entity_type": "users",
            "entity_id": str(res.inserted_id),
            "created_at": now,
            "metadata": {"email": data.email, "role": str(target_role)},
        })

        return UserController._format_user(doc)

    @staticmethod
    async def delete_user(user_id: str, current_user: Optional[dict] = None) -> dict:
        """Delete user account (staff or customer)."""
        db = get_database()
        if not ObjectId.is_valid(user_id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user ID")

        # Verify target user exists
        user = await db["users"].find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        # If target user is ADMIN, caller must be ADMIN
        if user.get("role") == "ADMIN":
            if current_user and current_user.get("role") != "ADMIN":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Only Store Administrators can delete Admin accounts.",
                )
            admin_count = await db["users"].count_documents({"role": "ADMIN"})
            if admin_count <= 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot delete the only remaining Admin account.",
                )

        await db["users"].delete_one({"_id": ObjectId(user_id)})
        if user.get("email"):
            await db["customers"].delete_many({"email": user.get("email")})
        return {"message": "User deleted successfully", "user_id": user_id}

    @staticmethod
    async def toggle_status(user_id: str, is_active: bool) -> dict:
        """Activate or deactivate a user account."""
        db = get_database()
        if not ObjectId.is_valid(user_id):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user ID")

        res = await db["users"].update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"is_active": is_active}},
        )
        if res.matched_count == 0:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        return await UserController.get_user_by_id(user_id)


user_controller = UserController()
