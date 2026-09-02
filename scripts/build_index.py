"""
สร้างไฟล์ดัชนีของ graph ทั้งหมด

อ่านทุกไฟล์ใน data/graphs/ แล้วสรุปเป็นตารางเดียว
ทำให้เห็นภาพรวมได้โดยไม่ต้องเปิดทีละไฟล์ และไม่ต้องรวมไฟล์เข้าด้วยกัน

วิธีใช้:
    python scripts/build_index.py
"""

import json
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent
MANUALS_DIR = REPO_ROOT / "data" / "manuals"
OUTPUT_JSON = REPO_ROOT / "data" / "index.json"
OUTPUT_MD = REPO_ROOT / "data" / "INDEX.md"


def count_node_types(nodes: list[dict]) -> dict[str, int]:
    """นับว่ามี node แต่ละประเภทกี่ตัว"""
    counts: dict[str, int] = {}
    for node in nodes:
        node_type = node.get("type", "unknown")
        counts[node_type] = counts.get(node_type, 0) + 1
    return counts


def summarize(graph: dict, manual_id: str) -> dict:
    """ดึงเฉพาะข้อมูลสำคัญของ graph หนึ่งอันออกมา"""
    nodes = graph.get("nodes", [])
    type_counts = count_node_types(nodes)

    return {
        "manual_id": manual_id,
        "graph_id": graph.get("graph_id"),
        "entry_symptom": graph.get("entry_symptom"),
        "entry_symptom_th": graph.get("entry_symptom_th"),
        "device_category": graph.get("device_category"),
        "brand": graph.get("brand"),
        "model_pattern": graph.get("model_pattern"),
        "source": graph.get("source"),
        "page_range": graph.get("page_range"),
        "severity": graph.get("severity"),
        "difficulty": graph.get("difficulty"),
        "node_count": len(nodes),
        "node_types": type_counts,
        # นับ node ที่ต้องมีคำเตือนความปลอดภัย
        "safety_nodes": sum(1 for n in nodes if n.get("safety_critical")),
        # นับว่ามีค่าคงที่จากคู่มือกี่ตัว
        "config_keys": list((graph.get("config") or {}).keys()),
    }


def build_markdown(entries: list[dict], manuals: list[dict]) -> str:
    """สร้างตารางแบบอ่านง่ายสำหรับคน"""
    lines = [
        "# ดัชนี Troubleshooting Graph",
        "",
        "> ไฟล์นี้สร้างอัตโนมัติด้วย `python scripts/build_index.py`",
        "> อย่าแก้ด้วยมือ เพราะจะถูกเขียนทับ",
        "",
        f"**คู่มือ {len(manuals)} เล่ม · รวม {len(entries)} graph**",
        "",
        "## คู่มือที่มี",
        "",
        "| manual_id | ยี่ห้อ | ประเภท | รุ่น | Graph |",
        "|---|---|---|---|---:|",
    ] + [
        f"| `{m['manual_id']}` | {m['brand']} | {m['device_category']} | `{m['model_pattern']}` | {m['graph_count']} |"
        for m in manuals
    ] + [
        "",
        "## รายการ graph ทั้งหมด",
        "",
        "| # | อาการ (ไทย) | graph_id | Node | Safety | หน้า |",
        "|:---:|---|---|:---:|:---:|:---:|",
    ]

    # เรียงจาก node น้อยไปมาก เพื่อให้อันที่เข้าใจง่ายอยู่บนสุด
    for i, e in enumerate(sorted(entries, key=lambda x: x["node_count"]), 1):
        symptom = e["entry_symptom_th"] or e["entry_symptom"] or "-"
        # ตัดส่วนหน้าของชื่อที่ซ้ำกันทุกอันออก เพื่อให้ตารางอ่านง่าย
        short_name = (e["graph_id"] or "").replace("samsung_ac_ar70h_", "")
        pages = e["page_range"]
        page_str = f"{pages[0]}-{pages[1]}" if pages else "-"
        safety = str(e["safety_nodes"]) if e["safety_nodes"] else "-"

        lines.append(
            f"| {i} | {symptom} | `{short_name}` | {e['node_count']} | {safety} | {page_str} |"
        )

    # สรุปรวม
    total_nodes = sum(e["node_count"] for e in entries)
    total_safety = sum(e["safety_nodes"] for e in entries)

    lines += [
        "",
        "## สรุป",
        "",
        "| รายการ | จำนวน |",
        "|---|---:|",
        f"| Graph | {len(entries)} |",
        f"| Node ทั้งหมด | {total_nodes} |",
        f"| Node ที่มี safety gate | {total_safety} |",
        "",
        "## แยกตามประเภท node",
        "",
        "| ประเภท | จำนวน |",
        "|---|---:|",
    ]

    all_types: dict[str, int] = {}
    for e in entries:
        for t, c in e["node_types"].items():
            all_types[t] = all_types.get(t, 0) + c

    for t, c in sorted(all_types.items(), key=lambda x: -x[1]):
        lines.append(f"| `{t}` | {c} |")

    return "\n".join(lines) + "\n"


def main():
    if not MANUALS_DIR.exists():
        print(f"ไม่พบโฟลเดอร์ {MANUALS_DIR}")
        return

    entries = []
    manuals = []
    for mf in sorted(MANUALS_DIR.glob("*.json")):
        raw = json.loads(mf.read_text(encoding="utf-8"))
        manual_id = raw.get("manual_id", mf.stem)
        graphs = raw.get("graphs", [])
        manuals.append({
            "manual_id": manual_id,
            "brand": raw.get("brand"),
            "device_category": raw.get("device_category"),
            "model_pattern": raw.get("model_pattern"),
            "source_manual": raw.get("source_manual"),
            "graph_count": len(graphs),
        })
        entries.extend(summarize(g, manual_id) for g in graphs)

    # ไฟล์ JSON สำหรับให้โปรแกรมอ่าน
    OUTPUT_JSON.write_text(
        json.dumps({"manuals": manuals, "count": len(entries), "graphs": entries},
                   indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    # ไฟล์ Markdown สำหรับให้คนอ่าน
    OUTPUT_MD.write_text(build_markdown(entries, manuals), encoding="utf-8")

    print(f"อ่าน graph {len(entries)} อัน")
    print(f"สร้าง {OUTPUT_JSON.relative_to(REPO_ROOT)}")
    print(f"สร้าง {OUTPUT_MD.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()