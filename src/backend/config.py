"""
Settings loaded from backend/.env (names from api-contract.md section 2).
Values in the real environment override the .env file.
"""

import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
ROOT_DIR = BACKEND_DIR.parent                      # project root (contains vectordb/, chunking/)


def _load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_env_file(BACKEND_DIR / ".env")


def _path(value: str) -> Path:
    p = Path(value)
    return p if p.is_absolute() else ROOT_DIR / p


def _bool(value: str) -> bool:
    return value.strip().lower() in {"1", "true", "yes", "on"}


# --- models ---
LLM_MODEL = os.getenv("LLM_MODEL", "qwen2.5:3b")
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434/api/chat")
EMBED_MODEL = os.getenv("EMBED_MODEL", "BAAI/bge-small-en-v1.5")
LLM_TEMPERATURE = float(os.getenv("LLM_TEMPERATURE", "0.2"))
LLM_TIMEOUT_SECONDS = int(os.getenv("LLM_TIMEOUT_SECONDS", "300"))

# --- retrieval ---
# CHROMA_HOST set   -> connect to a ChromaDB server (e.g. the Docker container on another laptop)
# CHROMA_HOST empty -> read the local vectordb/ folder (DB_DIR)
CHROMA_HOST = os.getenv("CHROMA_HOST", "").strip()
CHROMA_PORT = int(os.getenv("CHROMA_PORT", "8000"))
CHROMA_SSL = _bool(os.getenv("CHROMA_SSL", "false"))
CHROMA_TOKEN = os.getenv("CHROMA_TOKEN", "").strip()      # only if the server has token auth enabled
DB_DIR = _path(os.getenv("DB_DIR", "vectordb"))
COLLECTION_NAME = os.getenv("COLLECTION_NAME", "srr_bge_small_cls_v2")
TOP_K = int(os.getenv("TOP_K", "5"))
SIM_THRESHOLD = float(os.getenv("SIM_THRESHOLD", "0.55"))
KEEP_MARGIN = float(os.getenv("KEEP_MARGIN", "0.10"))
HISTORY_TURNS = int(os.getenv("HISTORY_TURNS", "2"))

# --- app ---
SESSIONS_DB = _path(os.getenv("SESSIONS_DB", "backend/sessions.db"))
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]
MAX_QUESTION_LENGTH = int(os.getenv("MAX_QUESTION_LENGTH", "1000"))
USE_MOCK_RAG = _bool(os.getenv("USE_MOCK_RAG", "false"))   # true = fake answers, no models needed

# --- shared constants (api-contract.md section 3) ---
SESSION_TITLE_LENGTH = 60
DEFAULT_SESSION_TITLE = "New chat"
ROLE_USER = "user"
ROLE_ASSISTANT = "assistant"
QUOTE_LENGTH = 200
FALLBACK_MESSAGE = ("I could not find enough information in Shechen Rabjam Rinpoche's teachings "
                    "in my collection to answer this question.")
