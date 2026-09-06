import json
from pathlib import Path
import numpy as np
from sentence_transformers import SentenceTransformer

config = json.loads((Path("models") / "model_config.json").read_text(encoding="utf-8"))
print("ชื่อ model ใน config:", repr(config["embedding_model"]))

texts = ["ตรวจสอบเบรกเกอร์", "ทำความสะอาดแผ่นกรอง"]

print("\n--- โหลดตรงๆ ด้วยชื่อ hardcode ---")
m1 = SentenceTransformer("all-MiniLM-L6-v2")
v = m1.encode(texts)
print("ระยะห่าง:", float(np.linalg.norm(v[0] - v[1])))

print("\n--- โหลดด้วยชื่อจาก config ---")
m2 = SentenceTransformer(config["embedding_model"])
v = m2.encode(texts)
print("ระยะห่าง:", float(np.linalg.norm(v[0] - v[1])))