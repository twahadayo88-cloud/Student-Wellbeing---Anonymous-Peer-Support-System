import os
import random
import time
import joblib
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import SGDClassifier

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASETS_DIR = os.path.join(BASE_DIR, "../datasets")
MODELS_DIR = os.path.join(BASE_DIR, "../models")

os.makedirs(MODELS_DIR, exist_ok=True)

TRAIN_FILE = os.path.join(DATASETS_DIR, "processed/combined_train.csv")

print("==================================================")
print("     PEERBRIDGE AI - MODEL RETRAINING PIPELINE    ")
print("==================================================")

start_time = time.time()

ALL_SUBJECTS = [
    "computer science", "cs", "dsa", "data structures", "algorithms", "oop", 
    "c++", "python", "java", "javascript", "web development", "database", "dbms", 
    "sql", "operating system", "os", "computer networks", "cyber security", 
    "information security", "ai", "artificial intelligence", "machine learning", 
    "software engineering", "compiler construction", "math", "maths", "calculus", 
    "linear algebra", "discrete math", "statistics", "differential equations", 
    "physics", "applied physics", "circuits", "electronics", "biology", "chemistry", 
    "organic chemistry", "biochemistry", "botany", "zoology", "accounting", 
    "finance", "management", "economics", "english", "urdu", "islamiat", 
    "pak studies", "sociology", "psychology", "law"
]

ACADEMIC_TEMPLATES = [
    "mujhe {subj} ky notes behjo",
    "please {subj} ky notes share kar do",
    "kiya tumary pass {subj} ky notes hn",
    "mujhe {subj} mai help karo",
    "tumne meri madad karni hy {subj} ky paper mai",
    "information security ky notes share kar dein",
    "{subj} ka syllabus share kar do",
    "{subj} ke past papers chahiye",
    "{subj} ka quiz kab hai",
    "help me in {subj}",
    "please share {subj} study material",
    "explain {subj} concept"
]

OFFTOPIC_TEMPLATES = [
    "please share me your whatsapp number",
    "please share me your instagram",
    "share your phone number",
    "contact me on whatsapp",
    "send me your insta id",
    "give me your mobile number",
    "tume {subj} ata haw",
    "tumhein {subj} ka subject ata hy",
    "tume sub subjects aty hn",
    "kya tum {subj} me master ho",
    "tum kitne intelligent ho",
    "tumhara name kya hai",
    "tu kahan rehta hai",
    "kal university ke bahar milo"
]

print("1. Generating Synthetic Balanced Patterns...")
augmented_data = []

# Balanced 1500 iterations per category to keep memory optimal
for _ in range(1500):
    for tmpl in ACADEMIC_TEMPLATES:
        subj = random.choice(ALL_SUBJECTS)
        augmented_data.append({"message": tmpl.format(subj=subj), "category": 1})

for _ in range(1500):
    for tmpl in OFFTOPIC_TEMPLATES:
        subj = random.choice(ALL_SUBJECTS)
        augmented_data.append({"message": tmpl.format(subj=subj), "category": 0})

aug_df = pd.DataFrame(augmented_data)

print("2. Loading Base Datasets...")
if os.path.exists(TRAIN_FILE):
    train_df = pd.read_csv(TRAIN_FILE, dtype={"category": "int8"}, on_bad_lines="skip")
else:
    train_df = pd.DataFrame(columns=["message", "category"])

train_df["message"] = train_df["message"].fillna("").astype(str)
train_df = pd.concat([train_df, aug_df], ignore_index=True)
train_df = train_df.sample(frac=1, random_state=42).reset_index(drop=True)

print("3. Extracting TF-IDF Features (Memory Optimized)...")
vectorizer = TfidfVectorizer(
    max_features=50000,       # Reduced from 250k to fix MemoryError
    ngram_range=(1, 2),       # Reduced from (1, 3) for efficient memory usage
    min_df=2,
    strip_accents="unicode",
    sublinear_tf=True
)

X_train_vec = vectorizer.fit_transform(train_df["message"])
y_train = train_df["category"]

del train_df

print("4. Training SGD Classifier...")
model = SGDClassifier(
    loss="log_loss",
    penalty="l2",
    alpha=1e-5,
    max_iter=35,
    class_weight="balanced",
    random_state=42
)
model.fit(X_train_vec, y_train)

print(f"5. Saving Models to '{MODELS_DIR}'...")
model_save_path = os.path.join(MODELS_DIR, "baseline_model.pkl")
vec_save_path = os.path.join(MODELS_DIR, "tfidf_vectorizer.pkl")

joblib.dump(model, model_save_path)
joblib.dump(vectorizer, vec_save_path)

elapsed = time.time() - start_time
print(f"\nSUCCESS! Retraining completed in {elapsed:.2f} seconds.")
print("==================================================")