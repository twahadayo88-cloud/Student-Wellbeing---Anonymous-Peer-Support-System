import os
import re

import joblib

import uvicorn
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
    description="Abusive and off-topic content detection service for PeerBridge",
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
        "model": "TF-IDF + SGDClassifier",
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

        # Class probabilities: [Prob(Category 0), Prob(Category 1)]
        # Category 1 = Academic/Study Allowed
        # Category 0 = Off-Topic / Abusive / Personal Info Blocked
        probabilities = model.predict_proba(text_vector)[0]
        prob_academic = float(probabilities[1])
        prob_abusive = float(probabilities[0])

        # Flag message if Academic probability is below threshold (or Abusive prob is high)
        is_flagged = prob_academic < THRESHOLD

        return {
            "category": 1 if not is_flagged else 0,
            "is_flagged": is_flagged,
            "is_abusive": is_flagged,
            "confidence": round(max(prob_academic, prob_abusive), 4),
            "academic_probability": round(prob_academic, 4),
            "abusive_probability": round(prob_abusive, 4),
            "threshold": THRESHOLD
        }

    except HTTPException:
        raise

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=f"Prediction failed: {str(error)}"
        )


# ============================================================
# AUTO-START UVICORN SERVER
# ============================================================

if __name__ == "__main__":
    uvicorn.run("service.app:app", host="127.0.0.1", port=8000, reload=True)