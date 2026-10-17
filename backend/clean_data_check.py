import asyncio
from db.mongodb import connect_to_mongo, close_mongo_connection, get_database

async def check():
    await connect_to_mongo()
    db = get_database()
    users = await db['users'].find().to_list(100)
    print("USERS COUNT:", len(users))
    for u in users:
        print(f"ID: {u.get('_id')} | EMAIL: {u.get('email')} | ROLE: {u.get('role')} | NAME: {u.get('full_name')}")
    await close_mongo_connection()

if __name__ == '__main__':
    asyncio.run(check())
