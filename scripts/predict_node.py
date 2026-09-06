"""
predict_node.py — ใช้โมเดล Node Type Classifier ที่เทรนไว้ ทำนายประเภทของ node

โมเดลเทรนบน Kaggle (ดู fixbot_node_classifier_kaggle.ipynb) แล้ว download
node_classifier.joblib + model_config.json มาไว้ในโฟลเดอร์ models/

การใช้งาน:
    # ทำนายข้อความเดียว
    python scripts/predict_node.py "เครื่องได้รับไฟฟ้าอยู่หรือไม่?"

    # โหมด interactive (พิมพ์ทีละบรรทัด กด Ctrl+C เพื่อออก)
    python scripts/predict_node.py

    # ทำนายทุก node ในไฟล์ graph แล้วเทียบกับ label จริง
    python scripts/predict_node.py --eval data/manuals/samsung_ac_ar70h.json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import joblib
import numpy as np

# ---------------------------------------------------------------------------
# ค่าคงที่: path ของไฟล์โมเดล (อ้างอิงจาก repo root)
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parent.parent
MODEL_PATH = REPO_ROOT / "models" / "node_classifier.joblib"
CONFIG_PATH = REPO_ROOT / "models" / "model_config.json"

# ถ้าความมั่นใจต่ำกว่านี้ ถือว่าโมเดลไม่แน่ใจ ควรให้คนตรวจสอบ
# สอดคล้องกับหลักการของโปรเจกต์: confidence ต่ำ -> ไม่เดา แต่แจ้งว่าไม่แน่ใจ
CONFIDENCE_THRESHOLD = 0.60


# ---------------------------------------------------------------------------
# โหลดโมเดลและ config
# ---------------------------------------------------------------------------


def load_config() -> dict:
    """โหลด model_config.json ที่บันทึกไว้ตอนเทรน"""
    if not CONFIG_PATH.exists():
        sys.exit(
            f"ไม่พบไฟล์ config ที่ {CONFIG_PATH}\n"
            "กรุณา download model_config.json จาก Kaggle output มาวางในโฟลเดอร์ models/"
        )
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def load_classifier(config: dict):
    """โหลดโมเดล Logistic Regression พร้อมเตือนถ้า sklearn version ไม่ตรงกับตอนเทรน"""
    if not MODEL_PATH.exists():
        sys.exit(
            f"ไม่พบไฟล์โมเดลที่ {MODEL_PATH}\n"
            "กรุณา download node_classifier.joblib จาก Kaggle output มาวางในโฟลเดอร์ models/"
        )

    import sklearn

    trained_version = config.get("sklearn_version")
    current_version = sklearn.__version__
    if trained_version and trained_version != current_version:
        print(
            f"[เตือน] โมเดลเทรนด้วย scikit-learn {trained_version} "
            f"แต่เครื่องนี้ใช้ {current_version}\n"
            f"        ปกติยังใช้งานได้ แต่ถ้าเจอผลแปลกๆ ให้ลง scikit-learn=={trained_version}",
            file=sys.stderr,
        )

    return joblib.load(MODEL_PATH)


def load_embedder(config: dict):
    """โหลด SentenceTransformer ตัวเดียวกับที่ใช้ตอนเทรน

    สำคัญ: ต้องเป็นโมเดลเดียวกันเป๊ะ ไม่งั้น embedding ที่ได้จะอยู่คนละ vector space
    กับที่โมเดล Logistic Regression เรียนรู้มา ผลทำนายจะมั่วทันที
    """
    from sentence_transformers import SentenceTransformer

    model_name = config["embedding_model"]
    print(f"กำลังโหลด embedding model: {model_name} ...", file=sys.stderr)
    embedder = SentenceTransformer(model_name)

    # --- sanity check: ยืนยันว่า embedding ไม่ได้คืนค่าเท่ากันทุก input ---
    # นี่คือบั๊กที่เคยเจอตอนพัฒนา ถ้าไม่เช็คแล้วปล่อยผ่าน ผลทำนายจะเชื่อไม่ได้เลย
    a = embedder.encode("เครื่องได้รับไฟฟ้าอยู่หรือไม่?")
    b = embedder.encode("ติดต่อศูนย์บริการ Samsung")
    if float(np.linalg.norm(a - b)) < 0.01:
        sys.exit(
            "[ผิดพลาด] embedding คืนค่าเหมือนกันทุก input — โมเดลโหลดไม่สมบูรณ์\n"
            "        ตรวจสอบ environment: torch/numpy/sentence-transformers version"
        )

    return embedder


# ---------------------------------------------------------------------------
# ทำนาย
# ---------------------------------------------------------------------------


def predict(text: str, embedder, classifier, top_k: int = 3) -> dict:
    """ทำนายประเภทของ node จากข้อความ

    คืนค่า dict ที่มี label ที่ทำนายได้ ความมั่นใจ และอันดับรองลงมา
    """
    vector = embedder.encode([text])
    probabilities = classifier.predict_proba(vector)[0]
    classes = classifier.classes_

    # เรียงจากความน่าจะเป็นมากไปน้อย
    ranked_indices = np.argsort(probabilities)[::-1]
    ranked = [
        {"label": str(classes[i]), "probability": float(probabilities[i])}
        for i in ranked_indices[:top_k]
    ]

    best = ranked[0]
    return {
        "text": text,
        "predicted_label": best["label"],
        "confidence": best["probability"],
        "is_confident": best["probability"] >= CONFIDENCE_THRESHOLD,
        "top_k": ranked,
    }


def print_prediction(result: dict) -> None:
    """แสดงผลการทำนายให้อ่านง่าย"""
    print()
    print(f"ข้อความ: {result['text']}")
    print(f"ทำนาย  : {result['predicted_label']}  ({result['confidence']:.1%})")

    if not result["is_confident"]:
        print(
            f"         [ไม่มั่นใจ] ความมั่นใจต่ำกว่า {CONFIDENCE_THRESHOLD:.0%} "
            "ควรให้คนตรวจสอบ"
        )

    print("  อันดับรองลงมา:")
    for item in result["top_k"][1:]:
        print(f"    - {item['label']}: {item['probability']:.1%}")


# ---------------------------------------------------------------------------
# โหมดประเมินผลกับไฟล์ graph จริง
# ---------------------------------------------------------------------------


def extract_text(node: dict) -> str:
    """ดึงข้อความหลักของ node ตาม field ที่ถูกต้องของแต่ละ type

    ต้องตรงกับ logic ที่ใช้ตอนเทรนใน notebook เป๊ะๆ
    checkpoint -> question, input -> prompt, ที่เหลือ -> content
    """
    node_type = node.get("type")
    if node_type == "checkpoint":
        return node.get("question", "")
    if node_type == "input":
        return node.get("prompt", "")
    return node.get("content", "")


def run_eval(json_path: Path, embedder, classifier, config: dict) -> None:
    """ทำนายทุก node ในไฟล์ graph แล้วเทียบกับ label จริง"""
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    excluded = set(config.get("excluded_labels", []))

    nodes = []
    for graph in data["graphs"]:
        for node in graph["nodes"]:
            if node["type"] in excluded:
                continue
            nodes.append(
                {
                    "graph_id": graph["graph_id"],
                    "node_id": node["node_id"],
                    "actual": node["type"],
                    "text": extract_text(node),
                }
            )

    print(f"ทำนาย {len(nodes)} node จาก {json_path.name} ...\n")

    texts = [n["text"] for n in nodes]
    vectors = embedder.encode(texts, show_progress_bar=True)
    predictions = classifier.predict(vectors)
    probabilities = classifier.predict_proba(vectors).max(axis=1)

    correct = 0
    mistakes = []
    for node, pred, prob in zip(nodes, predictions, probabilities):
        if node["actual"] == pred:
            correct += 1
        else:
            mistakes.append((node, pred, prob))

    accuracy = correct / len(nodes) if nodes else 0.0

    print()
    print("=" * 64)
    print(f"ถูก {correct}/{len(nodes)} = {accuracy:.1%}")
    print("=" * 64)
    print(
        "\n[หมายเหตุสำคัญ] ตัวเลขนี้เป็น in-sample — โมเดลเคยเห็นข้อมูลชุดนี้ตอนเทรนแล้ว\n"
        "จึงสูงกว่าความเป็นจริง ห้ามใช้เป็นตัวเลขวัดผลตอนสอบ\n"
        f"ตัวเลขที่ใช้อ้างอิงได้จริงคือ cross-validation: "
        f"{config.get('cv_accuracy_mean', 0):.3f}"
    )

    if mistakes:
        print(f"\nรายการที่ทำนายผิด ({len(mistakes)} รายการ):")
        for node, pred, prob in mistakes:
            print(f"\n  [{node['graph_id']} / {node['node_id']}]")
            print(f"  จริง: {node['actual']}  ->  ทำนาย: {pred} ({prob:.1%})")
            preview = node["text"][:70] + ("..." if len(node["text"]) > 70 else "")
            print(f"  ข้อความ: {preview}")


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        description="ทำนายประเภทของ node ในกราฟ troubleshooting"
    )
    parser.add_argument(
        "text",
        nargs="?",
        help="ข้อความที่ต้องการทำนาย (ถ้าไม่ใส่จะเข้าโหมด interactive)",
    )
    parser.add_argument(
        "--eval",
        metavar="JSON_PATH",
        help="ทำนายทุก node ในไฟล์ graph แล้วเทียบกับ label จริง",
    )
    args = parser.parse_args()

    config = load_config()
    classifier = load_classifier(config)
    embedder = load_embedder(config)

    print(f"\nโมเดลพร้อมใช้งาน — ทำนายได้ {len(classifier.classes_)} คลาส: "
          f"{', '.join(classifier.classes_)}")

    excluded = config.get("excluded_labels", [])
    if excluded:
        print(f"[ข้อจำกัด] โมเดลไม่สามารถทำนาย {', '.join(excluded)} ได้ "
              f"เพราะไม่ได้เทรนด้วยคลาสนี้")
        print(f"           เหตุผล: {config.get('excluded_reason', '-')}")

    cv_mean = config.get("cv_accuracy_mean")
    if cv_mean:
        print(f"[อ้างอิง] ความแม่นยำจาก cross-validation: {cv_mean:.1%}")

    # --- โหมดประเมินผลกับไฟล์ ---
    if args.eval:
        run_eval(Path(args.eval), embedder, classifier, config)
        return

    # --- โหมดทำนายข้อความเดียว ---
    if args.text:
        print_prediction(predict(args.text, embedder, classifier))
        return

    # --- โหมด interactive ---
    print("\nโหมด interactive — พิมพ์ข้อความแล้วกด Enter (Ctrl+C เพื่อออก)")
    try:
        while True:
            text = input("\n> ").strip()
            if not text:
                continue
            print_prediction(predict(text, embedder, classifier))
    except (KeyboardInterrupt, EOFError):
        print("\nจบการทำงาน")


if __name__ == "__main__":
    main()