"""
AI Rinpoche - semantic chunking.

Splits Rinpoche's speech where the topic changes, using sentence embeddings,
while keeping the same safeguards as make_passages.py:
  - only segments mapped to "Rinpoche" in source.json -> speaker_map are used
  - chunks never cross a speaker turn (one answer is never mixed with another)
  - timestamps and URL are kept for citation

How it works:
  1. Each Rinpoche segment becomes a unit (long segments are split into sentences).
  2. Each unit is embedded together with its neighbours (a small window smooths noise).
  3. The cosine distance between neighbouring units is computed.
  4. A new chunk starts where the distance is in the top (100 - PERCENTILE)% for that video.
  5. Chunks shorter than MIN_WORDS are merged with their most similar neighbour;
     chunks longer than MAX_WORDS are split at their largest internal distance.

Install once:
    pip install sentence-transformers numpy

Run from the project root (the folder that contains raw/):
    python semantic_chunking.py prajna_cafe_podcast      # one video folder
    python semantic_chunking.py                          # all folders + raw/*.txt

Output: processed/passages_semantic[_<folder>].jsonl
"""

import json
import re
import sys
from pathlib import Path

import numpy as np
from sentence_transformers import SentenceTransformer

RAW_DIR = Path("raw")
OUT_DIR = Path("processed")

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"  # small and fast; units are short
RINPOCHE = "Rinpoche"
BUFFER = 1              # neighbours on each side combined when embedding a unit
PERCENTILE = 85         # higher -> fewer, longer chunks; lower -> more, shorter chunks
MIN_WORDS = 80          # merge chunks smaller than this
MAX_WORDS = 450         # split chunks larger than this
MAX_UNIT_WORDS = 40     # segments longer than this are split into sentences
MAX_QUESTION_WORDS = 80

TAGS = re.compile(r"\[(music|applause|laughter|inaudible|noise)\]|\((music|applause|laughter)\)", re.I)
FILLERS = re.compile(r"\b(um+|uh+|erm|hmm+)\b[,.]?\s*", re.I)
REPEATS = re.compile(r"\b(\w+)(\s+\1\b)+", re.I)
SENTENCE_END = re.compile(r"(?<=[.!?])\s+")


# ---------- helpers ----------

def clean(text):
    text = TAGS.sub(" ", text)
    text = FILLERS.sub("", text)
    text = REPEATS.sub(r"\1", text)
    return re.sub(r"\s+", " ", text).strip()


def wc(text):
    return len(text.split())


def hms(seconds):
    s = int(seconds)
    return f"{s // 3600:02d}:{s % 3600 // 60:02d}:{s % 60:02d}"


def slug(name):
    return re.sub(r"[^A-Za-z0-9]+", "_", name).strip("_")[:40]


def timestamped_url(url, seconds):
    if url and ("youtube.com" in url or "youtu.be" in url):
        return f"{url}{'&' if '?' in url else '?'}t={int(seconds)}"
    return url or ""


def find_transcript(folder):
    files = [p for p in folder.glob("*.json") if p.name != "source.json"]
    return files[0] if files else None


def load_segments(path):
    data = json.loads(path.read_text(encoding="utf-8"))
    raw = data["segments"] if isinstance(data, dict) else data
    segs = []
    for s in raw:
        text = clean(s.get("text", ""))
        if text:
            segs.append({"start": float(s["start"]), "end": float(s["end"]),
                         "speaker": s.get("speaker"), "text": text})
    return segs


# ---------- semantic splitting ----------

def make_units(segments):
    """Turn segments into sentence-sized units, estimating times for split sentences."""
    units = []
    for seg in segments:
        if wc(seg["text"]) <= MAX_UNIT_WORDS:
            units.append(dict(seg))
            continue
        sentences = [s for s in SENTENCE_END.split(seg["text"]) if s.strip()]
        total = sum(wc(s) for s in sentences) or 1
        t, span = seg["start"], seg["end"] - seg["start"]
        for sentence in sentences:
            dur = span * wc(sentence) / total
            units.append({"start": t, "end": t + dur, "text": sentence})
            t += dur
    return units


def distances(model, units):
    """Cosine distance between each unit and the next (length = len(units) - 1)."""
    if len(units) < 2:
        return np.array([])
    windows = [" ".join(u["text"] for u in units[max(0, i - BUFFER): i + BUFFER + 1])
               for i in range(len(units))]
    emb = model.encode(windows, normalize_embeddings=True, show_progress_bar=False)
    return 1 - np.sum(emb[:-1] * emb[1:], axis=1)


def words_in(units, s, e):
    return sum(wc(units[i]["text"]) for i in range(s, e + 1))


def split_at_threshold(n, d, threshold):
    ranges, start = [], 0
    for i, dist in enumerate(d):
        if dist > threshold:
            ranges.append((start, i))
            start = i + 1
    ranges.append((start, n - 1))
    return ranges


def merge_small(units, d, ranges):
    ranges = list(ranges)
    changed = True
    while changed and len(ranges) > 1:
        changed = False
        for k, (s, e) in enumerate(ranges):
            if words_in(units, s, e) >= MIN_WORDS:
                continue
            left = d[ranges[k - 1][1]] if k > 0 else None           # gap to previous chunk
            right = d[e] if k < len(ranges) - 1 else None           # gap to next chunk
            if right is None or (left is not None and left <= right):
                ranges[k - 1] = (ranges[k - 1][0], e)
                del ranges[k]
            else:
                ranges[k] = (s, ranges[k + 1][1])
                del ranges[k + 1]
            changed = True
            break
    return ranges


def split_large(units, d, s, e):
    if s == e or words_in(units, s, e) <= MAX_WORDS:
        return [(s, e)]
    j = max(range(s, e), key=lambda i: d[i])                        # biggest topic shift inside
    return split_large(units, d, s, j) + split_large(units, d, j + 1, e)


def semantic_ranges(units, d, threshold):
    if len(units) == 1:
        return [(0, 0)]
    ranges = split_at_threshold(len(units), d, threshold)
    ranges = merge_small(units, d, ranges)
    final = []
    for s, e in ranges:
        final += split_large(units, d, s, e)
    return final


# ---------- sources ----------

def video_passages(model, folder, meta):
    tpath = find_transcript(folder)
    if not tpath:
        print(f"skip {folder.name}: no transcript JSON")
        return [], 0.0

    segs = load_segments(tpath)
    smap = meta.get("speaker_map") or {}
    single = not meta.get("diarization") or not smap
    if not single:
        unknown = {s["speaker"] for s in segs} - set(smap)
        if unknown:
            print(f"  warning {folder.name}: unmapped speakers {sorted(map(str, unknown))} are excluded")
    for s in segs:
        s["speaker"] = RINPOCHE if single else smap.get(s["speaker"], "Unknown")

    runs = []
    for s in segs:
        if runs and runs[-1][0] == s["speaker"]:
            runs[-1][1].append(s)
        else:
            runs.append((s["speaker"], [s]))

    # pass 1: units and distances for every Rinpoche answer
    prepared, question = [], ""
    for speaker, run in runs:
        if speaker != RINPOCHE:
            question = " ".join(" ".join(s["text"] for s in run).split()[-MAX_QUESTION_WORDS:])
            continue
        units = make_units(run)
        prepared.append((units, distances(model, units), question))
        question = ""

    # one threshold per video, from all its distances
    all_d = np.concatenate([d for _, d, _ in prepared if len(d)]) if prepared else np.array([])
    threshold = float(np.percentile(all_d, PERCENTILE)) if len(all_d) else float("inf")

    # pass 2: build passages
    source_id = meta.get("source_id") or slug(folder.name)
    passages, secs = [], 0.0
    for units, d, q in prepared:
        secs += sum(u["end"] - u["start"] for u in units)
        for s, e in semantic_ranges(units, d, threshold):
            text = " ".join(units[i]["text"] for i in range(s, e + 1))
            start, end = units[s]["start"], units[e]["end"]
            passages.append({
                "passage_id": f"{source_id}_S{len(passages) + 1:03d}",
                "source_id": source_id,
                "title": meta.get("title") or meta.get("source") or folder.name,
                "source_type": meta.get("type", "video"),
                "speaker": "Shechen Rabjam Rinpoche",
                "attribution": "rinpoche_own",
                "language": meta.get("language", "English"),
                "date": meta.get("date", ""),
                "start": hms(start),
                "end": hms(end),
                "start_seconds": round(start, 2),
                "url": timestamped_url(meta.get("url", ""), start),
                "context_question": q,
                "text": text,
                "word_count": wc(text),
                "chunking_method": "semantic",
                "review_status": "auto",
            })
    return passages, secs


def document_passages(model, path):
    raw = path.read_text(encoding="utf-8")
    sentences = [clean(s) for s in SENTENCE_END.split(raw) if clean(s)]
    units = [{"text": s} for s in sentences]
    if not units:
        return []
    d = distances(model, units)
    threshold = float(np.percentile(d, PERCENTILE)) if len(d) else float("inf")
    source_id = slug(path.stem)
    passages = []
    for s, e in semantic_ranges(units, d, threshold):
        text = " ".join(units[i]["text"] for i in range(s, e + 1))
        passages.append({
            "passage_id": f"{source_id}_S{len(passages) + 1:03d}",
            "source_id": source_id,
            "title": path.stem,
            "source_type": "document",
            "speaker": "Shechen Rabjam Rinpoche",
            "attribution": "rinpoche_own",
            "language": "English",
            "date": "",
            "location": f"sentences {s + 1}-{e + 1}",
            "url": "",
            "context_question": "",
            "text": text,
            "word_count": wc(text),
            "chunking_method": "semantic",
            "review_status": "auto",
        })
    return passages


def main(only=None):
    folders = sorted(p for p in RAW_DIR.iterdir() if p.is_dir())
    if only:
        folders = [p for p in folders if p.name == only]
        if not folders:
            sys.exit(f"folder raw/{only} not found (run this from the folder that contains raw/)")

    print(f"loading embedding model {MODEL_NAME} ...")
    model = SentenceTransformer(MODEL_NAME)

    all_passages, total_secs = [], 0.0
    for folder in folders:
        meta_path = folder / "source.json"
        meta = json.loads(meta_path.read_text(encoding="utf-8")) if meta_path.exists() else {}
        if not meta.get("verified", False):
            print(f"skip {folder.name}: not verified")
            continue
        if str(meta.get("permission", "")).lower() in {"no", "pending"}:
            print(f"skip {folder.name}: permission {meta['permission']}")
            continue
        passages, secs = video_passages(model, folder, meta)
        all_passages += passages
        total_secs += secs
        print(f"{folder.name}: {len(passages)} passages")

    if not only:
        for doc in sorted(RAW_DIR.glob("*.txt")):
            passages = document_passages(model, doc)
            all_passages += passages
            print(f"{doc.name}: {len(passages)} passages (document)")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    output = OUT_DIR / (f"passages_semantic_{only}.jsonl" if only else "passages_semantic.jsonl")
    with output.open("w", encoding="utf-8") as f:
        for p in all_passages:
            f.write(json.dumps(p, ensure_ascii=False) + "\n")

    counts = [p["word_count"] for p in all_passages] or [0]
    print("\n--- semantic chunking summary ---")
    print(f"passages         : {len(all_passages)}")
    print(f"total words      : {sum(counts)}")
    print(f"words / passage  : min {min(counts)}, avg {sum(counts) // len(counts)}, max {max(counts)}")
    print(f"Rinpoche speech  : {total_secs / 3600:.2f} hours")
    print(f"written to       : {output}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else None)