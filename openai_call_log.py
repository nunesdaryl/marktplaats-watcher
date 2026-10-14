"""Content-free stdout records for calls made with the app's OpenAI key."""

import json
import os
from contextvars import ContextVar

from langchain_core.callbacks import BaseCallbackHandler


call_route = ContextVar("openai_call_route", default="unknown")
call_request_id = ContextVar("openai_call_request_id", default=None)


def log_openai_call(model, input_tokens=None, output_tokens=None, error=None):
    print(json.dumps({
        "event": "openai_call", "route": call_route.get(),
        "env": os.getenv("VERCEL_ENV") or "local", "model": model,
        "input_tokens": input_tokens, "output_tokens": output_tokens,
        "ok": error is None, "error": type(error).__name__ if error is not None else None,
        "request_id": call_request_id.get(),
    }), flush=True)


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
