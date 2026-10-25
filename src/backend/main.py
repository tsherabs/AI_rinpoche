"""
AI Rinpoche API.

Run from the project root (the folder containing backend/ and vectordb/), venv active:
    uvicorn backend.main:app --reload

Then open http://127.0.0.1:8000/docs to try every endpoint.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import config, rag, store
from .errors import register_error_handlers
from .routes import router

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("ai_rinpoche")


@asynccontextmanager
async def lifespan(_: FastAPI):
    store.init_db()
    rag.init_rag()                      # loads the embedding model and vector DB once
    logger.info("AI Rinpoche API ready (LLM: %s, mock: %s)", config.LLM_MODEL, config.USE_MOCK_RAG)
    yield


app = FastAPI(title="AI Rinpoche API", version="1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type"],
)

register_error_handlers(app)
app.include_router(router, prefix="/api")
