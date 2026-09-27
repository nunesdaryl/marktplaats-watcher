import hmac
import os
import time
from collections import defaultdict, deque
from pathlib import Path
from typing import Literal

import jwt
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

load_dotenv()  # before importing agent: it reads the environment at import time

from agent import chat, check_query  # noqa: E402

app = FastAPI()


class Turn(BaseModel):
    role: Literal["user", "assistant"]   # clients can't inject system or tool messages
    content: str = Field(max_length=4000)


class WatchRef(BaseModel):
    """One of the user's watches, so the chat can propose changes to it (id, name, plain-English schedule)."""
    id: str = Field(max_length=64)
    label: str = Field(max_length=100)
    summary: str = Field(default="", max_length=160)
    active: bool = True


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=500)
    history: list[Turn] = Field(default=[], max_length=20)
    watches: list[WatchRef] = Field(default=[], max_length=10)


# Login: the browser sends its Clerk session token; we check its signature against Clerk's public keys.
CLERK_ISSUER = os.getenv("CLERK_ISSUER", "").rstrip("/")
CLERK_AUDIENCE = os.getenv("CLERK_AUDIENCE", "convex")  # the aud claim Clerk's Convex integration adds
_jwks = jwt.PyJWKClient(os.getenv("CLERK_JWKS_URL") or f"{CLERK_ISSUER}/.well-known/jwks.json") \
    if CLERK_ISSUER else None


def current_user(authorization: str = Header(default="")):
    """The signed-in Clerk user id, or 401. Every chat costs model tokens, so it needs a login."""
    if _jwks is None:
        raise HTTPException(503, "Login is not configured on this server.")
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(401, "Please sign in first.")
    try:
        key = _jwks.get_signing_key_from_jwt(token).key
        claims = jwt.decode(token, key, algorithms=["RS256"], issuer=CLERK_ISSUER, audience=CLERK_AUDIENCE,
                            leeway=10, options={"require": ["exp", "sub"]})
    except jwt.PyJWTError:
        raise HTTPException(401, "Your session expired. Please sign in again.")
    return claims["sub"]


# Per-user rate limit (in memory, per server instance). Keyed by the verified user id, which,
# unlike an X-Forwarded-For address, a client can't make up.
RATE_PER_MINUTE = int(os.getenv("RATE_PER_MINUTE", "10"))
_recent = defaultdict(deque)


def too_many(user):
    now, hits = time.time(), _recent[user]
    while hits and now - hits[0] > 60:
        hits.popleft()
    hits.append(now)
    return len(hits) > RATE_PER_MINUTE


@app.post("/api/chat")
def chat_route(request: ChatRequest, user: str = Depends(current_user)):
    if too_many(user):
        return JSONResponse({"answer": "Too many questions in a minute. Please wait a moment."}, status_code=429)
    try:
        return chat(request.message, [t.model_dump() for t in request.history],
                    [w.model_dump() for w in request.watches])
    except Exception as e:
        print(f"chat failed: {type(e).__name__}: {e}")  # details stay in the server log
        if "model_not_found" in str(e) or "does not exist" in str(e):  # never log the key, only the model
            print(f"openai config: model={os.getenv('OPENAI_MODEL')!r}")
        if "content_policy" in str(e) or "content management policy" in str(e):
            return {"answer": "I can only help with Marktplaats searches and watches."}
        if any(code in str(e) for code in ("401", "invalid_api_key", "model_not_found", "insufficient_quota",
                                           "credit_balance_exhausted")):
            return {"answer": "The AI model is offline right now (its API key or model is unavailable). "
                              "Your watches keep running; please try the chat again later."}
        return {"answer": "Error: something went wrong, please try again."}


# Scheduled checks: only Convex's dispatcher may call this, with the shared CRON_SECRET.
class CheckWatch(BaseModel):
    id: str = Field(max_length=64)
    description: str = Field(default="", max_length=200)
    max_price_eur: int | None = None
    must_include: str | None = Field(default=None, max_length=40)
    postcode: str | None = Field(default=None, max_length=10)
    max_distance_km: int | None = None
    seen_ids: list[str] = Field(default=[], max_length=1000)


class CheckRequest(BaseModel):
    query: str = Field(min_length=1, max_length=80)
    watches: list[CheckWatch] = Field(min_length=1, max_length=100)


def cron_caller(x_cron_secret: str = Header(default="")):
    secret = os.getenv("CRON_SECRET", "")
    if not secret:
        raise HTTPException(503, "Scheduled checks are not configured on this server.")
    if not hmac.compare_digest(x_cron_secret.encode(), secret.encode()):  # constant-time compare
        raise HTTPException(401, "Wrong cron secret.")


@app.post("/api/internal/check", dependencies=[Depends(cron_caller)])
def check_route(request: CheckRequest):
    return {"results": check_query(request.query, [w.model_dump() for w in request.watches])}


@app.get("/api/health")
def health():
    return {"ok": True}



# In the Docker image the built React UI is served from the same port (no Vite needed).
# Mounted last, so the /api routes above always take precedence.
UI = Path(__file__).parent / "frontend" / "dist"
if UI.is_dir():
    app.mount("/", StaticFiles(directory=UI, html=True), name="ui")
