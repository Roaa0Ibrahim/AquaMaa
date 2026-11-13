"""The agent as a small web service, so Deema's dashboard can send it questions (the website chat).

    GET  /health  -> {"status": "ok", "model": ...}                   Deema's server can check the agent is up
    GET  /alerts?after=<seq> -> {"messages": [...], "last": <seq>}     spoken alerts for Pepper and the website
                  (alerts.py; a background task checks Deema's live data every few seconds)
    POST /ask     <- {"question": "...", "role": "kahramaa"}          role is optional (ready for Milestone 6)
                  -> {"answer", "sources", "key_figures", "type", "in_scope", "repairs", "seconds", "error"}

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

import dashboard
from agent import ask
from agent_log import log
from alerts import AlertWatcher
from checks import CITATION
from config import ALERT_LANGUAGE, ALERT_POLL_SECONDS, ALERTS, CHAT_MODEL

HOST = os.environ.get("AQUAMAA_API_HOST", "127.0.0.1")
PORT = int(os.environ.get("AQUAMAA_API_PORT", "8000"))
API_KEY = os.environ.get("AQUAMAA_API_KEY")          # optional shared secret with Deema's server
MAX_QUESTION = 2000                                    # characters (Deema's assistant allows 2000)

app = FastAPI(title="AquaMaa agent", version="1.0")
one_at_a_time = asyncio.Lock()
watcher = AlertWatcher(lang=ALERT_LANGUAGE)


async def watch_alerts():
    """Checks Deema's live data every ALERT_POLL_SECONDS and turns new alerts into messages. No model call."""
    failed = False
    while True:
        try:
            grounding = await asyncio.to_thread(dashboard.grounding)
            for m in watcher.process(grounding):
                log.info("ALERT     %s %s: %s", m["kind"], m["id"], m["text"])
            failed = False
        except Exception as error:                         # the dashboard is down: try again, log once
            if not failed:
                log.info("ALERT     can't read the dashboard's live data (%s); will keep trying", error)
            failed = True
        await asyncio.sleep(ALERT_POLL_SECONDS)


@app.on_event("startup")
async def start_watcher():
    if ALERTS:
        asyncio.create_task(watch_alerts())
        log.info("ALERT     watching the dashboard's live data every %.0f s", ALERT_POLL_SECONDS)


@app.get("/alerts")
def alerts(after: int = 0):
    """Alert messages newer than `after` (the last seq the caller has seen). Pepper and the website poll this."""
    return {"messages": watcher.since(after), "last": watcher.seq}


class Question(BaseModel):
    question: str = Field(min_length=3, max_length=MAX_QUESTION)
    role: Optional[str] = Field(default=None, max_length=40, description="The signed-in user's dashboard role")
    grounding: Optional[dict] = Field(default=None, description="Live sensor data from Deema's dashboard "
                                      "(server/assistant.js buildGrounding); read by steps/live.py")


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
    log.info("API       question from role=%s: %s", q.role or "-", question)
    async with one_at_a_time:                              # one model job at a time
        # the role picks the persona (farmer or officer); the grounding gives the live sensor readings
        r = await asyncio.to_thread(ask, question, True, q.role, q.grounding)
    return {
        "answer": r["answer"],
        "sources": sources_of(r["answer"]),
        "key_figures": r.get("key_figures", []),
        "type": r["route"].get("question_type"),
        "in_scope": r["route"].get("in_scope"),
        "repairs": r.get("repairs", 0),
        "seconds": r["seconds"],
        "error": r.get("error"),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=HOST, port=PORT)
