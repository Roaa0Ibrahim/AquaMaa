"""Which kind of question is this? Compared by meaning (bge-m3) with example questions, in English, Arabic and dialect.

Intents: live_reading, trend, suitability, law, explain (statistics and everything else go to the deep path).
Examples: fastpath/data/intent_questions.csv (Roaa's draft) and, when Mais sends hers, handoff/mais/1_intent_questions.csv.
No model call: one embedding of the question, compared with the stored examples (about 0.2 s).
"""
import csv
from pathlib import Path

from langchain_ollama import OllamaEmbeddings

from config import EMBED_MODEL, OLLAMA_URL
from key_stats import cosine

ROOT = Path(__file__).parent.parent
EXAMPLE_FILES = [ROOT / "fastpath" / "data" / "intent_questions.csv", ROOT / "handoff" / "mais" / "1_intent_questions.csv"]
FAST_INTENTS = {"live_reading", "trend", "suitability", "law", "explain"}
MIN_SIMILARITY = 0.62           # below this the question is not close enough to any example: deep path

embeddings = OllamaEmbeddings(model=EMBED_MODEL, base_url=OLLAMA_URL)
_examples = []                  # (intent, question, vector), loaded on first use


def examples():
    if not _examples:
        rows = []
        for path in EXAMPLE_FILES:
            if path.exists():
                rows += [r for r in csv.DictReader(path.open(encoding="utf-8-sig"))
                         if r.get("intent") in FAST_INTENTS and r.get("question")]
        vectors = embeddings.embed_documents([r["question"] for r in rows])
        _examples.extend((r["intent"], r["question"], v) for r, v in zip(rows, vectors))
    return _examples


def detect(question):
    """(intent, similarity, closest example), or (None, similarity, example) when no intent is close enough."""
    q = embeddings.embed_query(question)
    best = max(((cosine(q, v), intent, text) for intent, text, v in examples()), key=lambda x: x[0])
    score, intent, text = best
    return (intent if score >= MIN_SIMILARITY else None), round(score, 3), text
