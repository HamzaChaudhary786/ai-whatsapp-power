"""
ML Semantic Product Recommender & Vector Indexer.
Trains TF-IDF n-gram vectorizer on active catalog products in MongoDB,
enabling sub-millisecond Cosine Similarity semantic search and recommendations.
"""

import asyncio
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

import joblib
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# Ensure backend root is on sys.path for db imports
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / "backend"))
from config.settings import settings
from db.mongodb import connect_to_mongo, get_database


async def fetch_catalog_products(db: Any) -> List[Dict[str, Any]]:
    """Fetch active products with their variant information."""
    cursor = db["products"].find({"is_active": True})
    products = [doc async for doc in cursor]

    if not products:
        print("[WARNING] No active products found in DB. Falling back to all products.")
        cursor = db["products"].find({})
        products = [doc async for doc in cursor]

    # Fetch variants in batch to enrich color and fabric info
    prod_ids = [str(p["_id"]) for p in products]
    v_cursor = db["product_variants"].find({"product_id": {"$in": prod_ids}})
    variants_by_prod: Dict[str, List[Dict[str, Any]]] = {pid: [] for pid in prod_ids}
    async for v in v_cursor:
        pid = v.get("product_id")
        if pid in variants_by_prod:
            variants_by_prod[pid].append(v)

    # Attach variant attributes into product object
    for p in products:
        pid = str(p["_id"])
        vars_ = variants_by_prod.get(pid, [])
        colors = list(set(v.get("color", "") for v in vars_ if v.get("color")))
        sizes = list(set(v.get("size", "") for v in vars_ if v.get("size")))
        p["_variant_colors"] = " ".join(colors)
        p["_variant_sizes"] = " ".join(sizes)

    return products


def prepare_product_corpus(products: List[Dict[str, Any]]) -> List[str]:
    """Create enriched text representation for ML vectorization."""
    corpus = []
    for p in products:
        name = p.get("name", "")
        category = p.get("category", "")
        desc = p.get("description", "")
        colors = p.get("_variant_colors", "")
        sizes = p.get("_variant_sizes", "")

        # Give higher weight to name and category by repeating
        text = f"{name} {name} {category} {category} {colors} {desc} {sizes}"
        corpus.append(text.lower().strip())
    return corpus


def build_and_save_index(
    products: List[Dict[str, Any]],
    output_dir: str = "ml/artifacts"
) -> Dict[str, Any]:
    """Fit TF-IDF vectorizer and persist index artifacts."""
    print("=" * 65)
    print("[INFO] Building ML Semantic Catalog Vector Index")
    print("=" * 65)

    corpus = prepare_product_corpus(products)
    print(f"[INFO] Prepared corpus for {len(products)} products.")

    # Multi-gram vectorizer capturing individual words, phrases, and Urdu transliterations
    vectorizer = TfidfVectorizer(
        ngram_range=(1, 3),
        max_features=6000,
        sublinear_tf=True,
        lowercase=True,
        token_pattern=r"(?u)\b\w+\b",
    )

    tfidf_matrix = vectorizer.fit_transform(corpus)
    print(f"[INFO] TF-IDF Matrix shape: {tfidf_matrix.shape}")

    # Build product mapping dictionary for fast vector retrieval
    product_records = []
    for idx, p in enumerate(products):
        product_records.append({
            "index": idx,
            "id": str(p["_id"]),
            "name": p.get("name", ""),
            "slug": p.get("slug", ""),
            "category": p.get("category", ""),
            "colors": p.get("_variant_colors", ""),
            "description": p.get("description", "")[:200],
            "image_url": p.get("image_urls", [None])[0] if p.get("image_urls") else None,
        })

    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)

    vectorizer_file = out_path / "recommender_vectorizer.pkl"
    matrix_file = out_path / "product_catalog_matrix.pkl"
    records_file = out_path / "product_records.pkl"

    joblib.dump(vectorizer, vectorizer_file)
    joblib.dump(tfidf_matrix, matrix_file)
    joblib.dump(product_records, records_file)

    metadata = {
        "model_name": "semantic_catalog_recommender",
        "version": "v1.2.0",
        "total_products": len(products),
        "vocab_size": len(vectorizer.vocabulary_),
        "indexed_at": datetime.now(timezone.utc).isoformat(),
        "vectorizer_path": str(vectorizer_file),
        "matrix_path": str(matrix_file),
    }

    metadata_file = out_path / "recommender_metadata.json"
    with open(metadata_file, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    print(f"[SUCCESS] Recommender vectorizer saved to: {vectorizer_file}")
    print(f"[SUCCESS] Product catalog matrix saved to: {matrix_file}")
    print(f"[SUCCESS] Metadata saved to: {metadata_file}")
    print("=" * 65)

    return {
        "vectorizer": vectorizer,
        "matrix": tfidf_matrix,
        "records": product_records,
    }


def test_sample_recommendations(vectorizer: Any, matrix: Any, records: List[Dict[str, Any]]):
    """Run test queries to evaluate cosine similarity matching."""
    sample_queries = [
        "red evening dress for wedding reception",
        "casual summer kurti floral lawn",
        "stylish black blazer office wear",
        "emerald green velvet gown shadi collection",
        "silk party wear maxi",
    ]

    print("\n--- Testing Live Semantic Recommender Inference ---")
    for q in sample_queries:
        q_vec = vectorizer.transform([q.lower()])
        sims = cosine_similarity(q_vec, matrix).flatten()
        top_indices = np.argsort(sims)[::-1][:3]

        print(f"\nQuery: '{q}'")
        for rank, idx in enumerate(top_indices, 1):
            score = float(sims[idx])
            p = records[idx]
            print(f"  {rank}. [{score * 100:.1f}% Match] {p['name']} ({p['category']})")


async def main():
    await connect_to_mongo()
    db = get_database()
    products = await fetch_catalog_products(db)
    print(f"[INFO] Fetched {len(products)} products from Atlas.")
    index_data = build_and_save_index(products)
    test_sample_recommendations(
        index_data["vectorizer"],
        index_data["matrix"],
        index_data["records"],
    )


if __name__ == "__main__":
    asyncio.run(main())
