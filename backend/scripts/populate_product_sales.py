import asyncio
import os
import random
import certifi
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv("backend/.env")

DATABASE_URL = os.getenv("DATABASE_URL")
DB_NAME = os.getenv("MONGODB_DB_NAME", "whatsapp_fashion_db")

# Tiered realistic sales counts for top trending showcase
TIERED_SALES = [
    (18, 15),
    (14, 12),
    (11, 9),
    (9, 8),
    (7, 6),
    (6, 5),
    (5, 4),
    (4, 3),
    (3, 3),
    (2, 2),
    (1, 1),
]

async def update_products_with_sales():
    client = AsyncIOMotorClient(DATABASE_URL, tlsCAFile=certifi.where())
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
        
        # Assign descending sales to top products
        if idx < len(TIERED_SALES):
            sales_cnt, order_cnt = TIERED_SALES[idx]
            is_trending = True
        elif idx % 4 == 0 or ("silk" in name_lower or "linen" in name_lower):
            sales_cnt, order_cnt = (1, 1) if idx % 2 == 0 else (0, 0)
            is_trending = True
        else:
            sales_cnt, order_cnt = 0, 0
            is_trending = False

        trending_score = round((sales_cnt * 10.0) + (order_cnt * 5.0) + (5.0 if is_trending else 0.0), 2)
        
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
            "sales_count": sales_cnt,
            "order_count": order_cnt,
            "trending_score": trending_score,
        }
        
        await db["products"].update_one({"_id": p["_id"]}, {"$set": update_fields})
        updated_count += 1

    print(f"Successfully updated {updated_count} products with sales counts, order counts, and trending scores!")
    client.close()

if __name__ == "__main__":
    asyncio.run(update_products_with_sales())
