from typing import Optional
import certifi
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from config.settings import settings

client: Optional[AsyncIOMotorClient] = None
db: Optional[AsyncIOMotorDatabase] = None


async def connect_to_mongo() -> None:
    """Connect to MongoDB on startup."""
    global client, db
    try:
        masked_host = settings.DATABASE_URL.split("@")[-1]
        print(f"[INFO] Connecting to MongoDB Atlas: {masked_host}...")
        client = AsyncIOMotorClient(
            settings.DATABASE_URL,
            tlsCAFile=certifi.where(),
            serverSelectionTimeoutMS=4000,
        )
        # Verify connection by pinging
        await client.admin.command("ping")
        db = client[settings.MONGODB_DB_NAME]

        # Ensure indexes in background so startup and requests are never blocked
        import asyncio
        asyncio.create_task(_ensure_indexes(db))
        print(f"[SUCCESS] Connected to MongoDB Atlas! [Database: {settings.MONGODB_DB_NAME}]")
    except Exception as e:
        print(f"[WARNING] MongoDB Atlas Connection: {e}")
        print("[NOTE] Agar IP whitelist nahi hai to MongoDB Atlas dashboard par jayein:")
        print("       Network Access -> Add IP Address -> 0.0.0.0/0 (Allow from anywhere) -> Confirm.")


async def _ensure_indexes(database: AsyncIOMotorDatabase) -> None:
    try:
        await database["customers"].create_index("whatsapp_id", unique=True)
        await database["users"].create_index("email", unique=True)
        await database["products"].create_index("slug", unique=True)
        await database["products"].create_index("category")
        await database["orders"].create_index("order_number", unique=True)
        await database["orders"].create_index("customer_id")
        await database["orders"].create_index("status")
        await database["conversations"].create_index("customer_id")
        await database["messages"].create_index("conversation_id")
    except Exception:
        pass


async def close_mongo_connection() -> None:
    """Close MongoDB connection on shutdown."""
    global client
    if client is not None:
        client.close()
        print("[INFO] Closed MongoDB connection.")


def get_database() -> AsyncIOMotorDatabase:
    """Dependency / helper to get database instance with auto-reconnect fallback."""
    global client, db
    if db is None:
        try:
            client = AsyncIOMotorClient(
                settings.DATABASE_URL,
                tlsCAFile=certifi.where(),
                serverSelectionTimeoutMS=4000,
            )
            db = client[settings.MONGODB_DB_NAME]
        except Exception as e:
            print(f"[ERROR] Auto-reconnecting to MongoDB failed: {e}")
            raise RuntimeError("MongoDB is not connected. Please verify your Atlas Network Access IP whitelist.")
    return db
