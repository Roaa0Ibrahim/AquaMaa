"""Speech to text with Fanar (QCRI), for spoken questions on the website (14 Nov).

The browser's own recognition (Google) merged Gulf Arabic words: «شكثر الاملاح في بيري؟» came out as
«إيش كثر الكبيري؟», and no text correction can bring back a lost word. Fanar's Aura model is trained on Arabic,
including dialects, so the website now sends the recorded audio here; the text then goes through the same
correction as before (clean_transcript.py). If Fanar fails or its daily limit is reached (50 a day by default),
the browser keeps Google's text, so speech still works.
Audio: a WAV file (the website converts its recording to 16 kHz mono). Only the audio of the question is sent.
Test:  python transcribe.py recording.wav
"""
import sys
import time

import httpx

from config import FANAR_API_KEY

URL = "https://api.fanar.qa/v1/audio/transcriptions"
MODEL = "Fanar-3.0-Aura-Transcribe"
TIMEOUT = 15


def transcribe(audio: bytes, filename="question.wav"):
    """(text, seconds). Raises httpx.HTTPError if Fanar fails, so the caller can fall back."""
    start = time.time()
    r = httpx.post(URL, timeout=TIMEOUT, headers={"Authorization": f"Bearer {FANAR_API_KEY}"},
                   files={"file": (filename, audio, "audio/wav")}, data={"model": MODEL, "format": "text"})
    r.raise_for_status()
    body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {"text": r.text}
    return (body.get("text") or "").strip(), round(time.time() - start, 1)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    for path in sys.argv[1:]:
        text, seconds = transcribe(open(path, "rb").read())
        print(f"{path}: {text}  ({seconds} s)")
