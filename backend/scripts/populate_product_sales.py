import asyncio
import os
import random
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv("backend/.env")

DATABASE_URL = os.getenv("DATABASE_URL")
DB_NAME = os.getenv("MONGODB_DB_NAME", "whatsapp_fashion_db")

async def update_products_with_sales():
    client = AsyncIOMotorClient(DATABASE_URL)
    db = client[DB_NAME]
    
    products = await db["products"].find({}).to_list(1000)
    print(f"Total products to examine: {len(products)}")
    
    updated_count = 0
    summer_keywords = ["linen", "cotton", "breezy", "sundress", "floral", "camisole", "silk", "chiffon", "short", "summer", "pastel", "light"]
    
    for idx, p in enumerate(products):
        name_lower = p["name"].lower()
        desc_lower = (p.get("description") or "").lower()
        
        is_summer = any(k in name_lower or k in desc_lower for k in summer_keywords) or (idx % 2 == 0)
        is_sale = (idx % 3 == 0) or ("dress" in name_lower and idx % 2 == 0)
        is_trending = (idx % 4 == 0) or ("silk" in name_lower or "linen" in name_lower)
        
        # Determine sale parameters
        variants = await db["product_variants"].find({"product_id": str(p["_id"])}).to_list(10)
        base_price = variants[0]["price"] if variants and "price" in variants[0] else 69.99
        
        discount_percent = random.choice([15, 20, 25, 30, 35]) if is_sale else None
        sale_price = round(base_price * (1 - (discount_percent / 100)), 2) if is_sale else None
        promo_code = random.choice(["SUMMER25", "LUXE20", "FLASH30", "VIP15"]) if is_sale else None
        sale_tag = random.choice(["Summer Flash Sale", "Special Boutique Offer", "Limited Summer Deal", "25% Off Festive"]) if is_sale else None
        
        update_fields = {
            "season": "Summer" if is_summer else "All-Season",
            "is_on_sale": is_sale,
            "sale_price": sale_price,
            "discount_percent": discount_percent,
            "promo_code": promo_code,
            "sale_tag": sale_tag,
            "is_trending": is_trending,
        }
        
        await db["products"].update_one({"_id": p["_id"]}, {"$set": update_fields})
        updated_count += 1

    print(f"Successfully updated {updated_count} products with sale, promo code, and summer tags!")
    client.close()

if __name__ == "__main__":
    asyncio.run(update_products_with_sales())
