"""
convert_with_classifier.py — แปลง flat chunks เป็นกราฟการแก้ปัญหา
โดยใช้ Node Type Classifier ที่ฝึกไว้ ช่วยตัดสินประเภทของแต่ละขั้นตอน

ต่างจาก convert_chunks_to_graphs.py อย่างไร
--------------------------------------------
เวอร์ชันเดิม  : ทุกขั้นตอนในช่อง solution ถูกกำหนดเป็น instruction ทั้งหมด
เวอร์ชันนี้   : ให้โมเดลอ่านข้อความแต่ละขั้นตอน แล้วตัดสินว่าเป็นประเภทใด
                ขั้นตอนที่เป็นการส่งต่อช่างจะกลายเป็นโหนด escalation
                ขั้นตอนที่บอกว่าเป็นอาการปกติจะกลายเป็นโหนด resolution

การใช้งาน
---------
    python scripts/convert_with_classifier.py <input.json> <output.json>
    python scripts/convert_with_classifier.py <input.json> <output.json> --report report.json
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

import joblib
import numpy as np

# นำฟังก์ชันแยกขั้นตอนและฟังก์ชันช่วยเหลือมาจากตัวแปลงเดิม
# เพื่อให้สองเวอร์ชันใช้ตรรกะการแยกขั้นตอนชุดเดียวกัน เปรียบเทียบผลกันได้ตรงไปตรงมา
sys.path.insert(0, str(Path(__file__).resolve().parent))
from convert_chunks_to_graphs import (  # noqa: E402
    clean_safety_warning,
    find_safety_step_index,
    is_normal_behavior,
    parse_solution_steps,
    slugify,
)

REPO_ROOT = Path(__file__).resolve().parent.parent
MODEL_PATH = REPO_ROOT / 'models' / 'node_classifier.joblib'
CONFIG_PATH = REPO_ROOT / 'models' / 'model_config.json'

# ถ้าโมเดลมั่นใจต่ำกว่านี้ จะไม่เชื่อผลทำนาย แต่ใช้ค่าปลอดภัยแทน
CONFIDENCE_THRESHOLD = 0.60

# ค่าปลอดภัยเมื่อโมเดลไม่มั่นใจ
# เลือก instruction เพราะเป็นประเภทที่ไม่ตัดจบเส้นทาง ผู้ใช้ยังเดินต่อได้
FALLBACK_TYPE = 'instruction'


# ---------------------------------------------------------------------------
# โหลดโมเดล
# ---------------------------------------------------------------------------

def load_classifier():
    if not CONFIG_PATH.exists() or not MODEL_PATH.exists():
        sys.exit(
            f'ไม่พบไฟล์โมเดลใน {REPO_ROOT / "models"}\n'
            'ต้องมี node_classifier.joblib และ model_config.json'
        )

    config = json.loads(CONFIG_PATH.read_text(encoding='utf-8'))
    model = joblib.load(MODEL_PATH)

    from sentence_transformers import SentenceTransformer

    model_name = config['embedding_model']
    print(f'กำลังโหลด embedding model: {model_name} ...', file=sys.stderr)
    embedder = SentenceTransformer(model_name)

    # ยืนยันว่า embedding ทำงานถูกต้องก่อนใช้งานจริง
    a = embedder.encode('เครื่องได้รับไฟฟ้าอยู่หรือไม่?')
    b = embedder.encode('ติดต่อศูนย์บริการ Samsung')
    if float(np.linalg.norm(a - b)) < 0.01:
        sys.exit('[ผิดพลาด] embedding คืนค่าเหมือนกันทุก input — ตรวจสอบ environment')

    return model, embedder, config


def classify_steps(steps: list[str], model, embedder) -> list[dict]:
    """จำแนกประเภทของทุกขั้นตอนในครั้งเดียว

    เข้ารหัสข้อความทั้งหมดพร้อมกันเพื่อความเร็ว
    """
    if not steps:
        return []

    vectors = embedder.encode(steps)
    probabilities = model.predict_proba(vectors)
    classes = model.classes_

    results = []
    for step_text, probs in zip(steps, probabilities):
        best_idx = int(np.argmax(probs))
        predicted = str(classes[best_idx])
        confidence = float(probs[best_idx])
        accepted = confidence >= CONFIDENCE_THRESHOLD

        results.append({
            'text': step_text,
            'predicted_type': predicted,
            'confidence': round(confidence, 4),
            'accepted': accepted,
            # ประเภทที่ใช้จริง ถ้าไม่มั่นใจจะใช้ค่าปลอดภัยแทน
            'final_type': predicted if accepted else FALLBACK_TYPE,
        })

    return results


# ---------------------------------------------------------------------------
# สร้างกราฟ
# ---------------------------------------------------------------------------

def build_graph(chunk: dict, brand: str, model, embedder) -> tuple[dict, list[dict]]:
    """สร้างกราฟหนึ่งกราฟ คืนค่า (กราฟ, บันทึกการจำแนก)"""
    meta = chunk.get('metadata', {})
    symptom = meta.get('symptom') or (chunk.get('content') or '')[:80]
    solution = meta.get('solution', '')
    safety_warning = clean_safety_warning(meta.get('safety_warning'))

    steps = parse_solution_steps(solution)
    used_content_fallback = False
    if not steps:
        fallback = (chunk.get('content') or '').strip()
        if fallback:
            steps = [fallback]
            solution = fallback
            used_content_fallback = True

    # --- ให้โมเดลจำแนกทุกขั้นตอน ---
    classified = classify_steps(steps, model, embedder)
    for record in classified:
        record['graph_symptom'] = symptom

    # --- แยกขั้นตอนตามประเภทที่โมเดลตัดสิน ---
    # ขั้นตอนที่เป็นการส่งต่อช่าง หรือเป็นการบอกว่าอาการปกติ
    # จะถูกดึงออกจากลำดับ ไปเป็นโหนดปลายทางแทน
    chain_steps = []        # ขั้นตอนที่ผู้ใช้ต้องลงมือทำตามลำดับ
    escalation_texts = []   # ข้อความส่งต่อช่างที่มาจากคู่มือจริง
    resolution_texts = []   # ข้อความที่บอกว่าเป็นอาการปกติ

    for record in classified:
        final_type = record['final_type']
        if final_type == 'escalation':
            escalation_texts.append(record['text'])
        elif final_type == 'resolution':
            resolution_texts.append(record['text'])
        else:
            # instruction และ checkpoint ถือเป็นขั้นตอนที่ต้องลงมือทำ
            chain_steps.append(record['text'])

    safety_index = (find_safety_step_index(chain_steps, safety_warning)
                    if safety_warning else None)

    nodes: list[dict] = []

    # --- โหนดยืนยันอาการ ---
    nodes.append({
        'node_id': 'n1',
        'type': 'checkpoint',
        'question': f'อาการที่พบตรงกับ "{symptom}" ใช่หรือไม่?',
        'safety_critical': False,
        'author_note': 'โหนดยืนยันอาการ สร้างโดยสคริปต์แปลง ไม่ได้มาจากคู่มือโดยตรง',
        'on_yes': None,
        'on_no': 'n_escalate_mismatch',
    })

    # เตรียมข้อความของโหนดปลายทาง
    # ถ้าโมเดลพบข้อความส่งต่อช่างในคู่มือ ให้ใช้ข้อความจริงแทน template
    if escalation_texts:
        escalate_content = ' '.join(escalation_texts)
        escalate_from_manual = True
    else:
        escalate_content = (
            f'ดำเนินการตามขั้นตอนในคู่มือครบทุกข้อแล้วแต่ยังไม่สามารถแก้ปัญหาได้ '
            f'แนะนำให้ติดต่อศูนย์บริการ {brand} '
            f'พร้อมแจ้งรุ่นเครื่อง อาการที่พบ และขั้นตอนที่ได้ลองทำไปแล้ว'
        )
        escalate_from_manual = False

    # --- กรณีที่ 1: คู่มือระบุว่าเป็นอาการปกติ ---
    if is_normal_behavior(solution) or (resolution_texts and not chain_steps):
        content = ' '.join(resolution_texts) if resolution_texts else solution.strip()
        nodes[0]['on_yes'] = 'n_normal'
        nodes.append({
            'node_id': 'n_normal',
            'type': 'resolution',
            'content': content,
            'outcome_kind': 'normal_behavior',
        })

    # --- กรณีที่ 2: ไม่มีขั้นตอนให้ทำ มีแต่การส่งต่อช่าง ---
    elif not chain_steps:
        nodes[0]['on_yes'] = 'n_escalate'
        nodes.append({
            'node_id': 'n_escalate',
            'type': 'escalation',
            'content': escalate_content,
            'outcome_kind': 'handoff_informed' if escalate_from_manual else 'handoff_unknown',
            'author_note': ('ข้อความมาจากคู่มือโดยตรง โมเดลจำแนกว่าเป็นการส่งต่อช่าง'
                            if escalate_from_manual else None),
        })

    # --- กรณีที่ 3: มีขั้นตอนให้ผู้ใช้ทำ (กรณีทั่วไป) ---
    else:
        nodes[0]['on_yes'] = 's1'

        for i, step_text in enumerate(chain_steps, start=1):
            is_last = (i == len(chain_steps))

            instruction = {
                'node_id': f's{i}',
                'type': 'instruction',
                'content': step_text,
                'safety_critical': (safety_index == i - 1),
                'next': f'c{i}',
            }
            if safety_index == i - 1:
                instruction['safety_warning'] = safety_warning
                instruction['author_note'] = (
                    'safety_warning จับคู่กับขั้นตอนนี้โดยสคริปต์ ผู้พัฒนาต้องตรวจสอบอีกครั้ง'
                )
            nodes.append(instruction)

            nodes.append({
                'node_id': f'c{i}',
                'type': 'checkpoint',
                'question': 'หลังดำเนินการขั้นตอนนี้แล้ว ปัญหาได้รับการแก้ไขหรือไม่?',
                'safety_critical': False,
                'author_note': 'โหนดตรวจผลลัพธ์ สร้างโดยสคริปต์แปลง',
                'on_yes': 'n_resolved',
                'on_no': 'n_escalate' if is_last else f's{i + 1}',
            })

        resolved_content = (' '.join(resolution_texts) if resolution_texts
                            else f'ปัญหา "{symptom}" ได้รับการแก้ไขเรียบร้อยแล้ว')
        nodes.append({
            'node_id': 'n_resolved',
            'type': 'resolution',
            'content': resolved_content,
            'outcome_kind': 'user_fixed',
        })

        nodes.append({
            'node_id': 'n_escalate',
            'type': 'escalation',
            'content': escalate_content,
            'outcome_kind': 'handoff_informed' if escalate_from_manual else 'handoff_unknown',
            'author_note': ('ข้อความมาจากคู่มือโดยตรง โมเดลจำแนกว่าเป็นการส่งต่อช่าง'
                            if escalate_from_manual else None),
        })

    # --- โหนดกรณีอาการไม่ตรงคู่มือ ---
    nodes.append({
        'node_id': 'n_escalate_mismatch',
        'type': 'escalation',
        'content': (
            f'อาการที่พบไม่ตรงกับหัวข้อนี้ในคู่มือ '
            f'แนะนำให้ตรวจสอบอาการอีกครั้ง หรือติดต่อศูนย์บริการ {brand} '
            f'พร้อมอธิบายอาการที่พบโดยละเอียด'
        ),
        'outcome_kind': 'handoff_unknown',
    })

    # ลบ author_note ที่เป็นค่าว่าง
    for n in nodes:
        if n.get('author_note') is None:
            n.pop('author_note', None)

    # --- ตรวจสอบเส้นเชื่อมทันที ---
    node_ids = {n['node_id'] for n in nodes}
    for n in nodes:
        for key in ('on_yes', 'on_no', 'next', 'on_invalid'):
            target = n.get(key)
            if target is not None and target not in node_ids:
                raise ValueError(
                    f"กราฟของอาการ '{symptom}': โหนด {n['node_id']} "
                    f"มี {key} ชี้ไปยัง '{target}' ซึ่งไม่มีอยู่จริง"
                )

    page = chunk.get('page')
    notes = []
    if used_content_fallback:
        notes.append('ข้อมูลต้นทางไม่มีช่อง solution จึงใช้ข้อความจากช่อง content แทน')
    reclassified = [r for r in classified if r['final_type'] != 'instruction']
    if reclassified:
        notes.append(
            f'โมเดลจำแนกขั้นตอน {len(reclassified)} รายการ ว่าไม่ใช่ instruction '
            f'ผู้พัฒนาควรตรวจสอบความเหมาะสม'
        )

    graph = {
        'schema_version': 2,
        'graph_id': f"{slugify(chunk.get('model', ''), 3)}_{slugify(symptom)}",
        'device_category': chunk.get('device_category'),
        'brand': chunk.get('brand'),
        'model_pattern': chunk.get('model'),
        'entry_symptom': symptom,
        'entry_symptom_th': '',
        'source': chunk.get('source'),
        'page_range': [page, page] if isinstance(page, int) else None,
        'source_chunk_id': chunk.get('chunk_id'),
        'severity': meta.get('severity'),
        'difficulty': meta.get('difficulty'),
        'possible_cause': meta.get('possible_cause'),
        'generated_by': 'convert_with_classifier.py',
        'review_status': 'pending_manual_review',
        'conversion_notes': notes,
        'classification_log': classified,
        'entry_node': 'n1',
        'nodes': nodes,
    }

    return graph, classified


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description='แปลง flat chunks เป็นกราฟ โดยใช้ classifier ช่วยจำแนกประเภทขั้นตอน'
    )
    parser.add_argument('input', help='ไฟล์ JSON ต้นทาง')
    parser.add_argument('output', help='ไฟล์ JSON ปลายทาง')
    parser.add_argument('--report', help='ไฟล์บันทึกผลการจำแนกทั้งหมด (ไม่บังคับ)')
    args = parser.parse_args()

    model, embedder, config = load_classifier()

    chunks = json.loads(Path(args.input).read_text(encoding='utf-8'))
    brand = chunks[0].get('brand', 'ผู้ผลิต')

    graphs = []
    all_records = []
    for chunk in chunks:
        graph, records = build_graph(chunk, brand, model, embedder)
        graphs.append(graph)
        all_records.extend(records)

    first = chunks[0]
    manual = {
        'schema_version': 2,
        'manual_id': slugify(f"{first.get('brand','')} {first.get('model','')}", 4),
        'device_category': first.get('device_category'),
        'brand': brand,
        'model_pattern': first.get('model'),
        'source_manual': first.get('source'),
        'generated_by': 'convert_with_classifier.py',
        'classifier_model': config.get('embedding_model'),
        'classifier_cv_accuracy': config.get('cv_accuracy_mean'),
        'confidence_threshold': CONFIDENCE_THRESHOLD,
        'review_status': 'pending_manual_review',
        'count': len(graphs),
        'graphs': graphs,
    }

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(manual, ensure_ascii=False, indent=2), encoding='utf-8'
    )

    # --- สรุปผล ---
    predicted_counts = Counter(r['predicted_type'] for r in all_records)
    final_counts = Counter(r['final_type'] for r in all_records)
    low_confidence = [r for r in all_records if not r['accepted']]
    changed = [r for r in all_records if r['final_type'] != 'instruction']

    print()
    print('=' * 62)
    print(f"[{manual['manual_id']}]  {len(graphs)} กราฟ  "
          f"{sum(len(g['nodes']) for g in graphs)} โหนด")
    print('=' * 62)
    print(f'ขั้นตอนที่ให้โมเดลจำแนกทั้งหมด: {len(all_records)}')
    print()
    print('ผลการทำนายของโมเดล (ก่อนใช้เกณฑ์ความมั่นใจ):')
    for t, c in predicted_counts.most_common():
        print(f'    {t:14} {c:4}')
    print()
    print(f'ความมั่นใจต่ำกว่า {CONFIDENCE_THRESHOLD:.0%} '
          f'(ใช้ค่าปลอดภัย {FALLBACK_TYPE} แทน): {len(low_confidence)}')
    print()
    print('ประเภทที่ใช้จริงหลังใช้เกณฑ์:')
    for t, c in final_counts.most_common():
        print(f'    {t:14} {c:4}')
    print()
    print(f'ขั้นตอนที่ถูกจัดใหม่ไม่ใช่ instruction: {len(changed)}')

    if changed:
        print()
        print('--- ตัวอย่างขั้นตอนที่โมเดลจัดใหม่ (ควรตรวจสอบ) ---')
        for r in changed[:10]:
            preview = r['text'][:62] + ('...' if len(r['text']) > 62 else '')
            print(f"  [{r['final_type']:11} {r['confidence']:.0%}] {preview}")

    if args.report:
        report_path = Path(args.report)
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(
            json.dumps(all_records, ensure_ascii=False, indent=2), encoding='utf-8'
        )
        print()
        print(f'บันทึกผลการจำแนกทั้งหมดไว้ที่ {args.report}')


if __name__ == '__main__':
    main()