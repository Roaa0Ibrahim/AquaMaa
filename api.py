"""The agent as a small web service, so Deema's dashboard can send it questions (the website chat).

    GET  /health  -> {"status": "ok", "model": ...}                   Deema's server can check the agent is up
    POST /ask     <- {"question": "...", "role": "kahramaa",           role is optional (ready for Milestone 6)
                      "context": {"page": "wells", "year": 2022}}      what the user sees, read by steps/screen.py
                  -> {"answer", "sources", "key_figures", "type", "in_scope", "screen", "repairs", "seconds", "error"}

Questions are answered one at a time, in arrival order: one job at a time on the local model.
It listens on 127.0.0.1 only, so only programs on this computer (Deema's server) can call it.
If AQUAMAA_API_KEY is set, every /ask request must send it in the header X-AquaMaa-Key.

Run:   python api.py                      (http://127.0.0.1:8000, docs at http://127.0.0.1:8000/docs)
Test:  python test_api.py                 (with the service running)
"""
import asyncio
import os
import re
from typing import Optional

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from agent import ask
from agent_log import log
from checks import CITATION
from config import CHAT_MODEL

HOST = os.environ.get("AQUAMAA_API_HOST", "127.0.0.1")
PORT = int(os.environ.get("AQUAMAA_API_PORT", "8000"))
API_KEY = os.environ.get("AQUAMAA_API_KEY")          # optional shared secret with Deema's server
MAX_QUESTION = 500                                     # characters

app = FastAPI(title="AquaMaa agent", version="1.0")
one_at_a_time = asyncio.Lock()


class Screen(BaseModel):
    page: Optional[str] = Field(default=None, max_length=40, description="The dashboard page open, such as 'wells'")
    year: Optional[int] = Field(default=None, ge=1990, le=2100, description="The year chosen on the dashboard")


class Question(BaseModel):
    question: str = Field(min_length=3, max_length=MAX_QUESTION)
    role: Optional[str] = Field(default=None, max_length=40, description="The signed-in user's dashboard role")
    context: Optional[Screen] = Field(default=None, description="What the user sees; read by steps/screen.py")


def sources_of(answer):
    """The distinct sources cited in the answer, in order, without [general knowledge]."""
    seen = []
    for c in CITATION.findall(answer):
        label = c.strip("[]").strip()
        if label.lower() != "general knowledge" and not label.isdigit() and label not in seen:
            seen.append(label)
    return seen


@app.get("/health")
def health():
    return {"status": "ok", "model": CHAT_MODEL}


@app.post("/ask")
async def ask_endpoint(q: Question, x_aquamaa_key: Optional[str] = Header(default=None)):
    if API_KEY and x_aquamaa_key != API_KEY:
        raise HTTPException(status_code=401, detail="Missing or wrong X-AquaMaa-Key")
    question = re.sub(r"\s+", " ", q.question).strip()
    context = q.context.model_dump() if q.context else {}
    log.info("API       question from role=%s context=%s: %s", q.role or "-", context or "-", question)
    async with one_at_a_time:                              # one model job at a time
        r = await asyncio.to_thread(ask, question, True, context)
    return {
        "answer": r["answer"],
        "sources": sources_of(r["answer"]),
        "key_figures": r.get("key_figures", []),
        "type": r["route"].get("question_type"),
        "in_scope": r["route"].get("in_scope"),
        "screen": r.get("screen", "none"),
        "repairs": r.get("repairs", 0),
        "seconds": r["seconds"],
        "error": r.get("error"),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=HOST, port=PORT)
