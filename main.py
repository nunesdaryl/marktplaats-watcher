import os
import time
from collections import defaultdict, deque
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

load_dotenv()  # before importing agent: it reads the environment at import time

from agent import chat  # noqa: E402

app = FastAPI()


class Turn(BaseModel):
    role: Literal["user", "assistant"]   # clients can't inject system or tool messages
    content: str = Field(max_length=4000)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=500)
    history: list[Turn] = Field(default=[], max_length=20)


# Per-IP rate limit (in memory, per server instance): enough for a demo, not for real abuse.
RATE_PER_MINUTE = int(os.getenv("RATE_PER_MINUTE", "10"))
_recent = defaultdict(deque)


def too_many(ip):
    now, hits = time.time(), _recent[ip]
    while hits and now - hits[0] > 60:
        hits.popleft()
    hits.append(now)
    return len(hits) > RATE_PER_MINUTE


@app.post("/api/chat")
def chat_route(request: ChatRequest, http: Request):
    ip = http.headers.get("x-forwarded-for", http.client.host if http.client else "?").split(",")[0].strip()
    if too_many(ip):
        return JSONResponse({"answer": "Too many questions in a minute. Please wait a moment."}, status_code=429)
    try:
        return {"answer": chat(request.message, [t.model_dump() for t in request.history])}
    except Exception as e:
        print(f"chat failed: {type(e).__name__}: {e}")  # details stay in the server log
        if "content management policy" in str(e):     # Azure's content filter blocked a jailbreak attempt
            return {"answer": "I can only help with Marktplaats searches."}
        return {"answer": "Error: something went wrong, please try again."}


@app.get("/api/health")
def health():
    return {"ok": True}


# In the Docker image the built React UI is served from the same port (no Vite needed).
# Mounted last, so the /api routes above always take precedence.
UI = Path(__file__).parent / "frontend" / "dist"
if UI.is_dir():
    app.mount("/", StaticFiles(directory=UI, html=True), name="ui")
