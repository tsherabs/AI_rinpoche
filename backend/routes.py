"""API endpoints - one function per endpoint (api-contract.md sections 5 and 7).

Endpoints are plain `def`, so FastAPI runs them in a thread pool and the slow
LLM call does not block other requests.
"""

import time

from fastapi import APIRouter, Response

from . import config, errors, rag, store
from .schemas import (AboutOut, AskRequest, AskResponse, HealthOut, RenameRequest,
                      SessionDetailOut, SessionListOut, SessionOut)

router = APIRouter()


def _require_session(session_id: str) -> dict:
    session = store.fetch_session(session_id)
    if session is None:
        raise errors.session_not_found()
    return session


def _make_title(question: str) -> str:
    title = " ".join(question.split())
    if len(title) <= config.SESSION_TITLE_LENGTH:
        return title
    return title[:config.SESSION_TITLE_LENGTH].rsplit(" ", 1)[0] + "..."


# ---------- status ----------

@router.get("/health", response_model=HealthOut)
def get_health():
    available = rag.llm_available()
    return {
        "status": "ok" if available else "degraded",
        "llm_model": config.LLM_MODEL,
        "embed_model": config.EMBED_MODEL,
        "passage_count": rag.passage_count(),
        "llm_available": available,
    }


@router.get("/about", response_model=AboutOut)
def get_about():
    return {**rag.corpus_stats(), "llm_model": config.LLM_MODEL}


# ---------- sessions ----------

@router.post("/sessions", response_model=SessionOut, status_code=201)
def create_session():
    return store.insert_session()


@router.get("/sessions", response_model=SessionListOut)
def list_sessions():
    return {"sessions": store.fetch_sessions()}


@router.get("/sessions/{session_id}", response_model=SessionDetailOut)
def get_session(session_id: str):
    session = _require_session(session_id)
    return {"session": session, "messages": store.fetch_messages(session_id)}


@router.patch("/sessions/{session_id}", response_model=SessionOut)
def rename_session(session_id: str, body: RenameRequest):
    _require_session(session_id)
    title = " ".join(body.title.split())[:config.SESSION_TITLE_LENGTH] or config.DEFAULT_SESSION_TITLE
    return store.update_session_title(session_id, title)


@router.delete("/sessions/{session_id}", status_code=204)
def delete_session(session_id: str):
    if not store.remove_session(session_id):
        raise errors.session_not_found()
    return Response(status_code=204)


# ---------- chat ----------

@router.post("/sessions/{session_id}/messages", response_model=AskResponse)
def send_message(session_id: str, body: AskRequest):
    question = body.question.strip()
    if not question:
        raise errors.empty_question()
    if len(question) > config.MAX_QUESTION_LENGTH:
        raise errors.question_too_long(config.MAX_QUESTION_LENGTH)
    session = _require_session(session_id)

    history = store.fetch_history(session_id, config.HISTORY_TURNS)
    asked_at = store.now_iso()
    started = time.perf_counter()
    try:
        content, sources, is_fallback = rag.generate_answer(question, history)
    except rag.LLMUnavailableError:
        raise errors.llm_unavailable()          # nothing is saved, so the user can simply retry
    response_time_ms = int((time.perf_counter() - started) * 1000)

    # save both messages only after a successful answer
    user_message = store.insert_message(session_id, config.ROLE_USER, question, asked_at)
    answered_at = store.now_iso()
    assistant_message = store.insert_message(session_id, config.ROLE_ASSISTANT, content, answered_at,
                                             sources=sources, is_fallback=is_fallback,
                                             response_time_ms=response_time_ms)

    if session["title"] == config.DEFAULT_SESSION_TITLE:
        store.update_session_title(session_id, _make_title(question))
    store.touch_session(session_id, answered_at)

    return {"session": store.fetch_session(session_id),
            "user_message": user_message,
            "assistant_message": assistant_message}
