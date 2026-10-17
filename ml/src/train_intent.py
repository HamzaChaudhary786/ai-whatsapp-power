"""
Production ML Intent Classification Pipeline for WhatsApp Fashion Assistant.
Trains a scikit-learn TF-IDF + Logistic Regression model on intent dataset.
"""

import json
from datetime import datetime, timezone
from pathlib import Path
import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, f1_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline


def load_dataset(data_path: str = "ml/data/train.json") -> tuple[list[str], list[str]]:
    path = Path(data_path)
    if not path.exists():
        raise FileNotFoundError(f"Training data not found at {data_path}")

    with open(path, "r", encoding="utf-8") as f:
        items = json.load(f)

    texts = [item["text"] for item in items]
    labels = [item["intent"] for item in items]
    return texts, labels


def train(data_path: str = "ml/data/train.json", output_dir: str = "ml/artifacts") -> dict:
    print("=" * 60)
    print("[INFO] Starting Fashion Intent Classifier Training Pipeline")
    print("=" * 60)

    texts, labels = load_dataset(data_path)
    print(f"[INFO] Loaded {len(texts)} samples across {len(set(labels))} unique intents.")

    # Train/Validation Split
    X_train, X_val, y_train, y_val = train_test_split(
        texts,
        labels,
        test_size=0.25,
        random_state=42,
        stratify=labels,
    )

    # Build Pipeline: TF-IDF n-grams + Logistic Regression
    pipeline = Pipeline([
        ("tfidf", TfidfVectorizer(ngram_range=(1, 2), lowercase=True, max_features=1000)),
        ("classifier", LogisticRegression(C=2.0, max_iter=200, random_state=42)),
    ])

    print("[INFO] Training model...")
    pipeline.fit(X_train, y_train)

    # Evaluation
    y_pred = pipeline.predict(X_val)
    macro_f1 = float(f1_score(y_val, y_pred, average="macro"))
    accuracy = float(pipeline.score(X_val, y_val))

    print("\n[EVALUATION] Model Performance on Validation Set:")
    print(f" - Accuracy: {accuracy * 100:.2f}%")
    print(f" - Macro F1: {macro_f1:.4f}")
    print("\nDetailed Classification Report:")
    print(classification_report(y_val, y_pred, zero_division=0))

    # Save artifact
    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)
    model_file = out_path / "intent_model.pkl"
    joblib.dump(pipeline, model_file)
    print(f"[SUCCESS] Model artifact saved to: {model_file}")

    metadata = {
        "model_name": "intent_classifier",
        "version": "v1.0.0",
        "dataset_version": "fashion_intents_v1",
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "metrics": {
            "accuracy": round(accuracy, 4),
            "macro_f1": round(macro_f1, 4),
        },
        "artifact_path": str(model_file),
    }

    metadata_file = out_path / "metadata.json"
    with open(metadata_file, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    print(f"[SUCCESS] Metadata saved to: {metadata_file}")
    print("=" * 60)
    return metadata


if __name__ == "__main__":
    train()
