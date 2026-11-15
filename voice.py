"""Natural neural voices for spoken answers on the website (14 Nov), any browser.

The browser's own Arabic voices in Chrome on Windows sound robotic. edge-tts gives Microsoft's neural voices,
including Qatari Arabic (ar-QA-AmalNeural, female; ar-QA-MoazNeural, male). The answer's text, already cleaned for
speaking by the website (units spelled out, no source tags), is sent to Microsoft's speech service and comes back as
MP3. If it fails (no internet), the website falls back to the browser's own voice.
Voices can be changed with AQUAMAA_VOICE_AR and AQUAMAA_VOICE_EN.
Test:  python voice.py "ملوحة الماء 1800 مليغرام لكل لتر"   (writes logs/voice_test.mp3)
"""
import asyncio
import os
import re
import sys

import edge_tts

from arabic_text import speakable_ar

VOICES = {"ar": os.environ.get("AQUAMAA_VOICE_AR", "ar-QA-AmalNeural"),
          "en": os.environ.get("AQUAMAA_VOICE_EN", "en-GB-SoniaNeural")}
RATE = {"ar": "-5%", "en": "+0%"}          # Arabic a little slower, easier to follow


def language_of(text):
    return "ar" if re.search(r"[؀-ۿ]", text or "") else "en"


async def speak(text, lang=None):
    """MP3 bytes of the text in the most natural voice for its language."""
    lang = lang if lang in VOICES else language_of(text)
    if lang == "ar":
        text = speakable_ar(text)              # units said as words: ملغم/لتر -> مليغرام لكل لتر (arabic_text.py)
    audio = bytearray()
    async for chunk in edge_tts.Communicate(text, VOICES[lang], rate=RATE[lang]).stream():
        if chunk.get("type") == "audio":
            audio.extend(chunk["data"])
    return bytes(audio)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    text = " ".join(sys.argv[1:]) or "ملوحة الماء 1800 مليغرام لكل لتر. هذه المياه مناسبة لري النخيل."
    data = asyncio.run(speak(text))
    os.makedirs("logs", exist_ok=True)
    open("logs/voice_test.mp3", "wb").write(data)
    print(f"{len(data)} bytes, voice {VOICES[language_of(text)]} -> logs/voice_test.mp3")
