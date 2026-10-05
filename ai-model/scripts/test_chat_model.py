import os
import joblib

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "../models")

MODEL_PATH = os.path.join(MODELS_DIR, "baseline_model.pkl")
VEC_PATH = os.path.join(MODELS_DIR, "tfidf_vectorizer.pkl")

print("Loading model artifacts...")
if not os.path.exists(MODEL_PATH) or not os.path.exists(VEC_PATH):
    print(f"ERROR: Model files not found in {MODELS_DIR}. Please run train.py first.")
    exit(1)

model = joblib.load(MODEL_PATH)
vectorizer = joblib.load(VEC_PATH)
print("Model and Vectorizer successfully loaded!\n")


def check_guardrails(text: str) -> bool:
    """Check for personal info leaks (WhatsApp, Insta, Phone Numbers)."""
    text_lower = text.lower()
    keywords = ["whatsapp", "instagram", "insta", "number", "phone", "contact", "mobile"]
    actions = ["share", "give", "send", "behjo", "da do", "tell"]

    if any(k in text_lower for k in keywords):
        if any(act in text_lower for act in actions):
            return True
    return False


print("==================================================")
print("     LIVE CHAT MODERATION MODEL TESTER (V2)       ")
print("==================================================")
print("Type any chat message and press Enter.")
print("Type 'exit' or 'quit' to close the tester.\n")

while True:
    user_input = input("Enter Chat Message: ").strip()

    if user_input.lower() in ["exit", "quit"]:
        break

    if not user_input:
        continue

    # 1. Guardrail Inspection
    if check_guardrails(user_input):
        prediction = 0
        confidence = 99.00
        reason = "Blocked by Personal Info Guardrail"
    else:
        # 2. Machine Learning Prediction
        cleaned_msg = user_input.lower()
        msg_vec = vectorizer.transform([cleaned_msg])
        prediction = int(model.predict(msg_vec)[0])
        probabilities = model.predict_proba(msg_vec)[0]
        confidence = probabilities[prediction] * 100
        reason = "ML Model Classification"

    if prediction == 1:
        label_str = "Category 1 (Study / Academic)"
        action = "ALLOWED (Message will be sent to chat)"
    else:
        label_str = "Category 0 (Off-Topic / Abusive / Personal Info)"
        action = "BLOCKED (Message goes to Admin Moderation Queue)"

    print("-" * 50)
    print(f"Prediction : {label_str}")
    print(f"Confidence : {confidence:.2f}% ({reason})")
    print(f"Action     : {action}")
    print("-" * 50)