"""Offline checks for one content-free record per model or embedding call."""

import json
import os
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from langchain_core.messages import AIMessage, AIMessageChunk
from langchain_core.outputs import ChatGeneration, LLMResult
from langchain_core.tools import tool

os.environ.setdefault("OPENAI_API_KEY", "dummy")
os.environ.setdefault("OPENAI_MODEL", "gpt-5.4-mini")

import agent  # noqa: E402
import main  # noqa: E402
import offer  # noqa: E402
from openai_call_log import OpenAICallLogger, call_request_id, call_route  # noqa: E402
from test_agent import client  # noqa: E402, F401 - authenticated API fixture


def records(capsys):
    return [json.loads(line) for line in capsys.readouterr().out.splitlines()
            if json.loads(line).get("event") == "openai_call"]


def finish(logger, input_tokens, output_tokens):
    message = AIMessage(content="secret prompt must stay out", usage_metadata={
        "input_tokens": input_tokens, "output_tokens": output_tokens,
        "total_tokens": input_tokens + output_tokens,
    })
    logger.on_llm_end(LLMResult(generations=[[ChatGeneration(message=message)]]), run_id=uuid4())


def test_models_attach_one_logger_each():
    assert sum(isinstance(item, OpenAICallLogger) for item in agent.base_model.callbacks) == 1
    assert sum(isinstance(item, OpenAICallLogger) for item in offer.offer_model.callbacks) == 1


def test_rank_omitted_id_retry_logs_both_calls_without_content(monkeypatch, capsys):
    monkeypatch.setenv("VERCEL_ENV", "preview")
    logger = OpenAICallLogger("gpt-5.4-mini")

    class PartialRanker:
        calls = 0

        def invoke(self, messages):
            self.calls += 1
            finish(logger, 20 + self.calls, 4)
            ranked_id = "first" if self.calls == 1 else "second"
            return agent.Ranking(ranks=[agent.Rank(id=ranked_id, score=8, reason="match")])

    ranker = PartialRanker()
    monkeypatch.setattr(agent, "ranker", ranker)
    route_token = call_route.set("/api/internal/check")
    id_token = call_request_id.set("req-1")
    try:
        ranked = agent.rank_listings("secret watch description", [{"id": "first"}, {"id": "second"}])
    finally:
        call_request_id.reset(id_token)
        call_route.reset(route_token)
    assert ranker.calls == 2
    assert [item["score"] for item in ranked] == [8, 8]
    lines = records(capsys)
    assert len(lines) == 2
    assert [item["input_tokens"] for item in lines] == [21, 22]
    assert all(item == {"event": "openai_call", "route": "/api/internal/check", "env": "preview",
                        "model": "gpt-5.4-mini", "input_tokens": n, "output_tokens": 4,
                        "ok": True, "error": None, "request_id": "req-1"}
               for item, n in zip(lines, [21, 22]))
    assert "secret" not in json.dumps(lines)


def test_chat_stream_tool_turn_logs_two_calls(monkeypatch, capsys):
    monkeypatch.delenv("VERCEL_ENV", raising=False)
    logger = OpenAICallLogger("gpt-5.4-mini")

    @tool
    def search_marktplaats(query: str) -> str:
        """Return synthetic empty results."""
        return "[]"

    monkeypatch.setattr(agent, "make_tools", lambda context: [search_marktplaats])

    class StreamingModel:
        calls = 0

        def stream(self, messages):
            self.calls += 1
            if self.calls == 1:
                yield AIMessageChunk(content="", tool_call_chunks=[{
                    "name": "search_marktplaats", "args": '{"query":"secret query"}',
                    "id": "tool-1", "index": 0,
                }])
            else:
                yield AIMessageChunk(content="Finished.")
            finish(logger, 10 * self.calls, 2)

    monkeypatch.setattr(agent, "model", StreamingModel())
    route_token = call_route.set("/api/chat/stream")
    try:
        events = list(agent.chat_events("secret chat text", []))
    finally:
        call_route.reset(route_token)
    assert events[-1]["type"] == "done"
    lines = records(capsys)
    assert len(lines) == 2
    assert [item["input_tokens"] for item in lines] == [10, 20]
    assert all(item["route"] == "/api/chat/stream" and item["env"] == "local" for item in lines)
    assert "secret" not in json.dumps(lines)


def test_embedding_route_logs_each_batch_with_request_id(monkeypatch, capsys):
    monkeypatch.setenv("VERCEL_ENV", "production")
    monkeypatch.setenv("CRON_SECRET", "test-secret")

    class FakeEmbeddings:
        def __init__(self, model, dimensions):
            assert model == "text-embedding-3-small" and dimensions == 1536

        def embed_documents(self, texts):
            return [[0.1] for _ in texts]

    monkeypatch.setattr(agent, "OpenAIEmbeddings", FakeEmbeddings)
    response = TestClient(main.app).post("/api/internal/embed", json={"texts": ["secret text"]},
        headers={"X-Cron-Secret": "test-secret", "X-Request-Id": "embed-1"})
    assert response.status_code == 200
    lines = records(capsys)
    assert len(lines) == 1
    assert lines[0] == {"event": "openai_call", "route": "/api/internal/embed", "env": "production",
                        "model": "text-embedding-3-small", "input_tokens": 2, "output_tokens": 0,
                        "ok": True, "error": None, "request_id": "embed-1"}
    assert "secret" not in json.dumps(lines)


def test_failure_logs_exception_class_only(capsys):
    logger = OpenAICallLogger("gpt-5.4-mini")
    logger.on_llm_error(RuntimeError("secret key and prompt"), run_id=uuid4())
    assert records(capsys) == [{"event": "openai_call", "route": "unknown", "env": "local",
                              "model": "gpt-5.4-mini", "input_tokens": None, "output_tokens": None,
                              "ok": False, "error": "RuntimeError", "request_id": None}]


def test_stream_http_iterator_keeps_route_and_request_id(client, monkeypatch, capsys):
    monkeypatch.setattr(main, "chat_allowance", lambda user: {"allowed": True})
    monkeypatch.setattr(main, "record_chat_spend", lambda *args: None)
    monkeypatch.setattr(main, "save_assistant", lambda *args: True)

    def fake_events(*args):
        finish(OpenAICallLogger("gpt-5.4-mini"), 7, 2)
        yield {"type": "done", "answer": "OK", "listings": [], "searches": [], "proposals": [],
               "usage": {"input_tokens": 7, "output_tokens": 2, "model_calls": 0, "tool_calls": 0}}

    monkeypatch.setattr(main, "chat_events", fake_events)
    response = client.post("/api/chat/stream", json={"message": "secret chat"},
        headers={"Authorization": f"Bearer {client.token()}", "X-Request-Id": "stream-1"})
    assert response.status_code == 200
    assert json.loads(response.text.splitlines()[-1])["answer"] == "OK"
    assert records(capsys) == [{"event": "openai_call", "route": "/api/chat/stream", "env": "local",
                               "model": "gpt-5.4-mini", "input_tokens": 7, "output_tokens": 2,
                               "ok": True, "error": None, "request_id": "stream-1"}]


def test_embedding_failure_logs_once_and_raises(monkeypatch, capsys):
    class FailingEmbeddings:
        def __init__(self, model, dimensions):
            pass

        def embed_documents(self, texts):
            raise RuntimeError("secret embedding text")

    monkeypatch.setattr(agent, "OpenAIEmbeddings", FailingEmbeddings)
    with pytest.raises(RuntimeError):
        agent.embed_texts(["secret embedding text"])
    assert records(capsys) == [{"event": "openai_call", "route": "unknown", "env": "local",
                               "model": "text-embedding-3-small", "input_tokens": None, "output_tokens": None,
                               "ok": False, "error": "RuntimeError", "request_id": None}]
