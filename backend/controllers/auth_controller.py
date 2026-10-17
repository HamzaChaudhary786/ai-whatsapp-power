import asyncio
from datetime import datetime, timezone
from bson import ObjectId
from fastapi import HTTPException, status
from db.mongodb import get_database
from models.user_model import UserCreate, UserLogin, UserModel, UserRole
from utils.security import create_access_token, get_password_hash, verify_password


class AuthController:
    """Handles authentication and registration logic for MongoDB with non-blocking async execution."""

    @staticmethod
    async def register_user(user_in: UserCreate) -> dict:
        db = get_database()
        existing = await db["users"].find_one({"email": user_in.email})
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email is already registered.",
            )

        now = datetime.now(timezone.utc)

        # Offload CPU-bound bcrypt hashing to worker thread pool so event loop is NEVER frozen
        pwd_hash = await asyncio.to_thread(get_password_hash, user_in.password)

        user_doc = UserModel(
            email=user_in.email,
            full_name=user_in.full_name,
            phone=user_in.phone,
            address=user_in.address,
            city=user_in.city,
            password_hash=pwd_hash,
            role=UserRole.USER,  # Locked: Public signup is strictly for customers!
            created_at=now,
        ).model_dump(by_alias=True, exclude={"id"})

        result = await db["users"].insert_one(user_doc)
        token = create_access_token({
            "sub": str(result.inserted_id),
            "email": user_in.email,
            "role": str(user_doc.get("role", "USER")),
        })

        # Efficient Customer profile sync for promotions and orders
        if user_in.phone or user_in.email:
            clean_wa_id = (user_in.phone or "").replace("+", "").replace(" ", "").replace("-", "")
            or_conditions = []
            if user_in.email:
                or_conditions.append({"email": user_in.email})
            if clean_wa_id:
                or_conditions.append({"whatsapp_id": clean_wa_id})
                or_conditions.append({"phone": user_in.phone})

            existing_cust = None
            if or_conditions:
                existing_cust = await db["customers"].find_one({"$or": or_conditions})

            cust_data = {
                "whatsapp_id": clean_wa_id or str(user_in.email),
                "phone": user_in.phone or clean_wa_id,
                "name": user_in.full_name or user_in.email.split("@")[0],
                "email": user_in.email,
                "address": user_in.address,
                "city": user_in.city,
                "consent_status": "OPTED_IN",
                "marketing_opt_in": True,
                "updated_at": now,
            }

            if existing_cust:
                await db["customers"].update_one({"_id": existing_cust["_id"]}, {"$set": cust_data})
                cust_id = str(existing_cust["_id"])
            else:
                cust_data["created_at"] = now
                ins = await db["customers"].insert_one(cust_data)
                cust_id = str(ins.inserted_id)

            # Ensure any active conversation for this customer is assigned to AI Stylist by default (not live human agent)
            await db["conversations"].update_many(
                {"customer_id": {"$in": [cust_id, ObjectId(cust_id) if ObjectId.is_valid(cust_id) else cust_id]}},
                {"$set": {
                    "assigned_user_id": None,
                    "status": "ACTIVE",
                    "last_message_at": now
                }}
            )

        return {
            "user_id": str(result.inserted_id),
            "email": user_in.email,
            "full_name": user_in.full_name,
            "phone": user_in.phone,
            "address": user_in.address,
            "city": user_in.city,
            "role": str(user_doc.get("role", "USER")),
            "access_token": token,
            "token_type": "bearer",
        }

    @staticmethod
    async def login_user(credentials: UserLogin) -> dict:
        db = get_database()
        user = await db["users"].find_one({"email": credentials.email})
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password.",
            )

        # Offload bcrypt verification to worker thread so event loop never freezes
        pwd_matches = await asyncio.to_thread(verify_password, credentials.password, user["password_hash"])
        if not pwd_matches:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password.",
            )

        user_role = str(user.get("role", "USER"))
        token = create_access_token({"sub": str(user["_id"]), "email": user["email"], "role": user_role})
        return {
            "user_id": str(user["_id"]),
            "email": user["email"],
            "full_name": user.get("full_name"),
            "phone": user.get("phone"),
            "address": user.get("address"),
            "city": user.get("city"),
            "role": user_role,
            "access_token": token,
            "token_type": "bearer",
        }


auth_controller = AuthController()
