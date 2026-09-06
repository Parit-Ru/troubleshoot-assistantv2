"""ตรวจว่า embedding โหลดถูกต้องไหม — เวอร์ชันละเอียด"""
import numpy as np
from sentence_transformers import SentenceTransformer
import sentence_transformers, torch

print("sentence-transformers:", sentence_transformers.__version__)
print("torch:", torch.__version__)
print()

print("กำลังโหลดโมเดล...")
model = SentenceTransformer("all-MiniLM-L6-v2")
print("โหลดเสร็จ")
print()

# ลองใส่ข้อความที่ต่างกันสุดขั้ว
texts = ["hello world", "เบรกเกอร์", "xyz123 completely different sentence"]
emb = model.encode(texts, convert_to_numpy=True, normalize_embeddings=False)

print("shape:", emb.shape)
print("แถว 0 vs แถว 1 ต่างกันไหม:", not np.allclose(emb[0], emb[1]))
print("ระยะห่าง 0-1:", float(np.linalg.norm(emb[0] - emb[1])))
print("ระยะห่าง 0-2:", float(np.linalg.norm(emb[0] - emb[2])))
print("ผลรวมสัมบูรณ์ของ emb[0]:", float(np.abs(emb[0]).sum()))