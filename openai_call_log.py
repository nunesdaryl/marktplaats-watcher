"""Content-free stdout records for calls made with the app's OpenAI key."""

import json
import os
from datetime import datetime, timezone
from contextvars import ContextVar

from langchain_core.callbacks import BaseCallbackHandler


call_route = ContextVar("openai_call_route", default="unknown")
call_request_id = ContextVar("openai_call_request_id", default=None)
call_records = ContextVar("openai_call_records", default=None)


def log_openai_call(model, input_tokens=None, output_tokens=None, error=None):
    records = call_records.get()
    if records is not None:
        route = call_route.get()
        request_id = call_request_id.get() if route == "/api/internal/check" else None
        key = (datetime.now(timezone.utc).date().isoformat(), call_route.get(),
               os.getenv("VERCEL_ENV") or "local", model, error is None,
               type(error).__name__ if error is not None else None, request_id)
        row = records.setdefault(key, {"requests": 0, "inputTokens": 0, "outputTokens": 0})
        row["requests"] += 1
        row["inputTokens"] += input_tokens or 0
        row["outputTokens"] += output_tokens or 0
    print(json.dumps({
        "event": "openai_call", "route": call_route.get(),
        "env": os.getenv("VERCEL_ENV") or "local", "model": model,
        "input_tokens": input_tokens, "output_tokens": output_tokens,
        "ok": error is None, "error": type(error).__name__ if error is not None else None,
        "request_id": call_request_id.get(),
    }), flush=True)


def flush_openai_calls(records):
    """Persist one request's grouped records; failure never affects its response."""
    if not records or not os.getenv("CONVEX_SITE_URL") or not os.getenv("API_TO_CONVEX_SECRET"):
        return
    from convex_api import convex_post
    try:
        convex_post("/api/openai-calls", {"records": [
            {"day": day, "route": route, "env": env, "model": model, "ok": ok,
             "error": error, **({"requestId": request_id} if request_id else {}), **counts}
            for (day, route, env, model, ok, error, request_id), counts in records.items()
        ]})
    except Exception as exc:
        print(json.dumps({"event": "openai_calls_flush_failed", "error": type(exc).__name__}), flush=True)


class OpenAICallLogger(BaseCallbackHandler):
    """One record for each completed or failed LangChain model invocation."""

    def __init__(self, model):
        self.model = model

    def on_llm_end(self, response, **kwargs):
        usage = None
        for generation in response.generations:
            for item in generation:
                usage = getattr(getattr(item, "message", None), "usage_metadata", None)
                if usage:
                    break
            if usage:
                break
        if not usage:
            usage = (response.llm_output or {}).get("token_usage") or {}
        log_openai_call(self.model,
                        usage.get("input_tokens", usage.get("prompt_tokens")),
                        usage.get("output_tokens", usage.get("completion_tokens")))

    def on_llm_error(self, error, **kwargs):
        log_openai_call(self.model, error=error)
