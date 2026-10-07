import os
import re

import joblib
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field


# ============================================================
# PATH CONFIGURATION
# ============================================================

BASE_DIR = os.path.dirname(
    os.path.dirname(
        os.path.abspath(__file__)
    )
)

VECTORIZER_PATH = os.path.join(
    BASE_DIR,
    "models",
    "tfidf_vectorizer.pkl"
)

MODEL_PATH = os.path.join(
    BASE_DIR,
    "models",
    "baseline_model.pkl"
)


# ============================================================
# MODEL LOADING
# ============================================================

print("Loading PeerBridge AI model...")

vectorizer = joblib.load(VECTORIZER_PATH)
model = joblib.load(MODEL_PATH)

print("Model loaded successfully.")


# ============================================================
# CONFIGURATION
# ============================================================

THRESHOLD = 0.70


# ============================================================
# FASTAPI APPLICATION
# ============================================================

app = FastAPI(
    title="PeerBridge AI Moderation API",
    description="Abusive content detection service for PeerBridge",
    version="1.0.0"
)


# ============================================================
# REQUEST MODEL
# ============================================================

class PredictionRequest(BaseModel):
    text: str = Field(
        ...,
        min_length=1,
        description="Text to analyze"
    )


# ============================================================
# TEXT CLEANING
# ============================================================

def clean_text(text: str) -> str:

    text = str(text).lower()

    # Remove URLs
    text = re.sub(
        r"http\S+|www\.\S+",
        "",
        text
    )

    # Remove @mentions
    text = re.sub(
        r"@\w+",
        "",
        text
    )

    # Reduce repeated characters
    text = re.sub(
        r"(.)\1{2,}",
        r"\1\1",
        text
    )

    # Normalize whitespace
    text = re.sub(
        r"\s+",
        " ",
        text
    ).strip()

    return text


# ============================================================
# ROOT ENDPOINT
# ============================================================

@app.get("/")
def root():

    return {
        "service": "PeerBridge AI Moderation API",
        "status": "running",
        "model": "TF-IDF + Logistic Regression",
        "threshold": THRESHOLD
    }


# ============================================================
# HEALTH ENDPOINT
# ============================================================

@app.get("/health")
def health():

    return {
        "status": "healthy",
        "model_loaded": True
    }


# ============================================================
# PREDICTION ENDPOINT
# ============================================================

@app.post("/predict")
def predict(request: PredictionRequest):

    try:

        original_text = request.text
        cleaned_text = clean_text(original_text)

        # Safety check after cleaning
        if not cleaned_text:
            raise HTTPException(
                status_code=400,
                detail="Text is empty after cleaning."
            )

        # TF-IDF transformation
        text_vector = vectorizer.transform(
            [cleaned_text]
        )

        # Abusive probability
        probability = model.predict_proba(
            text_vector
        )[0][1]

        # Threshold decision
        label = int(
            probability >= THRESHOLD
        )

        return {
            "label": label,
            "is_abusive": bool(label),
            "probability": round(
                float(probability),
                4
            ),
            "threshold": THRESHOLD
        }

    except HTTPException:
        raise

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=f"Prediction failed: {str(error)}"
        )