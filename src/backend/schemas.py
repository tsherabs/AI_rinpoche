"""Pydantic models - mirror api-contract.md sections 4-6 exactly."""

from typing import List, Literal, Optional

from pydantic import BaseModel


class SourceOut(BaseModel):
    source_number: int
    passage_id: str
    source_id: str
    title: str
    source_type: str
    start: Optional[str] = None
    end: Optional[str] = None
    start_seconds: Optional[float] = None
    location: Optional[str] = None
    url: str = ""
    quote: str = ""
    score: float


class MessageOut(BaseModel):
    message_id: str
    session_id: str
    role: Literal["user", "assistant"]
    content: str
    sources: List[SourceOut] = []
    is_fallback: bool = False
    response_time_ms: Optional[int] = None
    created_at: str


class SessionOut(BaseModel):
    session_id: str
    title: str
    created_at: str
    updated_at: str
    message_count: int


class SessionListOut(BaseModel):
    sessions: List[SessionOut]


class SessionDetailOut(BaseModel):
    session: SessionOut
    messages: List[MessageOut]


class AskRequest(BaseModel):
    question: str = ""


class AskResponse(BaseModel):
    session: SessionOut
    user_message: MessageOut
    assistant_message: MessageOut


class RenameRequest(BaseModel):
    title: str = ""


class HealthOut(BaseModel):
    status: Literal["ok", "degraded"]
    llm_model: str
    embed_model: str
    passage_count: int
    llm_available: bool


class AboutOut(BaseModel):
    source_count: int
    passage_count: int
    total_hours: float
    languages: List[str]
    llm_model: str
    last_updated: Optional[str] = None


class ErrorDetail(BaseModel):
    code: str
    message: str


class ErrorOut(BaseModel):
    error: ErrorDetail
