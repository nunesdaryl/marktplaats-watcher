from typing import Literal

from dotenv import load_dotenv
from fastapi import FastAPI
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


@app.post("/api/chat")
def chat_route(request: ChatRequest):
    try:
        return {"answer": chat(request.message, [t.model_dump() for t in request.history])}
    except Exception as e:
        print(f"chat failed: {type(e).__name__}: {e}")  # details stay in the server log
        if "content management policy" in str(e):     # Azure's content filter blocked a jailbreak attempt
            return {"answer": "I can only help with Marktplaats searches."}
        return {"answer": "Error: something went wrong, please try again."}
