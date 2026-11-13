"""The guessing layer (13 Nov): when words in a question don't fit, guess what the person actually meant.

Speech recognition and typing produce real-looking wrong words (الآبار heard as الغبار or الإضرار, "wells" typed as
"wheels"). No word lists are written by hand:
  1. AquaMaa's own vocabulary is built from its data: the fast-path example questions, knowledge cards, places,
     crops, meanings and the glossary
  2. code finds the suspect words: words NOT in the vocabulary that look or sound close to a word that is
     (Arabic letters normalised: hamza forms, ta marbuta, alef maqsura, diacritics), each with its closest candidates
  3. only if there are suspects, one short model call decides in context which ones are mistakes, and writes the
     intended question; words that make sense stay ("ما آثار الملوحة" keeps آثار)
  4. a safety check keeps the original when the guess changes too much
Used for every question in agent.ask() (the answer then says how it was understood) and for spoken questions by
POST /clean (clean_transcript.py).
Test:  python guess.py "كم عدد الغبار في سدرية الخيسة؟" "how many wheels are in al khor"
"""
import csv
import json
import re
import sys
import time
from difflib import SequenceMatcher
from pathlib import Path

from langchain_core.messages import HumanMessage
from langchain_ollama import ChatOllama

from config import CHAT_MODEL, OLLAMA_URL
from understand import DIALECT_WORDS

ROOT = Path(__file__).parent
CANDIDATE_SIMILARITY = 0.72     # how close a word must look to a vocabulary word to be a suspect
MIN_SIMILARITY = 0.6            # the guess must stay this close to the question, or the original is kept
TASHKEEL = re.compile(r"[ً-ْـ]")
WORD = re.compile(r"[A-Za-z0-9ء-ي٠-٩]+")   # letters and digits only, no "؟" or "،"


def norm(word):
    """Arabic spelling variants made equal, so only real differences count."""
    w = TASHKEEL.sub("", word.lower())
    return w.translate(str.maketrans("أإآٱةى", "ااااهي"))


def _vocabulary():
    texts = []
    sources = [("fastpath/data/intent_questions.csv", ["question"]),
               ("fastpath/data/knowledge_cards.csv", ["question_en", "question_ar", "fact_en", "fact_ar"]),
               ("fastpath/data/places.csv", ["name_ar", "name_en"]),
               ("fastpath/data/crop_tolerance.csv", ["crop_en", "crop_ar"]),
               ("fastpath/data/meanings.csv", ["meaning_en", "meaning_ar", "advice_en", "advice_ar"]),
               ("database/09-glossary/glossary.csv", ["term_en", "term_ar"])]
    for path, columns in sources:
        p = ROOT / path
        if p.exists():
            for row in csv.DictReader(p.open(encoding="utf-8-sig")):
                texts += [row.get(c) or "" for c in columns]
    core = _spelled(texts)                    # AquaMaa's own words: the only source of suggested replacements
    # Ordinary words, only to recognise them as correct, never suggested (13 Nov: "suitable" became "table", and
    # "الموجودة" was offered "المتجددة"): every word used at least twice in the knowledge base's passages, and the
    # dialect words the dialect layer knows
    general = [" ".join(re.findall(r"[ء-ي]+", DIALECT_WORDS.pattern))]
    chunks = ROOT / "chunks.jsonl"
    if chunks.exists():
        counts = {}
        for line in chunks.open(encoding="utf-8"):
            for w in WORD.findall(json.loads(line).get("text", "")):
                counts[w] = counts.get(w, 0) + 1
        general.append(" ".join(w for w, c in counts.items() if c >= 2))
    return core, set(core) | set(_spelled(general))


def _spelled(texts):
    spelled = {}                              # normalised form -> the word as written in AquaMaa's data
    for t in texts:
        for w in WORD.findall(t):
            if len(w) >= 3:
                spelled.setdefault(norm(w), w)
                if w.startswith("ال") and len(w) > 4:
                    spelled.setdefault(norm(w[2:]), w[2:])          # also without "ال"
    return spelled


SPELLED, VOCAB = _vocabulary()               # SPELLED: core words to suggest; VOCAB: every word known as correct
VOCAB_LIST = sorted(SPELLED)
model = ChatOllama(model=CHAT_MODEL, temperature=0, reasoning=False, base_url=OLLAMA_URL, num_predict=120,
                   keep_alive="2h")

PROMPT = """You help AquaMaa, an assistant about groundwater wells, water quality, farms and sensors in Qatar.
The question below came from speech recognition or typing. Some words may be mistakes: real words that look or sound
like the intended ones. For each suspect word, decide: keep it, or replace it with ONE of its candidates.
Most suspect words are correct. Replace one only if the question makes no sense with it, for this assistant.
Answer one line per suspect word, exactly as:  word = choice   (choice is the word itself, or one of its candidates)
Examples:
Question: how many wheels are in the north     Suspects: wheels: wells / where
wheels = wells
Question: ما آثار الملوحة على النخيل     Suspects: آثار: أكثر / آبار
آثار = آثار
Question: {text}
Suspects: {suspects}
"""


PREFIXES = ("وال", "بال", "فال", "كال", "لل", "ال", "و", "ف", "ب", "ل", "ك")
SUFFIXES = ("تها", "ته", "تهم", "هما", "هم", "ها", "ه", "ي", "نا", "ك", "ات", "ون", "ين", "ة")


def known(n):
    """A word AquaMaa knows, also with Arabic prefixes or endings removed (بئري, ملوحته, يحفر, والملوحة)."""
    if n in VOCAB:
        return True
    forms = {n}
    for p in PREFIXES:
        if n.startswith(norm(p)) and len(n) - len(p) >= 3:
            forms.add(n[len(p):])
    for f in list(forms):
        for s in SUFFIXES:
            if f.endswith(norm(s)) and len(f) - len(s) >= 3:
                stem = f[:-len(s)]
                forms.add(stem)
                if stem.endswith("ت"):                 # ملوحة + ه = ملوحته: the ة became ت
                    forms.add(stem[:-1] + "ه")
    forms |= {f[1:] for f in forms if f[:1] in "يتنا" and len(f) >= 4}      # verb prefixes: يحفر -> حفر
    return any(f in VOCAB or ("ال" + f) in VOCAB for f in forms)


def suspects(text):
    """Words that aren't AquaMaa words but look like one: {word: [closest vocabulary words]}."""
    out = {}
    for w in WORD.findall(text):
        n = norm(w)
        if len(n) < 3 or n.isdigit() or known(n):
            continue
        scored = sorted(((SequenceMatcher(None, n, v).ratio(), v) for v in VOCAB_LIST if abs(len(v) - len(n)) <= 3),
                        reverse=True)
        close = [SPELLED[v] for s, v in scored[:3] if s >= CANDIDATE_SIMILARITY]
        if close:
            out[w] = close
    return out


def guess(text):
    """(the intended question, changed?, suspects, seconds). No model call when no word is suspect."""
    text = (text or "").strip()
    found = suspects(text)
    if not found:
        return text, False, {}, 0.0
    start = time.time()
    listed = "; ".join(f"{w}: {' / '.join(c)}" for w, c in found.items())
    reply = model.invoke([HumanMessage(PROMPT.format(text=text, suspects=listed))]).content
    # Only the suspect words can change, and only into one of their own candidates: the model can't add, drop or
    # reword anything else (13 Nov: a free rewrite added "المتجددة" and changed "شنو" and "بئري")
    out = text
    for line in reply.splitlines():
        if "=" not in line:
            continue
        word, choice = (part.strip().strip('"“”') for part in line.split("=", 1))
        if word in found and choice in found[word]:
            out = re.sub(rf"(?<![\wء-ي]){re.escape(word)}(?![\wء-ي])", choice, out)
    return out, out != text, found, round(time.time() - start, 1)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    print(f"Vocabulary: {len(VOCAB)} words\n")
    for q in sys.argv[1:] or ["كم عدد الغبار في سدرية الخيسة؟", "ما آثار الملوحة على النخيل؟", "how many wheels are in al khor"]:
        g, changed, found, s = guess(q)
        print(f"Asked:   {q}\nSuspect: {found}\nGuess:   {g}\nChanged: {changed}, {s} s\n")
