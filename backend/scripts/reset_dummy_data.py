import asyncio
import os
import sys

# Ensure backend root is on Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from db.mongodb import connect_to_mongo, close_mongo_connection, get_database
from ai.recommendation_engine import recommendation_engine

async def reset_dummy_data():
    print("=" * 60)
    print("STARTING DUMMY DATA CLEANUP / RESET")
    print("=" * 60)
    
    await connect_to_mongo()
    db = get_database()
    
    # 1. Inspect initial counts
    all_colls = await db.list_collection_names()
    print("\nInitial Collection Document Counts:")
    initial_counts = {}
    for c in sorted(all_colls):
        cnt = await db[c].count_documents({})
        initial_counts[c] = cnt
        print(f"  - {c}: {cnt}")
        
    # Collections to completely wipe
    collections_to_wipe = [
        "products",
        "product_variants",
        "categories",
        "orders",
        "customers",
        "messages",
        "conversations",
        "reviews",
        "campaigns",
        "coupons",
        "customer_interaction_history",
        "learning_affinities",
        "learning_query_weights",
        "product_demand",
        "webhook_events",
        "audit_logs",
    ]
    
    print("\n[Wiping Dummy Data Collections...]")
    for coll_name in collections_to_wipe:
        if coll_name in all_colls:
            res = await db[coll_name].delete_many({})
            print(f"  [OK] Cleared '{coll_name}': {res.deleted_count} documents removed.")
            
    # 2. Clean users (keep ONLY ADMIN accounts)
    print("\n[Cleaning Users Collection...]")
    non_admin_res = await db["users"].delete_many({"role": {"$ne": "ADMIN"}})
    print(f"  [OK] Deleted {non_admin_res.deleted_count} non-admin user accounts.")
    
    admin_users = await db["users"].find({"role": "ADMIN"}).to_list(10)
    print(f"  [OK] Preserved {len(admin_users)} ADMIN account(s):")
    for adm in admin_users:
        print(f"       Email: {adm.get('email')} | Role: {adm.get('role')} | ID: {adm.get('_id')}")
        
    # 3. Verify FAQ documents (ML requirement)
    faq_count = await db["faq_documents"].count_documents({})
    print(f"\n[Verifying FAQ Documents (ML Preserved)...]")
    print(f"  [OK] 'faq_documents' intact: {faq_count} items preserved for AI stylist & embeddings.")
    
    # 4. Invalidate AI recommendation cache
    try:
        recommendation_engine.invalidate_index()
        print("  [OK] Recommendation engine cache & index cleared.")
    except Exception as e:
        print(f"  [NOTE] Recommendation engine note: {e}")
        
    # 5. Clean up local test upload files in backend/static/uploads
    uploads_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "uploads")
    if os.path.exists(uploads_dir):
        files_removed = 0
        for f in os.listdir(uploads_dir):
            file_path = os.path.join(uploads_dir, f)
            if os.path.isfile(file_path):
                try:
                    os.remove(file_path)
                    files_removed += 1
                except Exception:
                    pass
        print(f"  [OK] Cleaned {files_removed} dummy test uploaded images from static/uploads.")
        
    # 6. Final verification report
    print("\n" + "=" * 60)
    print("FINAL DATABASE STATE SUMMARY")
    print("=" * 60)
    final_colls = await db.list_collection_names()
    for c in sorted(final_colls):
        cnt = await db[c].count_documents({})
        diff = cnt - initial_counts.get(c, 0)
        status = "PRESERVED" if c == "faq_documents" or (c == "users" and cnt > 0) else "CLEARED"
        print(f"  {c:<30} Count: {cnt:<6} (Diff: {diff:<6}) [{status}]")
        
    await close_mongo_connection()
    print("\nSUCCESS: All dummy data wiped. Boutique database is completely ready for real data!")

if __name__ == "__main__":
    asyncio.run(reset_dummy_data())
