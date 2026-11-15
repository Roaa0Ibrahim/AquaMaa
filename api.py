"""The agent as a small web service, so Deema's dashboard can send it questions (the website chat).

    GET  /health  -> {"status": "ok", "model": ...}                   Deema's server can check the agent is up
    POST /transcribe <- WAV audio  -> {"text", "heard", "changed"}   Fanar speech-to-text for the website microphone
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
import json
import os
import re
import time
from typing import Optional

import httpx
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, Response
from pydantic import BaseModel, Field

from clean_transcript import clean
from tablet import PAGE, live_summary
from transcribe import transcribe
from voice import speak
from fastpath.answer import warm as warm_fast

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
# The website (Deema's dashboard on this laptop) calls /clean and /alerts straight from the browser
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
                   allow_methods=["GET", "POST"], allow_headers=["Content-Type"])
one_at_a_time = asyncio.Lock()
watcher = AlertWatcher(lang=ALERT_LANGUAGE)
latest = {"grounding": None, "at": 0.0}                           # the dashboard's live data, refreshed by the alert watcher


async def watch_alerts():
    """Checks Deema's live data every ALERT_POLL_SECONDS and turns new alerts into messages. No model call."""
    failed = False
    while True:
        try:
            grounding = await asyncio.to_thread(dashboard.grounding)
            latest["grounding"], latest["at"] = grounding, time.time()   # shared with every question (live_data)
            for m in watcher.process(grounding):
                log.info("ALERT     %s %s: %s", m["kind"], m["id"], m["text"])
            failed = False
        except Exception as error:                         # the dashboard is down: try again, log once
            if not failed:
                log.info("ALERT     can't read the dashboard's live data (%s); will keep trying", error)
            failed = True
        await asyncio.sleep(ALERT_POLL_SECONDS)


async def live_data():
    """The dashboard's live data, shared: the alert watcher's copy if it is a few seconds old, else fetched once.
    (15 Nov: Deema's server allows 20 data requests a minute; separate fetches for every question hit the limit.)"""
    if latest["grounding"] is not None and time.time() - latest["at"] < 3 * ALERT_POLL_SECONDS:
        return dict(latest["grounding"])
    g = await asyncio.to_thread(dashboard.grounding)
    latest["grounding"], latest["at"] = g, time.time()
    return dict(g)


@app.on_event("startup")
async def warm_small_model():
    asyncio.create_task(asyncio.to_thread(warm_fast))      # the farmer's fast answers: no load pause on the first one


@app.on_event("startup")
async def start_watcher():
    if ALERTS:
        asyncio.create_task(watch_alerts())
        log.info("ALERT     watching the dashboard's live data every %.0f s", ALERT_POLL_SECONDS)


class Heard(BaseModel):
    text: str = Field(min_length=1, max_length=MAX_QUESTION)


@app.post("/clean")
async def clean_spoken(h: Heard):
    """Fixes speech-recognition mistakes in a spoken question (clean_transcript.py). Called by the website chat box
    right after the browser recognises speech, before the question is sent."""
    async with one_at_a_time:                              # it uses the model too: one job at a time
        text, changed, seconds = await asyncio.to_thread(clean, h.text)
    if changed:
        log.info("CLEAN     %s -> %s (%.1f s)", h.text, text, seconds)
    return {"text": text, "changed": changed, "seconds": seconds}


@app.post("/transcribe")
async def transcribe_spoken(request: Request):
    """A spoken question as WAV audio (the request body) -> text, by Fanar's speech recognition, then the same
    correction as /clean. The website falls back to the browser's own text if this fails (transcribe.py)."""
    audio = await request.body()
    if not 1000 < len(audio) < 10_000_000:
        raise HTTPException(400, "Send a WAV recording of up to about a minute")
    try:
        heard, stt_seconds = await asyncio.to_thread(transcribe, audio)
    except (httpx.HTTPError, ValueError) as error:
        log.info("STT       Fanar failed (%s); the website keeps the browser's text", error)
        raise HTTPException(502, "Speech recognition failed")
    if not heard:
        raise HTTPException(422, "Nothing was heard")
    async with one_at_a_time:
        text, changed, seconds = await asyncio.to_thread(clean, heard)
    log.info("STT       Fanar heard: %s (%.1f s)%s", heard, stt_seconds, f" -> {text}" if changed else "")
    return {"text": text, "heard": heard, "changed": changed, "seconds": round(stt_seconds + seconds, 1)}


@app.get("/alerts")
def alerts(after: int = 0):
    """Alert messages newer than `after` (the last seq the caller has seen). Pepper and the website poll this."""
    return {"messages": watcher.since(after), "last": watcher.seq}


class Question(BaseModel):
    question: str = Field(min_length=3, max_length=MAX_QUESTION)
    role: Optional[str] = Field(default=None, max_length=40, description="The signed-in user's dashboard role")
    grounding: Optional[dict] = Field(default=None, description="Live sensor data from Deema's dashboard "
                                      "(server/assistant.js buildGrounding); read by steps/live.py")
    live: bool = Field(default=False, description="Fetch the dashboard's live data here when no grounding is sent "
                                                  "(Pepper asks this way)")


def sources_of(answer):
    """The distinct sources cited in the answer, in order, without [general knowledge]."""
    seen = []
    for c in CITATION.findall(answer):
        label = c.strip("[]").strip()
        if label.lower() != "general knowledge" and not label.isdigit() and label not in seen:
            seen.append(label)
    return seen


class Spoken(BaseModel):
    text: str = Field(min_length=1, max_length=3000)
    lang: Optional[str] = Field(default=None, max_length=2)


@app.post("/speak")
async def speak_answer(s: Spoken):
    """An answer as MP3 in a natural neural voice (voice.py; Qatari Arabic or English). No model, no queue."""
    try:
        audio = await speak(s.text, s.lang)
    except Exception as error:                              # no internet or the voice service failed
        log.info("VOICE     failed (%s); the website uses the browser's voice", error)
        raise HTTPException(502, "Voice service unavailable")
    return Response(content=audio, media_type="audio/mpeg")


def drink_answer(g):
    """'Is the water drinkable?' from the live salinity, by code: the value, the verdict, and the safety caveat."""
    live = (g or {}).get("live") or {}
    devices = live.get("devices") or []
    d = next((x for x in devices if x.get("online")), devices[0] if devices else {})
    v = ((d.get("latestFresh") or {}).get("tds_ppm") or {}).get("value")
    if v is None:
        return "I have no salinity reading from the sensor right now, so I can't judge if the water is drinkable."
    limit = ((((g.get("thresholds") or {}).get("tds_ppm") or {}).get("reference")) or {}).get("max") or 1000
    fresh = d.get("latestFresh") or {}
    ph = (fresh.get("ph") or {}).get("value")
    temp = (fresh.get("temperature") or {}).get("value")
    when = "The readings now" if d.get("online") else f"The sensor's last readings, {d.get('minutesAgo')} minutes ago"
    # All the readings first (15 Nov, Roaa: "make it say the readings"), then the verdict
    readings = [f"salinity {round(v):,} parts per million"] + ([f"pH {round(ph, 1):g}"] if ph is not None else []) + \
               ([f"temperature {round(temp, 1):g} degrees"] if temp is not None else [])
    said = f"{when}: " + ", ".join(readings[:-1]) + (f", and {readings[-1]}" if len(readings) > 1 else readings[0]) + "."
    if v > limit:
        return (f"{said} No, the water is not drinkable: above {limit:g} parts per million it is too salty to drink "
                f"without treatment.")
    return (f"{said} By salinity, the water is drinkable, below the limit of {limit:g}. A laboratory test is still "
            f"needed to confirm it is safe.")


@app.get("/pepper/now")
async def pepper_now(what: str = "temperature"):
    """A live reading said at once, built by code from the sensor's latest value, no AI (15 Nov: Pepper's temperature
    answer must be very fast). what: temperature | salinity | ph.  -> {"answer"}"""
    try:
        g = await live_data()
    except Exception:
        return {"answer": "I can't reach the sensor data right now."}
    if what == "drink":                                        # 15 Nov: the filmed question, short and about drinking only
        return {"answer": drink_answer(g)}
    live = g.get("live") or {}
    devices = live.get("devices") or []
    d = next((x for x in devices if x.get("online")), devices[0] if devices else {})
    field, name, unit = {"temperature": ("temperature", "water temperature", "degrees Celsius"),
                         "ph": ("ph", "pH", ""), "salinity": ("tds_ppm", "salinity", "parts per million")}.get(
                             what, ("temperature", "water temperature", "degrees Celsius"))
    v = ((d.get("latestFresh") or {}).get(field) or {}).get("value")
    if v is None:
        return {"answer": f"There is no {name} reading from the sensor right now."}
    shown = f"{round(v, 1):g}" if field != "tds_ppm" else f"{round(v):,}"
    ago = d.get("minutesAgo")
    when = ("just now" if not ago else f"{ago} minutes ago") if d.get("online") else \
           f"but the sensor is offline; this is its last known value, from {ago} minutes ago"
    text = f"The {name} is {shown} {unit}".rstrip() + f", measured {when}." if d.get("online") else \
           f"The {name} was {shown} {unit}".rstrip() + f", {when}."
    # What it means: the dashboard's own range, and for salinity and pH AquaMaa's meanings table
    ref = ((g.get("thresholds") or {}).get(field) or {}).get("reference") or {}
    lo, hi = ref.get("min"), ref.get("max")
    if lo is not None or hi is not None:
        inside = (lo is None or v >= lo) and (hi is None or v <= hi)
        rng = f"{lo:g} to {hi:g}" if lo is not None and hi is not None else (f"up to {hi:g}" if hi is not None else f"from {lo:g}")
        text += f" That is {'within' if inside else 'outside'} the normal range of {rng}{' ' + unit if field == 'temperature' else ''}."
    if field in ("tds_ppm", "ph"):
        from fastpath.facts import meaning
        for use in ("drinking", "irrigation"):                 # what it means for drinking and for the farm
            m = meaning("tds" if field == "tds_ppm" else "ph", use, v, False)
            if m:
                text += f" For {use}: " + m.split(":", 1)[-1].split("[")[0].strip().rstrip(".") + "."
    return {"answer": text}


class PepperTopic(BaseModel):
    topic: str = Field(min_length=1, max_length=40)
    mode: str = Field(default="officer", max_length=10)


TOPICS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pepper_topics.json")


@app.post("/pepper/ask")
async def pepper_ask(t: PepperTopic):
    """Pepper sends only the topic it heard (a keyword) and its mode (officer or farmer); what to say or ask for it
    is in pepper_topics.json on this laptop, so it can change without updating Pepper (15 Nov).
    -> {"answer", "question"}"""
    mode = "farmer" if t.mode == "farmer" else "officer"
    topics = json.load(open(TOPICS_FILE, encoding="utf-8"))
    entry = topics.get(t.topic) or topics.get("salinity")
    if entry.get("say"):                                     # spoken as written: the story, goodbye
        return {"answer": entry["say"], "question": t.topic}
    question = entry.get(mode) or entry.get("officer")
    log.info("PEPPER    %s mode, topic '%s': %s", mode, t.topic, question)
    try:
        grounding = await live_data()
    except Exception as error:
        log.info("PEPPER    no live data (%s)", error)
        grounding = None
    if grounding is not None and mode == "farmer":
        try:
            grounding["clientContext"] = await asyncio.to_thread(dashboard.farm_context, grounding)
        except Exception as error:
            log.info("PEPPER    no farm wells (%s)", error)
    intent = entry.get("intent")                          # the topic decides the type of answer: fast and predictable
    async with one_at_a_time:
        r = await asyncio.to_thread(lambda: ask(question, True, mode, grounding, intent=intent))
    return {"answer": r["answer"], "question": question}


@app.get("/tablet", response_class=HTMLResponse)
def tablet_page():
    """A simple live sensor page for Pepper's tablet, for when its old browser can't show Deema's dashboard."""
    return PAGE


@app.get("/live")
async def live_now():
    """The tablet page's data: current readings, status, the salinity series and the latest alert."""
    g = latest["grounding"]
    if g is None:
        try:
            g = latest["grounding"] = await asyncio.to_thread(dashboard.grounding)
        except Exception:
            g = {}
    return live_summary(g, list(watcher.messages))


@app.get("/health")
def health():
    return {"status": "ok", "model": CHAT_MODEL}


@app.post("/ask")
async def ask_endpoint(q: Question, x_aquamaa_key: Optional[str] = Header(default=None)):
    if API_KEY and x_aquamaa_key != API_KEY:
        raise HTTPException(status_code=401, detail="Missing or wrong X-AquaMaa-Key")
    question = re.sub(r"\s+", " ", q.question).strip()
    log.info("API       question from role=%s: %s", q.role or "-", question)
    grounding = q.grounding
    if grounding is None and q.live:
        try:
            grounding = await live_data()
        except Exception as error:                         # no live data: the agent says there is no current reading
            log.info("API       couldn't fetch the dashboard's live data for this question: %s", error)
    async with one_at_a_time:                              # one model job at a time
        # the role picks the persona (farmer or officer); the grounding gives the live sensor readings
        r = await asyncio.to_thread(ask, question, True, q.role, grounding)
    return {
        "answer": r["answer"],
        "sources": sources_of(r.get("tagged_answer") or r["answer"]),
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
