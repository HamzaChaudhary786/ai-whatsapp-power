from pathlib import Path
from typing import Optional, Tuple
import joblib


class IntentModel:
    """Production ML Inference Wrapper for Fashion Intent Classification."""

    def __init__(self, model_path: str = "ml/artifacts/intent_model.pkl") -> None:
        self.model_path = Path(model_path)
        self.pipeline = None
        self.load_model()

    def load_model(self) -> None:
        """Attempt to load trained scikit-learn model artifact."""
        if self.model_path.exists():
            try:
                self.pipeline = joblib.load(self.model_path)
                print(f"[INFO] Successfully loaded ML Intent Model from {self.model_path}")
            except Exception as e:
                print(f"[WARNING] Failed to load ML model artifact: {e}")
                self.pipeline = None

    def predict(self, text: str) -> Tuple[str, float]:
        """Predict intent label and confidence score."""
        lowered = text.lower().strip()

        # If trained ML model pipeline is loaded, use probabilistic inference
        if self.pipeline is not None:
            try:
                probs = self.pipeline.predict_proba([lowered])[0]
                classes = self.pipeline.classes_
                top_idx = probs.argmax()
                confidence = float(probs[top_idx])
                predicted_label = str(classes[top_idx])

                # If confidence is solid, return ML prediction
                if confidence >= 0.35:
                    return predicted_label, round(confidence, 4)
            except Exception as err:
                print(f"[WARNING] ML model inference fallback: {err}")

        # Heuristic Rule-Based Fallback using word boundaries
        import re
        tokens = set(re.findall(r"\b\w+\b", lowered))

        # Check returns, replacements, exchanges first
        return_keywords = {"return", "returns", "replace", "replacement", "exchange", "refund", "cancel", "policy"}
        if tokens.intersection(return_keywords) or any(w in lowered for w in ["replace my order", "exchange item", "return policy", "money back"]):
            return "returns_policy", 0.95

        # Order placement and reservation intent (CHECK BEFORE ORDER STATUS TRACKING!)
        placement_phrases = [
            "place my order", "place order", "want to place", "order this", "order now",
            "reserve my order", "reserve this", "reserve", "book my order", "i want to order",
            "want to buy", "buy now", "confirm my order", "send this to me"
        ]
        if any(p in lowered for p in placement_phrases) or (
            tokens.intersection({"place", "reserve", "book", "order"}) and tokens.intersection({"size", "shirt", "dress", "item", "large", "medium", "small", "piece"})
        ):
            return "place_order", 0.96

        # Delivery address detection
        address_indicators = {"street", "ground", "road", "house", "near", "sector", "colony", "block", "mohallah", "city", "town", "floor", "apt", "flat"}
        if len(tokens.intersection(address_indicators)) >= 1 and len(tokens) >= 3:
            return "provide_address", 0.95

        # Order status & tracking (explicit tracking terms)
        order_keywords = {"track", "tracking", "status", "delivery", "dispatch", "where is my order", "package", "courier"}
        if tokens.intersection(order_keywords) or "where is" in lowered or "order #" in lowered or re.search(r"ord-?\d+", lowered):
            return "order_status", 0.95

        # Catalog, product inquiry, styling
        catalog_keywords = {
            "dress", "shirt", "pant", "pants", "catalog", "collection", "buy", "show", "linen",
            "silk", "blazer", "suit", "kurti", "outfit", "recommend", "recommendation", "price",
            "cost", "fabric", "cloth", "jeans", "trousers", "skirt", "jacket", "hoodie", "shoes"
        }
        if tokens.intersection(catalog_keywords) or any(w in lowered for w in ["tell me more", "how much", "what do you have"]):
            return "browse_catalog", 0.93

        # Sizing
        size_keywords = {"size", "sizes", "fit", "fitting", "measurement", "measurements", "chart", "medium", "small", "large"}
        if tokens.intersection(size_keywords):
            return "size_recommendation", 0.91

        # Human handoff
        agent_keywords = {"agent", "human", "representative", "support", "person", "operator", "talk to human"}
        if tokens.intersection(agent_keywords):
            return "human_handoff", 0.96

        # Payment
        pay_keywords = {"pay", "payment", "card", "cash", "cod", "checkout", "bank", "stripe"}
        if tokens.intersection(pay_keywords) or "cash on delivery" in lowered:
            return "payment_methods", 0.92

        # Greetings (Only if short or standalone greeting tokens)
        greeting_tokens = {"hi", "hello", "hey", "salam", "assalam", "aoa", "hiya", "morning", "afternoon", "evening"}
        if tokens.intersection(greeting_tokens):
            return "greeting", 0.95

        return "unknown", 0.50


intent_model = IntentModel()

