# AI Rinpoche – Backend (FastAPI)

Implements `docs/api-contract.md` v1.0.

## Setup (once)

From the project root, venv active:

```
python -m pip install -r backend/requirements.txt
copy backend\.env.example backend\.env
```

Make sure `vectordb/` exists (`python chunking\embed_passages.py build`) or `CHROMA_HOST` points to the ChromaDB server.

The LLM runs on the industry API (`LLM_API_URL`), not locally, so Ollama is no longer needed. Put the API key in `backend/.env` as `LLM_API_KEY` and keep `.env` out of Git.

## Run

```
uvicorn backend.main:app --reload
```

- API: http://127.0.0.1:8000/api
- Interactive test page: http://127.0.0.1:8000/docs

Run from the project root, not from inside `backend/`.

## Mock mode (frontend development)

Set `USE_MOCK_RAG=true` in `backend/.env`. The API returns fake answers without loading any model, calling the LLM API or using the vector DB. Questions containing "momo" return a fallback, so the fallback UI can be tested too.

## Files

| File | Responsibility |
|---|---|
| `main.py` | Creates the app, CORS, error handlers, mounts routes under `/api`, loads models at startup |
| `config.py` | Reads settings from `backend/.env` |
| `schemas.py` | Pydantic request/response models (contract sections 4–6) |
| `routes.py` | One function per endpoint |
| `rag.py` | Retrieval, fallback threshold, LLM API call, citation clean-up, About stats |
| `store.py` | SQLite: sessions and messages |
| `errors.py` | `ApiError` and the `{ "error": { code, message } }` handlers |

## Notes

- Messages are saved only after a successful answer. If the LLM API is down or the key is wrong (`LLM_UNAVAILABLE`), nothing is stored and the user can retry.
- The first question in a chat becomes its title (max 60 characters).
- History (last `HISTORY_TURNS` exchanges) helps follow-up questions; previous answers are never used as sources.
- `sessions.db` is created automatically. Do not commit it.
