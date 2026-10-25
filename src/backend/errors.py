"""Error type and handlers producing { "error": { "code", "message" } } (api-contract.md section 6)."""

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("ai_rinpoche")


class ApiError(Exception):
    def __init__(self, code: str, message: str, status_code: int):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


def empty_question():
    return ApiError("EMPTY_QUESTION", "Please type a question.", 400)


def question_too_long(limit: int):
    return ApiError("QUESTION_TOO_LONG", f"Questions can be at most {limit} characters.", 400)


def session_not_found():
    return ApiError("SESSION_NOT_FOUND", "This chat no longer exists.", 404)


def llm_unavailable():
    return ApiError("LLM_UNAVAILABLE", "The assistant is temporarily unavailable. Please try again shortly.", 503)


def _body(code: str, message: str) -> dict:
    return {"error": {"code": code, "message": message}}


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def handle_api_error(_: Request, exc: ApiError):
        return JSONResponse(status_code=exc.status_code, content=_body(exc.code, exc.message))

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(_: Request, exc: RequestValidationError):
        return JSONResponse(status_code=400, content=_body("EMPTY_QUESTION", "The request body is missing or invalid."))

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_error(_: Request, exc: StarletteHTTPException):
        code = "SESSION_NOT_FOUND" if exc.status_code == 404 else "INTERNAL_ERROR"
        return JSONResponse(status_code=exc.status_code, content=_body(code, str(exc.detail)))

    @app.exception_handler(Exception)
    async def handle_unexpected(_: Request, exc: Exception):
        logger.exception("unexpected error: %s", exc)
        return JSONResponse(status_code=500, content=_body("INTERNAL_ERROR", "Something went wrong. Please try again."))
