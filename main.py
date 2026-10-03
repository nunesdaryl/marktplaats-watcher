import hmac
import json
import os
import re
import uuid
import time
from datetime import datetime
from contextvars import ContextVar
from collections import defaultdict, deque
from pathlib import Path
from typing import Literal
from zoneinfo import ZoneInfo

import jwt
from dotenv import load_dotenv
from fastapi import BackgroundTasks, Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

load_dotenv()  # before importing agent: it reads the environment at import time

from agent import admin_intent, audit_watch, chat, chat_events, check_query, estimate_volume_note, embed_texts  # noqa: E402
from convex_api import convex_post  # noqa: E402

app = FastAPI()
request_id = ContextVar("request_id", default=None)


@app.middleware("http")
async def identify_request(request: Request, call_next):
    incoming = request.headers.get("X-Request-Id", "")
    ident = incoming if re.fullmatch(r"[A-Za-z0-9._-]{1,100}", incoming) else uuid.uuid4().hex
    token = request_id.set(ident)
    try:
        try:
            response = await call_next(request)
        except Exception as e:
            if not request.url.path.startswith("/api/"):
                raise
            log("request_failed", error=type(e).__name__)
            response = JSONResponse({"detail": "Internal Server Error"}, status_code=500)
        response.headers["X-Request-Id"] = ident
        return response
    finally:
        request_id.reset(token)


class Turn(BaseModel):
    role: Literal["user", "assistant"]   # clients can't inject system or tool messages
    content: str = Field(max_length=4000)


class WatchRef(BaseModel):
    """One of the user's watches, so the chat can propose changes to it (id, name, plain-English schedule)."""
    id: str = Field(max_length=64)
    label: str = Field(max_length=100)
    summary: str = Field(default="", max_length=160)
    active: bool = True
    query: str | None = None
    maxPriceEur: int | None = None
    mustInclude: str | None = None
    postcode: str | None = None
    maxDistanceKm: int | None = None
    schedule: dict | None = None


class WatchEstimate(BaseModel):
    query: str = Field(min_length=2, max_length=80)
    maxPriceEur: int | None = None
    mustInclude: str | None = None
    postcode: str | None = None
    maxDistanceKm: int | None = None
    schedule: dict


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=500)
    chatId: str | None = Field(default=None, max_length=64)
    history: list[Turn] = Field(default=[], max_length=20)
    watches: list[WatchRef] = Field(default=[], max_length=10)
    mode: Literal["search", "watch"] = "search"   # the composer's "Search now | Watch it" switch


class AdminAskRequest(BaseModel):
    question: str = Field(min_length=1, max_length=300)
    users: list[str] = Field(default=[], max_length=2000)
    watches: list[str] = Field(default=[], max_length=2000)


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


def log(event, **fields):
    """One JSON line per event, for Vercel's log search. Never personal data or message text."""
    print(json.dumps({"event": event, "requestId": request_id.get(), **fields}), flush=True)


def friendly_error(e, ident=None):
    """An exception from the model or a tool -> (message a user can act on, HTTP status). Details stay in the log."""
    log("chat_failed", requestId=ident or request_id.get(), error=type(e).__name__, detail=str(e))
    if "model_not_found" in str(e) or "does not exist" in str(e):  # never log the key, only the model
        log("openai_config", requestId=ident or request_id.get(), model=os.getenv("OPENAI_MODEL"))
    if "content_policy" in str(e) or "content management policy" in str(e):
        return "I can only help with Marktplaats searches and watches.", 200   # a refusal is a normal answer
    if any(code in str(e) for code in ("401", "invalid_api_key", "model_not_found", "insufficient_quota",
                                       "credit_balance_exhausted")):
        return "The chat can't reach its AI right now. Try again in a few minutes.", 503
    return "Something went wrong on our side. Try again.", 500


def record_chat_error(error, answer, ident):
    try:
        convex_post("/api/errors", {"kind": "chat", "requestId": ident,
                                    "message": f"{type(error).__name__}: {answer}"})
    except Exception as e:
        log("error_record_failed", requestId=ident, error=type(e).__name__)


def chat_args(request):
    return (request.message, [t.model_dump() for t in request.history], [w.model_dump() for w in request.watches],
            request.mode)


def chat_allowance(user):
    try:
        result = convex_post("/api/usage/consume", {"clerkId": user})
        if not isinstance(result["allowed"], bool) or not isinstance(result["limit"], int):
            raise ValueError("Invalid usage response")
        return result
    except Exception:
        log("usage_check_failed")
        return {"allowed": True}


def limit_answer(limit):
    return f"You've reached today's limit of {limit} questions. It resets at midnight."


def save_assistant(request, user, event, ident=None):
    if not request.chatId:
        return False
    search = event.get("searches") or []
    payload = {"clerkId": user, "chatId": request.chatId,
               "content": event.get("answer", event.get("text", "")) or "…",
               "listings": (event.get("listings") or [])[:10],
               "proposals": event.get("proposals") or [],
               "search": {k: v for k, v in search[-1].items()
                          if k in ("query", "max_price_eur", "must_include", "postcode", "max_distance_km")}
               if search else None}
    if payload["search"] is None:
        del payload["search"]
    try:
        convex_post("/api/chats/assistant", payload)
        return True
    except Exception as e:
        log("assistant_save_failed", requestId=ident or request_id.get(), error=type(e).__name__)
        return False


@app.post("/api/admin/ask")
def admin_ask_route(request: AdminAskRequest, user: str = Depends(current_user)):
    owner_id = os.getenv("OWNER_CLERK_ID")
    owner_email = os.getenv("OWNER_EMAIL")
    if not owner_id or user != owner_id:
        raise HTTPException(404)
    context = {"today": datetime.now(ZoneInfo("Europe/Amsterdam")).date().isoformat(),
               "users": request.users, "watches": request.watches}
    intent = admin_intent(request.question, context)
    if intent.pop("forOwner", False) and owner_email:
        intent["userEmail"] = owner_email
    return intent


@app.post("/api/chat")
def chat_route(request: ChatRequest, background_tasks: BackgroundTasks, user: str = Depends(current_user)):
    if os.getenv("CHAT_PAUSED") == "1":
        return JSONResponse({"answer": "Chat is paused for maintenance; your watches keep running."}, status_code=503)
    if too_many(user):
        return JSONResponse({"answer": "That's a lot of messages in one minute. Wait a moment, then try again."}, status_code=429)
    allowance = chat_allowance(user)
    if not allowance["allowed"]:
        return JSONResponse({"answer": limit_answer(allowance["limit"])}, status_code=429)
    try:
        answer = chat(*chat_args(request))
        return {**answer, "saved": save_assistant(request, user, answer)}
    except Exception as e:
        answer, status = friendly_error(e)
        background_tasks.add_task(record_chat_error, e, answer, request_id.get())
        return JSONResponse({"answer": answer, "saved": save_assistant(request, user, {"answer": answer})},
                            status_code=status)


@app.post("/api/watch/estimate")
def watch_estimate_route(request: WatchEstimate, user: str = Depends(current_user)):
    if too_many(user):
        return JSONResponse({"volumeNote": None}, status_code=429)
    return {"volumeNote": estimate_volume_note(request.model_dump())}


@app.post("/api/chat/stream")
def chat_stream_route(request: ChatRequest, background_tasks: BackgroundTasks, user: str = Depends(current_user)):
    """The same chat, streamed as newline-delimited JSON events: status, listings, delta, done (or error)."""
    if os.getenv("CHAT_PAUSED") == "1":
        return JSONResponse({"answer": "Chat is paused for maintenance; your watches keep running."}, status_code=503)
    if too_many(user):
        return JSONResponse({"answer": "That's a lot of messages in one minute. Wait a moment, then try again."}, status_code=429)
    allowance = chat_allowance(user)
    if not allowance["allowed"]:
        event = {"type": "done", "answer": limit_answer(allowance["limit"]), "listings": [], "searches": [],
                 "proposals": [], "usage": {"input_tokens": 0, "output_tokens": 0, "model_calls": 0, "tool_calls": 0}}
        event["saved"] = save_assistant(request, user, event)
        return StreamingResponse(iter([json.dumps(event) + "\n"]), media_type="application/x-ndjson")

    ident = request_id.get()

    def events():
        started, stats = time.time(), {"statuses": 0, "listings": 0, "error": None}
        final_sent = False
        try:
            for event in chat_events(*chat_args(request)):
                if event["type"] == "status":
                    stats["statuses"] += 1
                elif event["type"] == "listings":
                    stats["listings"] = len(event["listings"])
                elif event["type"] == "done":
                    stats["proposals"] = len(event["proposals"])
                    stats.update({k: event["usage"][k] for k in ("input_tokens", "output_tokens", "model_calls")})
                    event["saved"] = save_assistant(request, user, event, ident)
                    final_sent = True
                elif event["type"] == "error":
                    event["saved"] = save_assistant(request, user, event, ident)
                    final_sent = True
                yield json.dumps(event) + "\n"
                if final_sent:
                    break
        except Exception as e:
            stats["error"] = type(e).__name__
            if not final_sent:
                answer = friendly_error(e, ident)[0]
                background_tasks.add_task(record_chat_error, e, answer, ident)
                event = {"type": "error", "text": answer}
                event["saved"] = save_assistant(request, user, event, ident)
                yield json.dumps(event) + "\n"
        log("chat_turn", requestId=ident, mode=request.mode, tool_calls=stats["statuses"], ms=round((time.time() - started) * 1000),
            **{k: v for k, v in stats.items() if k != "statuses"})

    return StreamingResponse(events(), media_type="application/x-ndjson",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


# Scheduled checks: only Convex's dispatcher may call this, with the shared CRON_SECRET.
class CheckWatch(BaseModel):
    id: str = Field(max_length=64)
    description: str = Field(default="", max_length=200)
    max_price_eur: int | None = None
    must_include: str | None = Field(default=None, max_length=40)
    postcode: str | None = Field(default=None, max_length=10)
    max_distance_km: int | None = None
    seen_ids: list[str] = Field(default=[], max_length=2000)  # must be >= MAX_SEEN_SENT in checker.ts
    seeded: bool = True          # False on the first check: nothing is e-mailed then, so nothing is scored
    watermark: int | None = Field(default=None, ge=0)          # newest listing number handled at the last check
    last_checked_at: int | None = Field(default=None, ge=0)    # ms; the check reads listings placed since that day
    read_only: bool = False


class CheckRequest(BaseModel):
    query: str = Field(min_length=1, max_length=80)
    watches: list[CheckWatch] = Field(min_length=1, max_length=100)


class AuditWatch(CheckWatch):
    query: str = Field(min_length=1, max_length=80)
    notify: Literal["great", "good", "all"]
    alerted_ids: list[str] = Field(default=[])
    seen_ids: list[str] = Field(default=[])
    seen_scores: dict[str, int] = Field(default={})
    baseline_ids: list[str] = Field(default=[])
    created_mark: int | None = Field(default=None, ge=0)
    since_days: int = Field(default=1, ge=0, le=7)
    last_read_at: int | None = Field(default=None, ge=0)
    check_alive: bool = False


class AuditRequest(BaseModel):
    watches: list[AuditWatch] = Field(min_length=1, max_length=100)


def cron_caller(x_cron_secret: str = Header(default="")):
    secret = os.getenv("CRON_SECRET", "")
    if not secret:
        raise HTTPException(503, "Scheduled checks are not configured on this server.")
    if not hmac.compare_digest(x_cron_secret.encode(), secret.encode()):  # constant-time compare
        raise HTTPException(401, "Wrong cron secret.")


class EmbedRequest(BaseModel):
    texts: list[str] = Field(min_length=1)


@app.post("/api/internal/embed", dependencies=[Depends(cron_caller)])
def embed_route(request: EmbedRequest):
    return {"vectors": embed_texts(request.texts)}


@app.post("/api/internal/check", dependencies=[Depends(cron_caller)])
def check_route(request: CheckRequest):
    started = time.time()
    results = check_query(request.query, [w.model_dump() for w in request.watches])
    log("check", watches=len(results), failed=sum(not r["ok"] for r in results),
        new_listings=sum(len(r.get("listings") or []) for r in results), ms=round((time.time() - started) * 1000),
        errors=sorted({r["error"] for r in results if not r["ok"]}))
    return {"results": results}


@app.post("/api/internal/audit", dependencies=[Depends(cron_caller)])
def audit_route(request: AuditRequest):
    results = [audit_watch(w.model_dump()) for w in request.watches]
    log("audit", watches=len(results), failed=sum(not r["ok"] for r in results),
        misses=sum(r["missCount"] for r in results), scored=sum(r["scored"] for r in results))
    return {"results": results}


@app.post("/api/csp-report")
async def csp_report(http: Request):
    """Browsers report Content-Security-Policy violations here (report-only for now). Logged, never stored."""
    body = await http.body()
    if len(body) > 10_000:
        return JSONResponse({}, status_code=413)
    try:
        report = json.loads(body or b"{}")
    except ValueError:
        return JSONResponse({}, status_code=400)
    for r in report if isinstance(report, list) else [report.get("csp-report", report)]:
        r = r.get("body", r) if isinstance(r, dict) else {}
        log("csp_violation", directive=str(r.get("effectiveDirective") or r.get("violated-directive") or "")[:80],
            blocked=str(r.get("blockedURL") or r.get("blocked-uri") or "")[:200],
            page=str(r.get("documentURL") or r.get("document-uri") or "").split("?")[0][:200])
    return JSONResponse({}, status_code=204)


# Health: only for the owner's uptime check, which sends HEALTH_KEY. Anyone else gets a plain 404, as if the route
# didn't exist (the owner's own view of health is the /admin dashboard).
def health_caller(x_health_key: str = Header(default="")):
    key = os.getenv("HEALTH_KEY", "")
    if not key or not hmac.compare_digest(x_health_key.encode(), key.encode()):
        raise HTTPException(404, "Not Found")


@app.get("/api/health", dependencies=[Depends(health_caller)])
def health():
    return {"ok": True}



# In the Docker image the built UI is served from the same port (no Node server needed).
# Mounted last, so the /api routes above always take precedence.
UI = Path(__file__).parent / "frontend" / "out"   # the Next.js static export
if UI.is_dir():
    app.mount("/", StaticFiles(directory=UI, html=True), name="ui")
