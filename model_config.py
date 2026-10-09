"""Provider selection shared by production and evaluation model calls."""
import os

from langchain_openai import ChatOpenAI


def provider():
    return os.getenv("MODEL_PROVIDER", "openai")


def chat_model(name, **options):
    selected = provider()
    if selected == "openai":
        return ChatOpenAI(model=name, **options)
    if selected == "anthropic":
        options.pop("stream_usage", None)  # OpenAI-only usage streaming option
        try:
            from langchain_anthropic import ChatAnthropic
        except ModuleNotFoundError as exc:
            if exc.name != "langchain_anthropic":
                raise
            raise RuntimeError(
                "MODEL_PROVIDER=anthropic requires langchain-anthropic; install requirements-evals.txt"
            ) from exc
        return ChatAnthropic(model=name, **options)
    raise ValueError(f"Unsupported MODEL_PROVIDER={selected!r}; use openai or anthropic")
