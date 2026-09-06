"""
Node Type Classifier — Phase 9
เทรนตัวจำแนกประเภทโหนดจาก 95 node ที่ label ด้วยมือใน Phase 1

วิธีรัน:
    python scripts/train_classifier.py
"""

import json
import re
from pathlib import Path

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix, classification_report
from sklearn.model_selection import StratifiedKFold, cross_val_score
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.pipeline import Pipeline

# ─────────────────────────────────────────
# 1. โหลดข้อมูล
# ─────────────────────────────────────────

MANUAL = Path("data/manuals/samsung_ac_ar70h.json")

def extract_text(node: dict) -> str:
    """ดึงข้อความตัวแทนของโหนด — ใช้ทุก field ที่มีข้อความ"""
    parts = []
    for key in ("question", "content", "prompt"):
        if node.get(key):
            parts.append(node[key])
    return " ".join(parts)

def load_dataset():
    raw = json.loads(MANUAL.read_text(encoding="utf-8"))
    texts, labels = [], []
    for graph in raw["graphs"]:
        for node in graph["nodes"]:
            text = extract_text(node)
            if text:
                texts.append(text)
                labels.append(node["type"])
    return texts, labels

texts, labels = load_dataset()
label_names = sorted(set(labels))

print(f"Dataset: {len(texts)} nodes")
print(f"Label distribution:")
for l in label_names:
    print(f"  {l}: {labels.count(l)}")
print()

# ─────────────────────────────────────────
# 2. Baseline — กฎ if-else
# ─────────────────────────────────────────

CHECK_WORDS  = r"^(check|verify|make sure|is |are |does |did |was |were |has |have )"
ACTION_WORDS = r"^(clean|press|flip|remove|charge|plug|turn|write|contact|refer|operate)"
ESCALATE     = r"(contact|service provider|technician|call)"
RESOLUTION   = r"(this is normal|no action|does not require)"

def baseline_predict(text: str) -> str:
    t = text.strip().lower()
    if re.search(RESOLUTION, t):
        return "resolution"
    if re.search(ESCALATE, t):
        return "escalation"
    if re.search(CHECK_WORDS, t):
        return "checkpoint"
    if re.search(ACTION_WORDS, t):
        return "instruction"
    return "instruction"   # default

baseline_preds = [baseline_predict(t) for t in texts]
baseline_acc   = accuracy_score(labels, baseline_preds)

print("=" * 60)
print("Baseline (if-else rules)")
print("=" * 60)
print(f"Accuracy: {baseline_acc:.3f}")
print()
print(classification_report(labels, baseline_preds,
      target_names=label_names, zero_division=0))

# ─────────────────────────────────────────
# 3. TF-IDF + Logistic Regression
# ─────────────────────────────────────────

tfidf_pipeline = Pipeline([
    ("tfidf", TfidfVectorizer(ngram_range=(1, 2), max_features=3000)),
    ("clf",   LogisticRegression(max_iter=1000, random_state=42)),
])

cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
tfidf_scores = cross_val_score(tfidf_pipeline, texts, labels,
                                cv=cv, scoring="accuracy")

print("=" * 60)
print("TF-IDF + Logistic Regression (5-fold CV)")
print("=" * 60)
print(f"Accuracy: {tfidf_scores.mean():.3f} ± {tfidf_scores.std():.3f}")
print()

# เทรนบนข้อมูลทั้งหมดเพื่อดู classification report
tfidf_pipeline.fit(texts, labels)
tfidf_preds = tfidf_pipeline.predict(texts)
print(classification_report(labels, tfidf_preds,
      target_names=label_names, zero_division=0))

# ─────────────────────────────────────────
# 4. Sentence Embedding + Logistic Regression
# ─────────────────────────────────────────

print("=" * 60)
print("Sentence Embedding + Logistic Regression (5-fold CV)")
print("=" * 60)
print("กำลังสร้าง embeddings... (อาจใช้เวลาสักครู่)")

from sentence_transformers import SentenceTransformer

model = SentenceTransformer("all-MiniLM-L6-v2")
X_emb = model.encode(texts, show_progress_bar=False)

clf_emb = LogisticRegression(max_iter=1000, random_state=42)
emb_scores = cross_val_score(clf_emb, X_emb, labels,
                              cv=cv, scoring="accuracy")

print(f"Accuracy: {emb_scores.mean():.3f} ± {emb_scores.std():.3f}")
print()

clf_emb.fit(X_emb, labels)
emb_preds = clf_emb.predict(X_emb)
print(classification_report(labels, emb_preds,
      target_names=label_names, zero_division=0))

# ─────────────────────────────────────────
# 5. สรุปเปรียบเทียบ
# ─────────────────────────────────────────

print("=" * 60)
print("สรุปเปรียบเทียบ")
print("=" * 60)
print(f"{'วิธี':<40} {'Accuracy':>10}")
print("-" * 52)
print(f"{'Baseline (if-else)':<40} {baseline_acc:>10.3f}")
print(f"{'TF-IDF + Logistic Regression':<40} {tfidf_scores.mean():>10.3f}")
print(f"{'Sentence Embedding + LR':<40} {emb_scores.mean():>10.3f}")
print()
print("หมายเหตุ: TF-IDF และ Embedding ใช้ 5-fold CV")
print("         Baseline ไม่มี CV เพราะไม่มีการเรียนรู้")


# ─────────────────────────────────────────
# 6. เทรนโมเดลสุดท้ายด้วยข้อมูลทั้งหมด แล้ว save
# ─────────────────────────────────────────

import joblib

print()
print("=" * 60)
print("บันทึกโมเดลที่ดีที่สุด (Embedding + LR)")
print("=" * 60)

# เทรน LR ด้วยข้อมูลทั้งหมด (ตอนใช้งานจริงใช้ทุก sample ที่มี)
final_clf = LogisticRegression(max_iter=1000, random_state=42)
final_clf.fit(X_emb, labels)

# save เฉพาะ LogisticRegression ที่เราเทรนเอง
# ส่วน SentenceTransformer โหลดจาก library ตอนใช้งาน ไม่ต้อง save
MODEL_DIR = Path("models")
MODEL_DIR.mkdir(exist_ok=True)

joblib.dump(final_clf, MODEL_DIR / "node_classifier.joblib")

# save ชื่อ embedding model ที่ใช้ เพื่อให้ตอนโหลดใช้ตัวเดียวกัน
config = {
    "embedding_model": "all-MiniLM-L6-v2",
    "labels": label_names,
    "cv_accuracy": round(float(emb_scores.mean()), 3),
}
(MODEL_DIR / "model_config.json").write_text(
    json.dumps(config, ensure_ascii=False, indent=2), encoding="utf-8"
)

print(f"✓ บันทึกโมเดลที่ models/node_classifier.joblib")
print(f"✓ บันทึก config ที่ models/model_config.json")
print(f"  CV accuracy: {config['cv_accuracy']}")