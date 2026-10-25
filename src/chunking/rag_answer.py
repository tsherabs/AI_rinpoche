"""
AI Rinpoche - Step 4: retrieval-augmented answer generation with citations and fallback.

Pipeline for each question:
  1. embed the question (bge-small-en-v1.5, same model as embed_passages.py)
  2. retrieve the top-k passages from vectordb/
  3. if the best similarity is below SIM_THRESHOLD -> fallback answer (no LLM call)
  4. otherwise send question + numbered passages to a local LLM (Ollama)
  5. print the answer followed by the cited sources (title, timestamp, link)

Setup once:
  - install Ollama from https://ollama.com and pull a model, e.g.
        ollama pull qwen2.5:7b        (or: ollama pull llama3.1:8b)
    On a laptop without a good GPU use a smaller model: ollama pull qwen2.5:3b

Run from the project root with the venv active:
    python chunking\rag_answer.py "What does Rinpoche say about Vajrayana in the West?"
    python chunking\rag_answer.py chat          # interactive session with follow-up questions
"""

import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

import chromadb
from sentence_transformers import SentenceTransformer

ROOT = Path(__file__).resolve().parent.parent
DB_DIR = ROOT / "vectordb"
COLLECTION = "rinpoche_passages"

EMBED_MODEL = "BAAI/bge-small-en-v1.5"
QUERY_PREFIX = "Represent this sentence for searching relevant passages: "

LLM_MODEL = "qwen2.5:3b"          # change to "llama3.1:8b" or "qwen2.5:3b"
OLLAMA_URL = "http://localhost:11434/api/chat"
TEMPERATURE = 0.2                 # low = stays close to the sources

TOP_K = 5
SIM_THRESHOLD = 0.55              # below this best score -> fallback (calibrate with your test questions)
KEEP_MARGIN = 0.10                # also drop passages scoring much lower than the best one
HISTORY_TURNS = 2                 # previous Q&A turns kept for follow-up questions

FALLBACK = ("I could not find enough information in Shechen Rabjam Rinpoche's teachings "
            "in my collection to answer this question.")

SYSTEM_PROMPT = """You are AI Rinpoche, an assistant that helps people explore the documented teachings of Shechen Rabjam Rinpoche.

Rules:
1. Answer ONLY from the numbered sources provided. Do not use outside knowledge about Buddhism.
2. Cite every claim with its source number in square brackets, e.g. [1] or [2][3].
3. When you use Rinpoche's exact words, put them in quotation marks. Otherwise make clear you are summarising ("Rinpoche explains that...").
4. Speak ABOUT Rinpoche's teachings in the third person. Never pretend to be Rinpoche.
5. If the sources do not contain the answer, reply exactly: "%s"
6. Keep the answer clear and concise (about 80-200 words). Do not give personal spiritual instructions beyond what the sources say.""" % FALLBACK


# ---------- retrieval ----------

class Retriever:
    def __init__(self):
        self.model = SentenceTransformer(EMBED_MODEL)
        client = chromadb.PersistentClient(path=str(DB_DIR))
        self.collection = client.get_collection(COLLECTION)

    def search(self, question, k=TOP_K):
        q = self.model.encode(QUERY_PREFIX + question, normalize_embeddings=True)
        res = self.collection.query(query_embeddings=[q.tolist()], n_results=k,
                                    include=["documents", "metadatas", "distances"])
        hits = []
        for pid, doc, meta, dist in zip(res["ids"][0], res["documents"][0],
                                        res["metadatas"][0], res["distances"][0]):
            hits.append({"id": pid, "text": doc, "meta": meta, "score": 1 - dist})
        return hits


def select_sources(hits):
    """Return passages good enough to send to the LLM, or [] for fallback."""
    if not hits or hits[0]["score"] < SIM_THRESHOLD:
        return []
    best = hits[0]["score"]
    return [h for h in hits if h["score"] >= max(SIM_THRESHOLD, best - KEEP_MARGIN)]


def citation(h):
    m = h["meta"]
    where = f"{m.get('start')}-{m.get('end')}" if m.get("start") else m.get("location", "")
    link = f"  {m['url']}" if m.get("url") else ""
    return f"{m.get('title', h['id'])} [{where}]{link}"


# ---------- generation ----------

def ollama_chat(messages):
    body = json.dumps({"model": LLM_MODEL, "messages": messages, "stream": False,
                       "options": {"temperature": TEMPERATURE}}).encode("utf-8")
    req = urllib.request.Request(OLLAMA_URL, data=body, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=600) as r:
            return json.loads(r.read())["message"]["content"].strip()
    except urllib.error.URLError as e:
        sys.exit(f"Could not reach Ollama at {OLLAMA_URL} ({e}). Is Ollama running and is "
                 f"'{LLM_MODEL}' pulled? Try: ollama pull {LLM_MODEL}")


def build_messages(question, sources, history):
    context = "\n\n".join(
        f"[{i}] {h['meta'].get('title', '')} ({h['meta'].get('start', h['meta'].get('location', ''))})\n"
        + (f"Question asked: {h['meta']['context_question']}\n" if h["meta"].get("context_question") else "")
        + f"Rinpoche: {h['text']}"
        for i, h in enumerate(sources, 1))
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for q, a in history[-HISTORY_TURNS:]:             # earlier turns for follow-ups, not as sources
        messages += [{"role": "user", "content": q}, {"role": "assistant", "content": a}]
    messages.append({"role": "user", "content": f"Sources:\n{context}\n\nQuestion: {question}"})
    return messages


def answer(retriever, question, history=None, show_scores=True):
    history = history or []
    hits = retriever.search(question)
    sources = select_sources(hits)

    if show_scores:
        print("retrieved: " + ", ".join(f"{h['id']} {h['score']:.3f}" for h in hits))

    if not sources:
        return FALLBACK, []
    reply = ollama_chat(build_messages(question, sources, history))
    used = [(i, h) for i, h in enumerate(sources, 1) if f"[{i}]" in reply]
    return reply, used or list(enumerate(sources, 1))


def print_answer(reply, used):
    print(f"\n{reply}\n")
    if used:
        print("Sources:")
        for i, h in used:
            print(f"  [{i}] {citation(h)}")
    print()


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    retriever = Retriever()

    if sys.argv[1] != "chat":
        reply, used = answer(retriever, " ".join(sys.argv[1:]))
        print_answer(reply, used)
        return

    print("AI Rinpoche - type your question, or 'exit' to quit.\n")
    history = []
    while True:
        try:
            q = input("You: ").strip()
        except (EOFError, KeyboardInterrupt):
            break
        if not q:
            continue
        if q.lower() in {"exit", "quit"}:
            break
        reply, used = answer(retriever, q, history)
        print_answer(reply, used)
        history.append((q, reply))


if __name__ == "__main__":
    main()