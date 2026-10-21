"""SQLite access for sessions and messages (api-contract.md section 7)."""

import json
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import List, Optional, Tuple

from . import config

SCHEMA = """
CREATE TABLE IF NOT EXISTS sessions (
    session_id  TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
    message_id        TEXT PRIMARY KEY,
    session_id        TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
    role              TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content           TEXT NOT NULL,
    sources_json      TEXT NOT NULL DEFAULT '[]',
    is_fallback       INTEGER NOT NULL DEFAULT 0,
    response_time_ms  INTEGER,
    created_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, created_at);
"""


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def new_id() -> str:
    return str(uuid.uuid4())


@contextmanager
def _connect():
    conn = sqlite3.connect(config.SESSIONS_DB)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    config.SESSIONS_DB.parent.mkdir(parents=True, exist_ok=True)
    with _connect() as conn:
        conn.executescript(SCHEMA)


# ---------- row -> dict (field names from api-contract.md section 4) ----------

def _session_dict(row: sqlite3.Row) -> dict:
    return {
        "session_id": row["session_id"],
        "title": row["title"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "message_count": row["message_count"],
    }


def _message_dict(row: sqlite3.Row) -> dict:
    return {
        "message_id": row["message_id"],
        "session_id": row["session_id"],
        "role": row["role"],
        "content": row["content"],
        "sources": json.loads(row["sources_json"] or "[]"),
        "is_fallback": bool(row["is_fallback"]),
        "response_time_ms": row["response_time_ms"],
        "created_at": row["created_at"],
    }


_SESSION_SELECT = """
SELECT s.session_id, s.title, s.created_at, s.updated_at,
       (SELECT COUNT(*) FROM messages m WHERE m.session_id = s.session_id) AS message_count
FROM sessions s
"""


# ---------- sessions ----------

def insert_session(title: str = config.DEFAULT_SESSION_TITLE) -> dict:
    session_id, ts = new_id(), now_iso()
    with _connect() as conn:
        conn.execute("INSERT INTO sessions (session_id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
                     (session_id, title, ts, ts))
    return fetch_session(session_id)


def fetch_sessions() -> List[dict]:
    with _connect() as conn:
        rows = conn.execute(_SESSION_SELECT + " ORDER BY s.updated_at DESC, s.created_at DESC").fetchall()
    return [_session_dict(r) for r in rows]


def fetch_session(session_id: str) -> Optional[dict]:
    with _connect() as conn:
        row = conn.execute(_SESSION_SELECT + " WHERE s.session_id = ?", (session_id,)).fetchone()
    return _session_dict(row) if row else None


def update_session_title(session_id: str, title: str) -> Optional[dict]:
    with _connect() as conn:
        conn.execute("UPDATE sessions SET title = ? WHERE session_id = ?", (title, session_id))
    return fetch_session(session_id)


def touch_session(session_id: str, updated_at: str) -> None:
    with _connect() as conn:
        conn.execute("UPDATE sessions SET updated_at = ? WHERE session_id = ?", (updated_at, session_id))


def remove_session(session_id: str) -> bool:
    with _connect() as conn:
        cur = conn.execute("DELETE FROM sessions WHERE session_id = ?", (session_id,))
    return cur.rowcount > 0


# ---------- messages ----------

def insert_message(session_id: str, role: str, content: str, created_at: str,
                   sources: Optional[list] = None, is_fallback: bool = False,
                   response_time_ms: Optional[int] = None) -> dict:
    message_id = new_id()
    with _connect() as conn:
        conn.execute(
            """INSERT INTO messages (message_id, session_id, role, content, sources_json,
                                     is_fallback, response_time_ms, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (message_id, session_id, role, content, json.dumps(sources or [], ensure_ascii=False),
             int(is_fallback), response_time_ms, created_at))
        row = conn.execute("SELECT * FROM messages WHERE message_id = ?", (message_id,)).fetchone()
    return _message_dict(row)


def fetch_messages(session_id: str) -> List[dict]:
    with _connect() as conn:
        rows = conn.execute("SELECT * FROM messages WHERE session_id = ? ORDER BY created_at, rowid",
                            (session_id,)).fetchall()
    return [_message_dict(r) for r in rows]


def fetch_history(session_id: str, turns: int) -> List[Tuple[str, str]]:
    """Last `turns` (question, answer) pairs, oldest first, for follow-up questions."""
    pairs, pending_question = [], None
    for m in fetch_messages(session_id):
        if m["role"] == config.ROLE_USER:
            pending_question = m["content"]
        elif pending_question is not None:
            pairs.append((pending_question, m["content"]))
            pending_question = None
    return pairs[-turns:] if turns > 0 else []
