"""Fixes speech-recognition mistakes in a spoken question before it goes to the AI (13 Nov: "الآبار في سدرية
الخيسة" was heard as "الإضرار في منطقة سدرية الخيسر").

One short call to the chat model, told the context (wells and water in Qatar), the usual words and Qatar's places
(fastpath/data/places.csv). It changes only misheard words, never the meaning or the language. A safety check keeps
the original when the result is too different, so a question can't be rewritten into another one.
Used by POST /clean in api.py, which the website chat box calls after speech recognition (public/speech.js).
Test:  python clean_transcript.py "كم عدد الإضرار الموجودة في منطقة سدرية الخيسر"
"""
import csv
import re
import sys
import time
from difflib import SequenceMatcher
from pathlib import Path

from langchain_core.messages import HumanMessage
from langchain_ollama import ChatOllama

from config import CHAT_MODEL, OLLAMA_URL

PLACES = list(csv.DictReader((Path(__file__).parent / "fastpath" / "data" / "places.csv").open(encoding="utf-8-sig")))
MIN_SIMILARITY = 0.6            # below this the "correction" changed too much: keep what was heard
model = ChatOllama(model=CHAT_MODEL, temperature=0, reasoning=False, base_url=OLLAMA_URL, num_predict=120,
                   keep_alive="2h")

PROMPT = """A farmer or water officer in Qatar asked a question by voice, and speech recognition wrote it down with
some words misheard. Correct only the misheard words. Keep the meaning, the language and the dialect; don't answer the
question, don't add anything, don't translate.
Usual words: آبار، بئر، البير، ماي، مياه جوفية، ملوحة، مالح، حموضة، درجة الحرارة، ري، سقي، نخيل، شعير، طماطم، مزرعة،
ترخيص، حساس، قراءة، wells, salinity, TDS, pH, irrigation, date palms, licence, sensor.
Places in Qatar: {places}
A place name that sounds close to one in this list was misheard: write the name from the list.
The question is always about wells, water, farms or sensors: a word that doesn't fit (dust, damage, news) is a
misheard water word, usually الآبار.
Examples:
"كم عدد الإضرار الموجودة في الخور" -> "كم عدد الآبار الموجودة في الخور"
"ملوحة الماي في مزارع الذخيره والشحانيه" -> "ملوحة الماي في مزارع الذخيرة والشحانية"
"how salty are the wells in a rayan" -> "how salty are the wells in Al Rayyan"
Heard: {text}
Corrected question only:"""


# Words speech recognition often writes instead of الآبار (wells). After "عدد" or "كم" they make no sense in a
# question to AquaMaa, so they are replaced in code before the model sees the text (13 Nov: الإضرار, then الغبار).
WELLS_HEARD_AS = re.compile(r"((?:عدد|كم)\s+)(الغبار|غبار|الإضرار|الاضرار|الأضرار|أضرار|الأخبار|الاخبار|الأحبار|الاحبار)")


def clean(text):
    """(corrected text, changed?, seconds)."""
    original = (text or "").strip()
    if len(original) < 3:
        return original, False, 0.0
    start = time.time()
    text = WELLS_HEARD_AS.sub(r"\1الآبار", original)
    places = "، ".join(f"{p['name_ar']} ({p['name_en']})" for p in PLACES)
    out = model.invoke([HumanMessage(PROMPT.format(places=places, text=text))]).content.strip()
    out = out.strip('"“”').splitlines()[0].strip() if out else text
    similar = SequenceMatcher(None, text, out).ratio()
    if not out or similar < MIN_SIMILARITY:
        out = text                                      # keep the code's own fix, drop the model's
    return out, out != original, round(time.time() - start, 1)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    for heard in sys.argv[1:] or ["كم عدد الإضرار الموجودة في منطقة سدرية الخيسر؟ وهل المياه صالحة للشرب أم لا؟"]:
        fixed, changed, seconds = clean(heard)
        print(f"Heard:     {heard}\nCorrected: {fixed}\nChanged: {changed}, {seconds} s\n")
