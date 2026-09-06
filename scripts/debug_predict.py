"""debug: ตรวจว่า embedder ใน predict คืนเวกเตอร์ต่างกันจริงไหม"""
import json
from pathlib import Path
import numpy as np
import joblib
from sentence_transformers import SentenceTransformer

config = json.loads((Path("models") / "model_config.json").read_text(encoding="utf-8"))
embedder = SentenceTransformer(config["embedding_model"])

texts = [
    "ตรวจสอบว่าเบรกเกอร์ตัดอยู่หรือไม่",
    "ทำความสะอาดแผ่นกรองอากาศ",
]

# encode ทีละตัว (แบบที่ predict_node.py ทำ)
v0 = embedder.encode([texts[0]])
v1 = embedder.encode([texts[1]])
print("เข้ารหัสทีละตัว:")
print("  ระยะห่าง:", float(np.linalg.norm(v0[0] - v1[0])))

# encode พร้อมกัน (แบบ batch)
vb = embedder.encode(texts)
print("เข้ารหัสพร้อมกัน (batch):")
print("  ระยะห่าง:", float(np.linalg.norm(vb[0] - vb[1])))