"""
AI Rinpoche - Step 3: embed passages and store them in a vector database (ChromaDB).

Install once:
    py -3.14 -m pip install chromadb

Build the vector database (default: every processed/passages_semantic*.jsonl):
    py -3.14 chunking\embed_passages.py build
    py -3.14 chunking\embed_passages.py build processed\passages_semantic_prajna_cafe_podcast.jsonl

Test retrieval:
    py -3.14 chunking\embed_passages.py query "What does Rinpoche say about Vajrayana in the West?"
    py -3.14 chunking\embed_passages.py query "Who was Chokyi Lodro?" 3

The database is saved in vectordb/ and reloaded automatically next time.
"""

import json
import sys
from pathlib import Path

import chromadb
from sentence_transformers import SentenceTransformer

ROOT = Path(__file__).resolve().parent.parent          # script lives in chunking/
PROCESSED = ROOT / "processed"
DB_DIR = ROOT / "vectordb"

MODEL_NAME = "BAAI/bge-small-en-v1.5"                   # 512-token input, 384-dim vectors
COLLECTION = "rinpoche_passages"
QUERY_PREFIX = "Represent this sentence for searching relevant passages: "  # bge v1.5 query instruction
BATCH_SIZE = 32
METADATA_FIELDS = ["source_id", "title", "source_type", "speaker", "attribution", "language",
                   "date", "start", "end", "start_seconds", "url", "location",
                   "context_question", "word_count", "chunking_method", "review_status"]


def load_passages(files):
    passages = []
    for path in files:
        with open(path, encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    p = json.loads(line)
                    if p.get("review_status") != "excluded":
                        passages.append(p)
        print(f"loaded {path.name}")
    ids = [p["passage_id"] for p in passages]
    if len(ids) != len(set(ids)):
        sys.exit("duplicate passage_id found - did you include both structural and semantic files?")
    return passages


def text_to_embed(p):
    """Embed the host's question with the answer so user questions match it better.
    Only p['text'] (Rinpoche's words) is stored as the document shown to users."""
    q = p.get("context_question", "").strip()
    return f"Question: {q}\nAnswer: {p['text']}" if q else p["text"]


def clean_metadata(p):
    meta = {}
    for key in METADATA_FIELDS:
        value = p.get(key)
        if value is None or value == "":
            continue
        meta[key] = value if isinstance(value, (str, int, float, bool)) else str(value)
    return meta


def build(file_args):
    files = [Path(f) for f in file_args] if file_args else sorted(PROCESSED.glob("passages_semantic*.jsonl"))
    if not files:
        sys.exit(f"no passage files found in {PROCESSED}")
    passages = load_passages(files)
    print(f"{len(passages)} passages to embed")

    print(f"loading {MODEL_NAME} ...")
    model = SentenceTransformer(MODEL_NAME)
    embeddings = model.encode([text_to_embed(p) for p in passages], batch_size=BATCH_SIZE,
                              normalize_embeddings=True, show_progress_bar=True)

    truncated = sum(1 for p in passages if len(model.tokenizer(text_to_embed(p))["input_ids"]) > model.max_seq_length)
    if truncated:
        print(f"note: {truncated} passage(s) exceed {model.max_seq_length} tokens and were truncated")

    client = chromadb.PersistentClient(path=str(DB_DIR))
    try:
        client.delete_collection(COLLECTION)                # rebuild from scratch each time
    except Exception:
        pass
    collection = client.create_collection(COLLECTION, metadata={"hnsw:space": "cosine"})
    collection.add(
        ids=[p["passage_id"] for p in passages],
        embeddings=embeddings.tolist(),
        documents=[p["text"] for p in passages],
        metadatas=[clean_metadata(p) for p in passages],
    )
    print(f"stored {collection.count()} passages in {DB_DIR} (collection '{COLLECTION}')")


def query(question, k=5):
    client = chromadb.PersistentClient(path=str(DB_DIR))
    collection = client.get_collection(COLLECTION)
    model = SentenceTransformer(MODEL_NAME)
    q_emb = model.encode(QUERY_PREFIX + question, normalize_embeddings=True)

    res = collection.query(query_embeddings=[q_emb.tolist()], n_results=k,
                           include=["documents", "metadatas", "distances"])
    print(f"\nQ: {question}\n")
    for rank, (pid, doc, meta, dist) in enumerate(zip(res["ids"][0], res["documents"][0],
                                                        res["metadatas"][0], res["distances"][0]), 1):
        where = f"{meta.get('start', '')}-{meta.get('end', '')}" if meta.get("start") else meta.get("location", "")
        print(f"{rank}. {pid}   similarity {1 - dist:.3f}")
        print(f"   {meta.get('title', '')}  [{where}]")
        print(f"   {doc[:250]}{'...' if len(doc) > 250 else ''}\n")


if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] not in {"build", "query"}:
        sys.exit(__doc__)
    if sys.argv[1] == "build":
        build(sys.argv[2:])
    else:
        if len(sys.argv) < 3:
            sys.exit('usage: embed_passages.py query "your question" [k]')
        query(sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 5)