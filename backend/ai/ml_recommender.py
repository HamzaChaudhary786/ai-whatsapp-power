"""
Pure NumPy Semantic ML Product Recommender & Vector Similarity Engine.
Provides sub-millisecond Cosine Similarity matching without heavy SciPy DLL dependencies.
"""

import math
import re
from collections import Counter
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
import numpy as np


class MLSemanticRecommender:
    """Fast, In-Memory TF-IDF & Cosine Similarity Semantic Product Recommender."""

    def __init__(self):
        self.vocabulary: Dict[str, int] = {}
        self.idf: np.ndarray = np.array([])
        self.tfidf_matrix: np.ndarray = np.array([])
        self.product_records: List[Dict[str, Any]] = []
        self.is_indexed: bool = False

    @staticmethod
    def tokenize(text: str) -> List[str]:
        """Extract unigrams and bigrams from text."""
        lowered = text.lower()
        words = re.findall(r"\b[a-zA-Z0-9_\-]{2,}\b", lowered)
        unigrams = words
        bigrams = [f"{words[i]}_{words[i+1]}" for i in range(len(words) - 1)]
        return unigrams + bigrams

    def build_index(self, products: List[Dict[str, Any]]) -> None:
        """Build TF-IDF Vector Space Matrix across all catalog products."""
        if not products:
            return

        documents = []
        records = []

        for p in products:
            pid = str(p.get("_id") or p.get("id"))
            name = p.get("name", "")
            cat = p.get("category", "")
            desc = p.get("description", "")
            colors = p.get("_variant_colors", "")
            sizes = p.get("_variant_sizes", "")

            # Weight name and category higher by duplicating tokens
            enriched_text = f"{name} {name} {cat} {cat} {colors} {desc} {sizes}"
            tokens = self.tokenize(enriched_text)
            documents.append(tokens)

            records.append({
                "id": pid,
                "name": name,
                "slug": p.get("slug", ""),
                "category": cat,
                "description": desc,
                "image_url": p.get("image_urls", [None])[0] if p.get("image_urls") else None,
            })

        # 1. Build Vocabulary
        word_doc_freq: Counter[str] = Counter()
        for doc in documents:
            unique_in_doc = set(doc)
            for w in unique_in_doc:
                word_doc_freq[w] += 1

        # Filter out rare singletons if vocabulary is large
        filtered_words = [w for w, count in word_doc_freq.items() if count >= 1]
        self.vocabulary = {w: idx for idx, w in enumerate(sorted(filtered_words))}
        vocab_size = len(self.vocabulary)
        num_docs = len(documents)

        if vocab_size == 0 or num_docs == 0:
            return

        # 2. Compute IDF: log((1 + N) / (1 + df)) + 1
        self.idf = np.zeros(vocab_size, dtype=np.float32)
        for w, idx in self.vocabulary.items():
            df = word_doc_freq[w]
            self.idf[idx] = math.log((1.0 + num_docs) / (1.0 + df)) + 1.0

        # 3. Compute TF-IDF Matrix with Sublinear TF (1 + log(tf))
        matrix = np.zeros((num_docs, vocab_size), dtype=np.float32)
        for doc_idx, doc in enumerate(documents):
            counts = Counter(doc)
            for w, c in counts.items():
                if w in self.vocabulary:
                    w_idx = self.vocabulary[w]
                    matrix[doc_idx, w_idx] = (1.0 + math.log(c)) * self.idf[w_idx]

        # 4. L2 Normalize rows for unit vectors (cosine similarity becomes simple dot product)
        norms = np.linalg.norm(matrix, axis=1, keepdims=True)
        self.tfidf_matrix = np.divide(matrix, np.where(norms == 0, 1.0, norms))
        self.product_records = records
        self.is_indexed = True
        print(f"[SUCCESS] ML Recommender Indexed {num_docs} products with {vocab_size} tokens.")

    def search_semantic(self, query: str, top_k: int = 15) -> List[Tuple[str, float]]:
        """Compute Cosine Similarity between user query and all product vectors."""
        if not self.is_indexed or len(self.product_records) == 0:
            return []

        query_tokens = self.tokenize(query)
        if not query_tokens:
            return []

        # Vectorize Query
        q_vec = np.zeros(len(self.vocabulary), dtype=np.float32)
        q_counts = Counter(query_tokens)
        for w, c in q_counts.items():
            if w in self.vocabulary:
                w_idx = self.vocabulary[w]
                q_vec[w_idx] = (1.0 + math.log(c)) * self.idf[w_idx]

        q_norm = np.linalg.norm(q_vec)
        if q_norm == 0:
            return []

        q_vec /= q_norm

        # Cosine Similarity is Dot Product of unit vectors
        similarities = np.dot(self.tfidf_matrix, q_vec)

        # Retrieve top indices
        top_indices = np.argsort(similarities)[::-1][:top_k]
        results = []
        for idx in top_indices:
            score = float(similarities[idx])
            if score > 0.05:  # Only meaningful semantic matches
                pid = self.product_records[idx]["id"]
                results.append((pid, round(score, 4)))

        return results

    @staticmethod
    def get_complementary_categories(category: str) -> List[str]:
        """Rules for fashion cross-selling & bundling."""
        cat_lower = category.lower()
        if any(k in cat_lower for k in ["gown", "maxi", "dress"]):
            return ["blazer", "dupatta", "clutch", "jewelry", "heels"]
        elif any(k in cat_lower for k in ["kurti", "tunic"]):
            return ["trousers", "pants", "dupatta", "shalwar"]
        elif any(k in cat_lower for k in ["shirt", "blouse", "top"]):
            return ["blazer", "trousers", "denim", "skirt"]
        elif any(k in cat_lower for k in ["blazer", "jacket"]):
            return ["shirt", "top", "pants", "trousers"]
        return ["accessories", "scarf"]


ml_recommender = MLSemanticRecommender()
