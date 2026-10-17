"""
Evaluation & Inference Tester for Trained Fashion Intent Classification Model.
"""

from pathlib import Path
import joblib


def evaluate():
    model_path = Path("ml/artifacts/intent_model.pkl")
    if not model_path.exists():
        print(f"[ERROR] Model file not found at {model_path}. Run train_intent.py first.")
        return

    pipeline = joblib.load(model_path)
    print(f"[SUCCESS] Loaded Model from: {model_path}")

    # Test Queries
    test_queries = [
        "hi good morning",
        "show me summer floral dresses",
        "what size should i get for 34 inch waist",
        "where is my package tracking ORD-123",
        "i need to talk to a human agent",
        "can i get a refund on this item",
        "do you take cash on delivery",
    ]

    print("\n--- Running Live Inference on Sample Queries ---")
    for query in test_queries:
        probs = pipeline.predict_proba([query])[0]
        classes = pipeline.classes_
        top_idx = probs.argmax()
        pred_label = classes[top_idx]
        confidence = probs[top_idx]
        print(f"Query: '{query}'")
        print(f" -> Predicted Intent: {pred_label} (Confidence: {confidence * 100:.1f}%)\n")


if __name__ == "__main__":
    evaluate()
