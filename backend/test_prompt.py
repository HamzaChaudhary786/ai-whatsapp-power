import asyncio
from db.mongodb import connect_to_mongo, close_mongo_connection, get_database
from ai.assistant import fashion_assistant
import google.generativeai as genai
from config.settings import settings

async def test():
    await connect_to_mongo()
    db = get_database()
    customer_ctx, catalog_ctx, faq_ctx = await asyncio.gather(
        fashion_assistant._fetch_customer_context(db, "+923001234567"),
        fashion_assistant._fetch_catalog_context(db),
        fashion_assistant._fetch_faq_context(db, "Tell me more about Crisp Linen Relaxed Button-Down Shirt"),
    )
    
    catalog_summary = "\n".join([
        f"- {item['name']} ({item['category']}): {item['price']} | Colors: {item['colors']} | Sizes: {item['sizes']} | Details: {item['description']}"
        for item in catalog_ctx
    ])
    
    genai.configure(api_key=settings.GEMINI_API_KEY)
    
    for model_name in ["gemini-3-flash-preview", "gemini-3.5-flash-lite", "gemini-2.5-flash"]:
        print(f"\n================ MODEL: {model_name} ================")
        try:
            m = genai.GenerativeModel(
                model_name=model_name,
                system_instruction="You are Aria, an expert virtual fashion stylist for a boutique on WhatsApp. Give helpful, informative, and stylish answers."
            )
            prompt = f"""[LIVE BOUTIQUE CATALOG]
{catalog_summary}

[CUSTOMER MESSAGE]
"Tell me more about Crisp Linen Relaxed Button-Down Shirt"

Provide complete, stylish, and engaging details about this shirt (price, fabric, styling ideas, fit):"""
            res = m.generate_content(prompt)
            print("TEXT LENGTH:", len(res.text))
            print("TEXT PREVIEW:")
            print(res.text[:300].encode("ascii", "replace").decode("ascii"))
        except Exception as e:
            print("ERROR:", e)
            
    await close_mongo_connection()

if __name__ == "__main__":
    asyncio.run(test())
