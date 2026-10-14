"""
AI Rinpoche - segmentation and chunking.

Works with this layout:
    raw/
      <video folder>/
        source.json            metadata (source, language, url, verified, ...)
        <name>.json            WhisperX transcript (segments with start/end/text/speaker)
        <name>.srt/.vtt/.tsv/.txt
      <document>.txt           plain-text teachings (no timestamps)

Step A - see who is speaking in each video:
    python make_passages.py speakers

Step B - build the passages:
    python make_passages.py

Output: processed/passages.jsonl (one passage per line) + a corpus summary.

Fields to add to each source.json (only speaker_map is required for
multi-speaker videos; the rest improve citations):
    "source_id": "PCP01",
    "title": "Prajna Cafe Podcast 1 with Shechen Rabjam Rinpoche",
    "type": "interview",
    "date": "2023-01-01",
    "permission": "public",
    "speaker_map": {"SPEAKER_00": "Host", "SPEAKER_01": "Rinpoche"}
"""

import json
import re
import sys
from pathlib import Path

RAW_DIR = Path("raw")
OUTPUT = Path("processed/passages.jsonl")

RINPOCHE = "Rinpoche"   # label used for Rinpoche in speaker_map
TARGET_WORDS = 300      # close a passage once it reaches this length
MAX_WORDS = 400         # never let a passage grow beyond this
MIN_WORDS = 60          # short leftovers are merged into the previous passage
OVERLAP_SEGMENTS = 1    # segments repeated at the start of the next passage
MAX_QUESTION_WORDS = 80 # length limit for the stored host/interviewer question

TAGS = re.compile(r"\[(music|applause|laughter|inaudible|noise)\]|\((music|applause|laughter)\)", re.I)
FILLERS = re.compile(r"\b(um+|uh+|erm|hmm+)\b[,.]?\s*", re.I)
REPEATS = re.compile(r"\b(\w+)(\s+\1\b)+", re.I)


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
    """The WhisperX JSON is the .json file that is not source.json."""
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


# ---------- step A: inspect speakers ----------

def video_folders(only=None):
    folders = sorted(p for p in RAW_DIR.iterdir() if p.is_dir())
    if only:
        folders = [p for p in folders if p.name == only]
        if not folders:
            sys.exit(f"folder raw/{only} not found")
    return folders


def show_speakers(only=None):
    for folder in video_folders(only):
        tpath = find_transcript(folder)
        if not tpath:
            print(f"\n[{folder.name}] no transcript JSON found")
            continue
        segs = load_segments(tpath)
        print(f"\n[{folder.name}]")
        speakers = {}
        for s in segs:
            info = speakers.setdefault(s["speaker"], {"secs": 0.0, "samples": []})
            info["secs"] += s["end"] - s["start"]
            if len(info["samples"]) < 2 and wc(s["text"]) > 6:
                info["samples"].append(s["text"][:100])
        for spk, info in sorted(speakers.items(), key=lambda x: -x[1]["secs"]):
            print(f"  {spk}: {info['secs'] / 60:.1f} min")
            for sample in info["samples"]:
                print(f"      \"{sample}\"")


# ---------- step B: chunking ----------

def chunk_units(units, text_of):
    """Group units (segments or paragraphs) into ~TARGET_WORDS passages."""
    chunks, buf, words, new = [], [], 0, 0

    def flush():
        nonlocal buf, words, new
        chunks.append(buf)
        buf = buf[-OVERLAP_SEGMENTS:] if OVERLAP_SEGMENTS else []
        words = sum(wc(text_of(u)) for u in buf)
        new = 0

    for u in units:
        w = wc(text_of(u))
        if new and words + w > MAX_WORDS:
            flush()
        buf.append(u)
        words += w
        new += 1
        if words >= TARGET_WORDS:
            flush()
    if new:
        if chunks and sum(wc(text_of(u)) for u in buf) < MIN_WORDS:
            chunks[-1].extend(buf[-new:])
        else:
            chunks.append(buf)
    return chunks


def video_passages(folder, meta):
    tpath = find_transcript(folder)
    if not tpath:
        print(f"skip {folder.name}: no transcript JSON")
        return [], 0.0
    segs = load_segments(tpath)
    smap = meta.get("speaker_map") or {}
    single = not meta.get("diarization") or not smap

    # resolve speakers
    if not single:
        unknown = {s["speaker"] for s in segs} - set(smap)
        if unknown:
            print(f"  warning {folder.name}: unmapped speakers {sorted(map(str, unknown))} are excluded")
    for s in segs:
        s["speaker"] = RINPOCHE if single else smap.get(s["speaker"], "Unknown")

    # group consecutive segments by speaker
    runs = []
    for s in segs:
        if runs and runs[-1][0] == s["speaker"]:
            runs[-1][1].append(s)
        else:
            runs.append((s["speaker"], [s]))

    source_id = meta.get("source_id") or slug(folder.name)
    passages, question, rinpoche_secs = [], "", 0.0
    for speaker, run in runs:
        if speaker != RINPOCHE:
            question = " ".join(" ".join(s["text"] for s in run).split()[-MAX_QUESTION_WORDS:])
            continue
        rinpoche_secs += sum(s["end"] - s["start"] for s in run)
        for chunk in chunk_units(run, lambda s: s["text"]):
            start, end = chunk[0]["start"], chunk[-1]["end"]
            text = " ".join(s["text"] for s in chunk)
            passages.append({
                "passage_id": f"{source_id}_P{len(passages) + 1:03d}",
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
                "context_question": question,
                "text": text,
                "word_count": wc(text),
                "review_status": "auto",
            })
        question = ""
    return passages, rinpoche_secs


def document_passages(path):
    """Plain-text teachings: chunk by paragraph (or sentence if no blank lines)."""
    raw = path.read_text(encoding="utf-8")
    paras = [clean(p) for p in re.split(r"\n\s*\n", raw) if clean(p)]
    if len(paras) <= 1:
        paras = [clean(s) for s in re.split(r"(?<=[.!?])\s+", raw) if clean(s)]
    units = list(enumerate(paras, start=1))
    source_id = slug(path.stem)
    passages = []
    for chunk in chunk_units(units, lambda u: u[1]):
        text = " ".join(t for _, t in chunk)
        passages.append({
            "passage_id": f"{source_id}_P{len(passages) + 1:03d}",
            "source_id": source_id,
            "title": path.stem,
            "source_type": "document",
            "speaker": "Shechen Rabjam Rinpoche",
            "attribution": "rinpoche_own",
            "language": "English",
            "date": "",
            "location": f"paragraphs {chunk[0][0]}-{chunk[-1][0]}",
            "url": "",
            "context_question": "",
            "text": text,
            "word_count": wc(text),
            "review_status": "auto",
        })
    return passages


def build(only=None):
    output = OUTPUT.with_name(f"passages_{only}.jsonl") if only else OUTPUT
    output.parent.mkdir(parents=True, exist_ok=True)
    all_passages, total_secs = [], 0.0

    for folder in video_folders(only):
        meta_path = folder / "source.json"
        meta = json.loads(meta_path.read_text(encoding="utf-8")) if meta_path.exists() else {}
        if not meta.get("verified", False):
            print(f"skip {folder.name}: not verified")
            continue
        if str(meta.get("permission", "")).lower() in {"no", "pending"}:
            print(f"skip {folder.name}: permission {meta['permission']}")
            continue
        passages, secs = video_passages(folder, meta)
        all_passages += passages
        total_secs += secs
        print(f"{folder.name}: {len(passages)} passages")

    if not only:
        for doc in sorted(RAW_DIR.glob("*.txt")):
            passages = document_passages(doc)
            all_passages += passages
            print(f"{doc.name}: {len(passages)} passages (document)")

    with output.open("w", encoding="utf-8") as f:
        for p in all_passages:
            f.write(json.dumps(p, ensure_ascii=False) + "\n")

    counts = [p["word_count"] for p in all_passages] or [0]
    print("\n--- corpus summary ---")
    print(f"sources          : {len({p['source_id'] for p in all_passages})}")
    print(f"passages         : {len(all_passages)}")
    print(f"total words      : {sum(counts)}")
    print(f"words / passage  : min {min(counts)}, avg {sum(counts) // len(counts)}, max {max(counts)}")
    print(f"Rinpoche speech  : {total_secs / 3600:.2f} hours")
    print(f"written to       : {output}")


if __name__ == "__main__":
    # python make_passages.py speakers [folder]
    # python make_passages.py build [folder]
    mode = sys.argv[1] if len(sys.argv) > 1 else "build"
    only = sys.argv[2] if len(sys.argv) > 2 else None
    if mode == "speakers":
        show_speakers(only)
    else:
        build(only)