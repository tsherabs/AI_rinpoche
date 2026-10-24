"""
Retrieval + generation (same logic as chunking/rag_answer.py, adapted for the API).

generate_answer(question, history) -> (content, sources, is_fallback)
  - sources use the Source field names from api-contract.md section 4.3
  - raises LLMUnavailableError when Ollama cannot be reached

Set USE_MOCK_RAG=true in backend/.env to return fake answers without loading
any model - useful for frontend development.

Vector database:
  CHROMA_HOST set   -> ChromaDB server over HTTP (e.g. Docker on another laptop)
  CHROMA_HOST empty -> local vectordb/ folder (DB_DIR)
The question is always embedded here in the backend; ChromaDB only stores and searches vectors.
"""

import json
import logging
import re
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import List, Optional, Tuple

from . import config

logger = logging.getLogger("ai_rinpoche")

QUERY_PREFIX = "Represent this sentence for searching relevant passages: "   # bge v1.5 query instruction

SYSTEM_PROMPT = f"""You are AI Rinpoche, an assistant that helps people explore the documented teachings of Shechen Rabjam Rinpoche.

Rules:
1. Answer ONLY from the numbered sources provided. Do not use outside knowledge about Buddhism.
2. Cite every claim with its source number in square brackets, e.g. [1] or [2][3]. Use each marker once per claim; do not start the answer with a marker.
3. When you use Rinpoche's exact words, put them in quotation marks. Otherwise make clear you are summarising ("Rinpoche explains that...").
4. Speak ABOUT Rinpoche's teachings in the third person. Never pretend to be Rinpoche.
5. If the sources do not contain the answer, reply exactly: "{config.FALLBACK_MESSAGE}"
6. Keep the answer clear and concise (about 80-200 words). Do not give personal spiritual instructions beyond what the sources say."""


class LLMUnavailableError(Exception):
    pass


def db_location() -> str:
    if config.CHROMA_HOST:
        scheme = "https" if config.CHROMA_SSL else "http"
        return f"{scheme}://{config.CHROMA_HOST}:{config.CHROMA_PORT}"
    return str(config.DB_DIR)


def make_chroma_client():
    """Remote ChromaDB server if CHROMA_HOST is set, otherwise the local vectordb/ folder."""
    import chromadb

    if not config.CHROMA_HOST:
        return chromadb.PersistentClient(path=str(config.DB_DIR))

    settings = None
    if config.CHROMA_TOKEN:
        from chromadb.config import Settings
        settings = Settings(chroma_client_auth_provider="chromadb.auth.token_authn.TokenAuthClientProvider",
                            chroma_client_auth_credentials=config.CHROMA_TOKEN)
    kwargs = {"host": config.CHROMA_HOST, "port": config.CHROMA_PORT, "ssl": config.CHROMA_SSL}
    if settings is not None:
        kwargs["settings"] = settings
    try:
        client = chromadb.HttpClient(**kwargs)
        client.heartbeat()                                   # fail fast with a clear message
    except Exception as e:
        raise RuntimeError(
            f"Cannot reach the ChromaDB server at {db_location()} ({e}). Check that the Docker container "
            f"is running on that laptop, the port is open in its firewall, and both laptops are on the same "
            f"network - or leave CHROMA_HOST empty in backend/.env to use the local vectordb folder."
        ) from e
    return client


class Retriever:
    """Loads the embedding model and ChromaDB collection once."""

    def __init__(self):
        from sentence_transformers import SentenceTransformer

        self.model = SentenceTransformer(config.EMBED_MODEL)
        client = make_chroma_client()
        try:
            self.collection = client.get_collection(config.COLLECTION_NAME)
        except Exception as e:
            names = [getattr(c, "name", c) for c in client.list_collections()]
            raise RuntimeError(
                f"Collection '{config.COLLECTION_NAME}' not found at {db_location()}. "
                f"Available collections: {names or 'none (the database is empty - run embed_passages.py build)'}. "
                f"Set COLLECTION_NAME in backend/.env to the right one."
            ) from e

    def search(self, question: str, k: int = config.TOP_K) -> List[dict]:
        vector = self.model.encode(QUERY_PREFIX + question, normalize_embeddings=True)
        res = self.collection.query(query_embeddings=[vector.tolist()], n_results=k,
                                    include=["documents", "metadatas", "distances"])
        return [{"id": pid, "text": doc, "meta": meta or {}, "score": 1 - dist}
                for pid, doc, meta, dist in zip(res["ids"][0], res["documents"][0],
                                                res["metadatas"][0], res["distances"][0])]

    def all_metadata(self) -> List[dict]:
        return self.collection.get(include=["metadatas"])["metadatas"] or []

    def count(self) -> int:
        return self.collection.count()


retriever: Optional[Retriever] = None


def init_rag() -> None:
    global retriever
    if config.USE_MOCK_RAG:
        logger.warning("USE_MOCK_RAG=true - answers are fake, no models loaded")
        return
    retriever = Retriever()
    logger.info("retriever ready: %d passages in '%s' (%s)",
                retriever.count(), config.COLLECTION_NAME, db_location())


# ---------- selection and formatting ----------

def select_sources(hits: List[dict]) -> List[dict]:
    """Passages good enough to send to the LLM, or [] for fallback."""
    if not hits or hits[0]["score"] < config.SIM_THRESHOLD:
        return []
    best = hits[0]["score"]
    return [h for h in hits if h["score"] >= max(config.SIM_THRESHOLD, best - config.KEEP_MARGIN)]


def to_source(number: int, hit: dict) -> dict:
    m = hit["meta"]
    quote = hit["text"][:config.QUOTE_LENGTH]
    if len(hit["text"]) > config.QUOTE_LENGTH:
        quote = quote.rsplit(" ", 1)[0] + "..."
    return {
        "source_number": number,
        "passage_id": hit["id"],
        "source_id": m.get("source_id", ""),
        "title": m.get("title", hit["id"]),
        "source_type": m.get("source_type", ""),
        "start": m.get("start") or None,
        "end": m.get("end") or None,
        "start_seconds": m.get("start_seconds"),
        "location": m.get("location") or None,
        "url": m.get("url", ""),
        "quote": quote,
        "score": round(float(hit["score"]), 3),
    }


def build_messages(question: str, sources: List[dict], history: List[Tuple[str, str]]) -> List[dict]:
    blocks = []
    for i, h in enumerate(sources, 1):
        m = h["meta"]
        block = f"[{i}] {m.get('title', '')} ({m.get('start') or m.get('location', '')})\n"
        if m.get("context_question"):
            block += f"Question asked: {m['context_question']}\n"
        blocks.append(block + f"Rinpoche: {h['text']}")
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for q, a in history[-config.HISTORY_TURNS:]:          # context for follow-ups, never used as sources
        messages += [{"role": "user", "content": q}, {"role": "assistant", "content": a}]
    messages.append({"role": "user", "content": "Sources:\n" + "\n\n".join(blocks) + f"\n\nQuestion: {question}"})
    return messages


def clean_citations(text: str) -> str:
    """Fix common small-model glitches: '[1] [1]' -> '[1]', a leading '[1]', '[1,2]' -> '[1][2]'."""
    text = re.sub(r"\[(\d+(?:\s*,\s*\d+)+)\]",
                  lambda m: "".join(f"[{n.strip()}]" for n in m.group(1).split(",")), text)
    text = re.sub(r"(\[\d+\])(\s*\1)+", r"\1", text)
    text = re.sub(r"^\s*(\[\d+\]\s*)+", "", text)
    return text.strip()


# ---------- LLM ----------

def ollama_chat(messages: List[dict]) -> str:
    body = json.dumps({"model": config.LLM_MODEL, "messages": messages, "stream": False,
                       "options": {"temperature": config.LLM_TEMPERATURE}}).encode("utf-8")
    req = urllib.request.Request(config.OLLAMA_URL, data=body, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=config.LLM_TIMEOUT_SECONDS) as r:
            return json.loads(r.read())["message"]["content"].strip()
    except (urllib.error.URLError, TimeoutError, KeyError, json.JSONDecodeError) as e:
        logger.error("LLM call failed: %s", e)
        raise LLMUnavailableError(str(e)) from e


def llm_available() -> bool:
    if config.USE_MOCK_RAG:
        return True
    tags_url = config.OLLAMA_URL.split("/api/")[0] + "/api/tags"
    try:
        with urllib.request.urlopen(tags_url, timeout=3) as r:
            names = {m.get("name", "") for m in json.loads(r.read()).get("models", [])}
        return any(n == config.LLM_MODEL or n.startswith(config.LLM_MODEL + ":") for n in names)
    except Exception:
        return False


# ---------- main entry point ----------

def generate_answer(question: str, history: List[Tuple[str, str]]) -> Tuple[str, List[dict], bool]:
    if config.USE_MOCK_RAG:
        return _mock_answer(question)

    hits = retriever.search(question)
    logger.info("retrieved: %s", ", ".join(f"{h['id']} {h['score']:.3f}" for h in hits))
    selected = select_sources(hits)
    if not selected:
        return config.FALLBACK_MESSAGE, [], True

    reply = clean_citations(ollama_chat(build_messages(question, selected, history)))
    if config.FALLBACK_MESSAGE[:40] in reply:            # model decided the sources don't answer it
        return config.FALLBACK_MESSAGE, [], True

    content, sources = merge_by_source(reply, selected)
    return content, sources, False


def _base_url(url: str) -> str:
    """Drop the YouTube '?t=' / '&t=' timestamp so one video always has one link."""
    return re.sub(r"([?&])t=\d+s?(&|$)", lambda m: m.group(1) if m.group(2) else "", url or "").rstrip("?&")


def merge_by_source(reply: str, selected: List[dict]) -> Tuple[str, List[dict]]:
    """
    Several passages can come from the same video. Show each video/document once:
      - passages are grouped by source_id (title if missing)
      - groups are numbered 1, 2, 3... in the order they are first cited
      - the [n] markers in the answer are rewritten to the new numbers
    Example: answer cites [4], [5], [3]; [5] and [3] are both "Teachings in Canada"
             -> [4] becomes [1], [5] and [3] become [2]; two sources are listed.
    """
    first_seen = []
    for match in re.finditer(r"\[(\d+)\]", reply):
        n = int(match.group(1))
        if 1 <= n <= len(selected) and n not in first_seen:
            first_seen.append(n)
    if not first_seen:                                   # model cited nothing: list everything it was given
        first_seen = list(range(1, len(selected) + 1))

    group_number, old_to_new, sources = {}, {}, []
    for old in first_seen:
        hit = selected[old - 1]
        key = hit["meta"].get("source_id") or hit["meta"].get("title") or hit["id"]
        if key not in group_number:
            group_number[key] = len(group_number) + 1
            source = to_source(group_number[key], hit)
            source["url"] = _base_url(source["url"])
            sources.append(source)
        else:                                            # keep the best score for the merged source
            existing = sources[group_number[key] - 1]
            existing["score"] = max(existing["score"], round(float(hit["score"]), 3))
        old_to_new[old] = group_number[key]

    def renumber(match):
        n = int(match.group(1))
        return f"[{old_to_new[n]}]" if n in old_to_new else ""   # drop markers pointing at nothing

    content = re.sub(r"\[(\d+)\]", renumber, reply)
    content = re.sub(r"(\[\d+\])(\s*\1)+", r"\1", content)      # "[2][2]" -> "[2]"
    content = re.sub(r"[ \t]+([.,;:!?])", r"\1", content)        # tidy spaces left by dropped markers
    return content.strip(), sources


# ---------- About page statistics ----------

def _seconds(hms: str) -> int:
    try:
        h, m, s = (int(x) for x in hms.split(":"))
        return h * 3600 + m * 60 + s
    except (AttributeError, ValueError):
        return 0


def corpus_stats() -> dict:
    if config.USE_MOCK_RAG or retriever is None:
        return {"source_count": 1, "passage_count": 3, "total_hours": 0.2,
                "languages": ["English"], "last_updated": None}
    metas = retriever.all_metadata()
    seconds = sum(max(0, _seconds(m.get("end", "")) - _seconds(m.get("start", ""))) for m in metas)
    last_updated = None                                   # unknown for a remote server
    if not config.CHROMA_HOST:
        db_file = config.DB_DIR / "chroma.sqlite3"
        if db_file.exists():
            last_updated = datetime.fromtimestamp(db_file.stat().st_mtime, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    return {
        "source_count": len({m.get("source_id") for m in metas if m.get("source_id")}),
        "passage_count": len(metas),
        "total_hours": round(seconds / 3600, 2),
        "languages": sorted({m.get("language", "English") for m in metas}),
        "last_updated": last_updated,
    }


def passage_count() -> int:
    if config.USE_MOCK_RAG or retriever is None:
        return 3
    return retriever.count()


# ---------- mock mode ----------

def _mock_answer(question: str) -> Tuple[str, List[dict], bool]:
    if "momo" in question.lower() or len(question.split()) < 2:
        return config.FALLBACK_MESSAGE, [], True
    hit = {"id": "PCP01_S001", "score": 0.73,
           "text": "Generally, what I think, generally in Buddhism, it doesn't have an expiry date. "
                   "It is made for sentient beings as long as we have suffering due to our negative emotions.",
           "meta": {"source_id": "PCP01", "title": "Prajna Café Podcast 1 with Shechen Rabjam Rinpoche",
                    "source_type": "interview", "start": "00:04:29", "end": "00:06:14",
                    "start_seconds": 269.12, "url": "https://prajnaonline.org/"}}
    content = ("(Mock answer) Rinpoche explains that Buddhism \"doesn't have an expiry date\" "
               "and remains relevant to every generation [1].")
    return content, [to_source(1, hit)], False
