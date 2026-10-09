#!/usr/bin/env python3
"""
verify_chunks.py  -  check that knowledge-base chunks and troubleshooting graphs match the source manual.

What it checks
  1. Chunk text vs. the cited manual page
       symptom + every solution step is compared with the text of the cited page
       (word-trigram coverage; pages that are images are read with tesseract OCR).
  2. Numbers (hours, litres, degrees, ...) written in the chunk or graph must appear on the cited page.
  3. Wrong-page detection: nearby pages (+/- --window) are scored too; a clearly better page is flagged.
  4. Graph <-> chunk consistency (model, source, severity, page range) and every "คู่มือหน้า N" citation in graphs.
  5. Lists every author_note (developer-added steps) so a human can review them.

It cannot judge whether the Thai wording means the same as the English text. For that use review.html:
page image next to the chunk and graph text.

Usage
  pip install pymupdf
  python verify_chunks.py --chunks manual_x.json --pdf manual.pdf [--graphs graphs.json]
                          [--offset 0] [--window 2] [--no-ocr] [--out verify_out]

  --offset   pdf_page = printed_page + offset   (default 0)
  Exit code 1 if any chunk or graph check FAILs, else 0.
"""
import argparse
import base64
import html
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

try:
    import pymupdf
except ImportError:  # older PyMuPDF
    import fitz as pymupdf

# ---- thresholds (tune here) -------------------------------------------------
MIN_TEXT_CHARS = 150      # fewer characters on a page -> treat the page as an image and OCR it
PASS_SCORE = 0.60         # chunk trigram coverage needed for OK
REWORD_WORDS = 0.75       # weak step whose words are mostly on the page = reworded; below = not found
UNIT_MIN = 0.35           # a single step below this is listed as weak
BETTER_PAGE_DELTA = 0.10  # another page must beat the cited page by this much to be flagged

LIG = str.maketrans({"ﬁ": "fi", "ﬂ": "fl", "’": "'", "‘": "'", "“": '"',
                     "”": '"', "–": "-", "—": "-", " ": " "})
NUM_RE = re.compile(r"\d+(?:\.\d+)?")
CITE_RE = re.compile(r"(?:คู่มือ)?หน้า\s*(\d+(?:\s*(?:[–\-,]|และ)\s*\d+)*)")
EN_CITE_RE = re.compile(r"\(\s*pages?\s*\d+(?:\s*[-–,]\s*\d+)*\s*\)", re.I)


def words(s):
    return re.findall(r"[a-z0-9]+", s.translate(LIG).lower())


def trigrams(w):
    return set(zip(w, w[1:], w[2:]))


# ---------------------------------------------------------------- PDF access
class PageText:
    def __init__(self, text, method):
        self.text, self.method = text, method
        self.words = words(text)
        self.wordset = set(self.words)
        self.tri = trigrams(self.words)
        self.nums = set(NUM_RE.findall(text))


class Source:
    def __init__(self, pdf, cache_dir, use_ocr):
        self.doc = pymupdf.open(pdf)
        self.n = len(self.doc)
        self.cache_dir = cache_dir
        self.stem = Path(pdf).stem[:40]
        self.tess = shutil.which("tesseract") if use_ocr else None
        self.use_ocr = use_ocr
        self._pages = {}
        self._warned = False

    def _ocr(self, p):
        cache = self.cache_dir / f"{self.stem}_p{p}.txt"
        if cache.exists():
            return cache.read_text(encoding="utf-8")
        if not self.tess:
            if self.use_ocr and not self._warned:
                print("  ! tesseract not found: image pages are skipped (install it or pass --no-ocr)")
                self._warned = True
            return ""
        png = self.cache_dir / f"{self.stem}_p{p}.png"
        self.doc[p - 1].get_pixmap(dpi=220).save(str(png))
        print(f"  OCR page {p} ...")
        r = subprocess.run([self.tess, str(png), "stdout", "-l", "eng", "--psm", "3"],
                           capture_output=True, text=True, encoding="utf-8", errors="ignore")
        png.unlink(missing_ok=True)
        cache.write_text(r.stdout, encoding="utf-8")
        return r.stdout

    def page(self, p):
        if p not in self._pages:
            if not 1 <= p <= self.n:
                self._pages[p] = PageText("", "missing")
            else:
                t = self.doc[p - 1].get_text()
                if len(t.strip()) >= MIN_TEXT_CHARS:
                    self._pages[p] = PageText(t, "text")
                else:
                    o = self._ocr(p) if self.use_ocr else ""
                    self._pages[p] = PageText(o, "ocr") if o.strip() else PageText(t, "none")
        return self._pages[p]

    def png_b64(self, p, dpi=100):
        return base64.b64encode(self.doc[p - 1].get_pixmap(dpi=dpi).tobytes("png")).decode()


# ---------------------------------------------------------------- chunk checks
def units_of(chunk):
    md = chunk["metadata"]
    out = [("symptom", md["symptom"])]
    for line in md["solution"].split("\n"):
        line = re.sub(r"^\s*\d+\.\s*", "", line).strip()
        if line:
            out.append(("step", line))
    return out


def unit_cov(text, page):
    """(trigram coverage, word count, word coverage). Short texts use word coverage for both."""
    w = words(text)
    wc = sum(x in page.wordset for x in w) / max(len(w), 1)
    if len(w) < 3:
        return wc, len(w), wc
    t = trigrams(w)
    return len(t & page.tri) / len(t), len(w), wc


def chunk_score(chunk, page):
    rows, tot, acc = [], 0, 0.0
    for kind, text in units_of(chunk):
        c, n, wc = unit_cov(text, page)
        rows.append({"kind": kind, "text": text, "cov": c, "wcov": wc})
        acc += c * n
        tot += n
    return (acc / tot if tot else 0.0), rows


def pages_cited_in_text(chunk):
    """Pages the chunk text itself points to, e.g. '(pages 30-31)' -> [30, 31]."""
    md = chunk["metadata"]
    txt = " ".join([md["symptom"], md.get("possible_cause") or "", md["solution"]])
    out = []
    for m in EN_CITE_RE.finditer(txt):
        nums = [int(x) for x in NUM_RE.findall(m.group(0))]
        if len(nums) == 2 and "-" in m.group(0).replace("\u2013", "-"):
            out += list(range(nums[0], nums[1] + 1))
        else:
            out += nums
    return out


def chunk_numbers(chunk):
    md = chunk["metadata"]
    parts = [md["symptom"], md.get("possible_cause") or ""]
    parts += [re.sub(r"^\s*\d+\.\s*", "", l) for l in md["solution"].split("\n")]
    nums = set()
    for p in parts:
        nums |= set(NUM_RE.findall(EN_CITE_RE.sub("", p)))
    return nums


def check_chunk(chunk, src, offset, window):
    printed = chunk["page"]
    exp = printed + offset
    pg = src.page(exp)
    res = {"chunk_id": chunk["chunk_id"], "printed": printed, "pdf_page": exp, "method": pg.method,
           "flags": [], "status": "OK", "score": None, "units": [], "missing_nums": [], "best_page": exp,
           "cause_cov": None}
    if pg.method in ("none", "missing"):
        res["status"] = "SKIP"
        res["flags"].append("no readable text on the cited page (image page and no OCR)")
        return res
    score, rows = chunk_score(chunk, pg)
    res["score"], res["units"] = score, rows
    cause = chunk["metadata"].get("possible_cause")
    if cause:
        res["cause_cov"] = unit_cov(cause, pg)[0]
    weak = [r for r in rows if r["cov"] < UNIT_MIN]
    nf = [r for r in weak if r["wcov"] < REWORD_WORDS]
    rw = [r for r in weak if r["wcov"] >= REWORD_WORDS]
    if nf:
        res["flags"].append(f"{len(nf)} step(s) NOT FOUND on the page (added by developer or wrong page?)")
    if rw:
        res["flags"].append(f"{len(rw)} step(s) reworded (words on page, order differs)")
    if score < PASS_SCORE:
        res["flags"].append(f"low coverage {score:.2f} < {PASS_SCORE}")
    miss = sorted(n for n in chunk_numbers(chunk) if n not in pg.nums)
    extra = [p + offset for p in pages_cited_in_text(chunk) if 1 <= p + offset <= src.n and p + offset != exp]
    if miss and extra:
        pool = set().union(*(src.page(p).nums for p in extra))
        found_elsewhere = [n for n in miss if n in pool]
        if found_elsewhere:
            res["flags"].append("numbers " + ", ".join(found_elsewhere) +
                                " are not on the cited page but are on a page the chunk text cites (verify the page field)")
        miss = [n for n in miss if n not in pool]
    res["missing_nums"] = miss
    # other pages near the cited one
    best, best_s = exp, score
    for p in range(max(1, exp - window), min(src.n, exp + window) + 1):
        if p == exp:
            continue
        o = src.page(p)
        if o.method in ("none", "missing"):
            continue
        s, _ = chunk_score(chunk, o)
        if s > best_s:
            best, best_s = p, s
    res["best_page"] = best
    if best != exp and best_s >= score + BETTER_PAGE_DELTA:
        res["flags"].append(f"better match on pdf page {best} ({best_s:.2f} vs {score:.2f}): wrong page number?")
        res["status"] = "FAIL"
    if miss:
        res["flags"].append("numbers not found on the page: " + ", ".join(miss))
        res["status"] = "FAIL"  # chunk text is quoted from the manual, so a missing number is an error
    if res["status"] == "OK" and res["flags"]:
        res["status"] = "REVIEW"
    return res


# ---------------------------------------------------------------- graph checks
def node_texts(n):
    return [n[k] for k in ("content", "question", "safety_warning") if n.get(k)]


def check_graph(g, chunks, src, offset):
    res = {"graph_id": g["graph_id"], "flags": [], "fails": [], "notes": [], "status": "OK", "nodes_checked": 0}
    ch = chunks.get(g.get("source_chunk_id"))
    if not ch:
        res["fails"].append(f"source_chunk_id {g.get('source_chunk_id')} not found in chunk file")
        res["status"] = "FAIL"
        return res
    md = ch["metadata"]
    for gk, ck in (("model_pattern", "model"), ("source", "source"), ("severity", None), ("difficulty", None)):
        a = g.get(gk)
        b = ch.get(ck) if ck else md.get(gk)
        if a != b:
            res["fails"].append(f"{gk} differs: graph={a!r} chunk={b!r}")
    lo, hi = g["page_range"]
    if not lo <= ch["page"] <= hi:
        res["fails"].append(f"chunk page {ch['page']} outside graph page_range {g['page_range']}")
    base = ch["page"]
    for n in g["nodes"]:
        if n.get("author_note"):
            res["notes"].append((n["node_id"], n["author_note"]))
        for text in node_texts(n):
            cited = []
            for m in CITE_RE.finditer(text):
                cited += [int(x) for x in NUM_RE.findall(m.group(1))]
            for c in cited:
                if not 1 <= c + offset <= src.n:
                    res["fails"].append(f"node {n['node_id']}: cites page {c}, outside the PDF")
            pages = {base} | {c for c in cited if 1 <= c + offset <= src.n}
            nums = set(NUM_RE.findall(CITE_RE.sub("", text)))
            if not nums:
                continue
            res["nodes_checked"] += 1
            pgs = [src.page(p + offset) for p in pages]
            readable = [p for p in pgs if p.method in ("text", "ocr")]
            if not readable:
                res["flags"].append(f"node {n['node_id']}: numbers {sorted(nums)} not checked (no readable page)")
                continue
            have = set().union(*(p.nums for p in readable))
            miss = sorted(nums - have)
            if miss:
                kind = "fails" if all(p.method == "text" for p in readable) else "flags"
                res[kind].append(f"node {n['node_id']}: numbers {miss} not found on cited page(s) "
                                 f"{sorted(pages)}" + ("" if kind == "fails" else " (OCR text; verify by eye)"))
    res["status"] = "FAIL" if res["fails"] else ("REVIEW" if res["flags"] else "OK")
    return res


# ---------------------------------------------------------------- reports
ORDER = ["OK", "SKIP", "REVIEW", "FAIL"]


def write_md(path, args, chunk_res, graph_res, offset):
    L = [f"# Verification report", "",
         f"- chunks: `{args.chunks}`", f"- pdf: `{args.pdf}` (pdf_page = printed_page + {offset})",
         f"- graphs: `{args.graphs or '-'}`", ""]
    L += ["## Chunks vs manual", "", "| chunk | page | text source | coverage | status | notes |", "|---|---|---|---|---|---|"]
    for r in chunk_res:
        sc = "-" if r["score"] is None else f"{r['score']:.2f}"
        L.append(f"| {r['chunk_id'].split('_', 3)[-1]} | {r['printed']} | {r['method']} | {sc} | **{r['status']}** | "
                 f"{'; '.join(r['flags']) or ''} |")
    weak = [(r, u) for r in chunk_res for u in r["units"] if u["cov"] < UNIT_MIN]
    if weak:
        L += ["", "### Weak steps", "", "NOT FOUND = most words are absent from the page; reworded = words present, order differs.", ""]
        for r, u in weak:
            tag = "NOT FOUND" if u["wcov"] < REWORD_WORDS else "reworded"
            L.append(f"- [{tag}] `{r['chunk_id'].split('_', 3)[-1]}` (trigram {u['cov']:.2f}, words {u['wcov']:.2f}): {u['text']}")
    if graph_res:
        L += ["", "## Graphs", "", "| graph | nodes with numbers | status | notes |", "|---|---|---|---|"]
        for g in graph_res:
            L.append(f"| {g['graph_id']} | {g['nodes_checked']} | **{g['status']}** | "
                     f"{'; '.join(g['fails'] + g['flags'])} |")
        L += ["", "## Developer-added content (author_note) - needs human review", ""]
        for g in graph_res:
            for nid, note in g["notes"]:
                L.append(f"- `{g['graph_id']}` / `{nid}`: {note}")
    path.write_text("\n".join(L) + "\n", encoding="utf-8")


def write_html(path, chunks, chunk_res, graphs, graph_res, src):
    e = html.escape
    gmap = {g["source_chunk_id"]: g for g in graphs}
    out = ["<!doctype html><meta charset='utf-8'><title>Chunk review</title><style>"
           "body{font:14px/1.5 system-ui,sans-serif;margin:16px;background:#f6f6f6}"
           ".card{background:#fff;border:1px solid #ccc;border-radius:8px;margin:0 0 24px;padding:12px}"
           ".grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px}"
           "img{max-width:100%;border:1px solid #bbb}.OK{color:#176f2c}.REVIEW{color:#a15c00}.FAIL{color:#b00020}.SKIP{color:#666}"
           ".weak{background:#fff0c2}.note{background:#e8f0ff;padding:2px 6px;border-radius:4px;display:block;margin:2px 0}"
           "code{background:#eee;padding:0 3px}@media(max-width:800px){.grid{grid-template-columns:1fr}}"
           "</style><h1>Chunk review sheet</h1><p>Tick each card after comparing the page image with the chunk and graph text.</p>"]
    for r in chunk_res:
        c = chunks[r["chunk_id"]]
        md = c["metadata"]
        out.append(f"<div class='card'><h2><input type='checkbox'> {e(r['chunk_id'])} "
                   f"<span class='{r['status']}'>{r['status']}</span></h2><div class='grid'><div>")
        out.append(f"<p>printed page {r['printed']} (pdf page {r['pdf_page']}, text source: {r['method']})</p>")
        if 1 <= r["pdf_page"] <= src.n:
            out.append(f"<img src='data:image/png;base64,{src.png_b64(r['pdf_page'])}'>")
        out.append("</div><div>")
        out.append(f"<p><b>Symptom:</b> {e(md['symptom'])}</p>")
        out.append(f"<p><b>Possible cause:</b> {e(md.get('possible_cause') or '-')}</p><p><b>Solution:</b></p><ol>")
        covs = {u['text']: u['cov'] for u in r["units"]}
        for line in md["solution"].split("\n"):
            t = re.sub(r"^\s*\d+\.\s*", "", line).strip()
            cv = covs.get(t)
            cls = " class='weak'" if cv is not None and cv < UNIT_MIN else ""
            out.append(f"<li{cls}>{e(t)}" + (f" <small>({cv:.2f})</small>" if cv is not None else "") + "</li>")
        out.append("</ol>")
        out.append(f"<p><b>Safety warning:</b> {e(md.get('safety_warning') or '-')}</p>")
        if r["flags"]:
            out.append("<p class='FAIL'>" + "<br>".join(e(f) for f in r["flags"]) + "</p>")
        g = gmap.get(r["chunk_id"])
        if g:
            out.append(f"<details><summary>Graph {e(g['graph_id'])} ({len(g['nodes'])} nodes)</summary>")
            for n in g["nodes"]:
                body = "<br>".join(e(t) for t in node_texts(n))
                out.append(f"<p><code>{e(n['node_id'])}</code> <small>{e(n['type'])}</small> {body}")
                if n.get("author_note"):
                    out.append(f"<span class='note'>author_note: {e(n['author_note'])}</span>")
                out.append("</p>")
            out.append("</details>")
        out.append("</div></div></div>")
    path.write_text("".join(out), encoding="utf-8")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--chunks", required=True)
    ap.add_argument("--pdf", required=True)
    ap.add_argument("--graphs")
    ap.add_argument("--offset", type=int, default=0)
    ap.add_argument("--window", type=int, default=2)
    ap.add_argument("--no-ocr", action="store_true")
    ap.add_argument("--out", default="verify_out")
    args = ap.parse_args()

    out = Path(args.out)
    (out / "ocr_cache").mkdir(parents=True, exist_ok=True)
    chunk_list = json.loads(Path(args.chunks).read_text(encoding="utf-8"))
    chunks = {c["chunk_id"]: c for c in chunk_list}
    graphs = []
    if args.graphs:
        graphs = json.loads(Path(args.graphs).read_text(encoding="utf-8"))["graphs"]
    src = Source(args.pdf, out / "ocr_cache", not args.no_ocr)

    chunk_res = [check_chunk(c, src, args.offset, args.window) for c in chunk_list]
    graph_res = [check_graph(g, chunks, src, args.offset) for g in graphs]
    used = {g["source_chunk_id"] for g in graphs}
    if graphs:
        for cid in chunks:
            if cid not in used:
                print(f"  note: chunk {cid} has no graph")

    write_md(out / "report.md", args, chunk_res, graph_res, args.offset)
    write_html(out / "review.html", chunks, chunk_res, graphs, graph_res, src)

    cnt = {s: 0 for s in ORDER}
    for r in chunk_res:
        cnt[r["status"]] += 1
    print("\nChunks: " + ", ".join(f"{k}={v}" for k, v in cnt.items()))
    for r in chunk_res:
        sc = "  -  " if r["score"] is None else f"{r['score']:.2f}"
        print(f"  {r['status']:6s} {sc} p{r['printed']:<3d} [{r['method']}] {r['chunk_id'].split('_', 3)[-1]}"
              + (f"   <- {'; '.join(r['flags'])}" if r["flags"] else ""))
    if graph_res:
        gc = {s: 0 for s in ORDER}
        for g in graph_res:
            gc[g["status"]] += 1
        print("Graphs: " + ", ".join(f"{k}={v}" for k, v in gc.items()))
        for g in graph_res:
            if g["fails"] or g["flags"]:
                print(f"  {g['status']:6s} {g['graph_id']}: " + "; ".join(g["fails"] + g["flags"]))
        print(f"author_notes to review: {sum(len(g['notes']) for g in graph_res)}")
    print(f"\nreport: {out / 'report.md'}\nreview sheet: {out / 'review.html'}")
    bad = cnt["FAIL"] or any(g["status"] == "FAIL" for g in graph_res)
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()