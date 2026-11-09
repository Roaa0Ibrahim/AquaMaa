"""Milestone 4, step 4: add one or two key statistics under an answer, only when they help.

1. Shortlist: bge-m3 compares the question and answer with each statistic's "when it helps" line.
2. Skip: statistics whose value the answer already states, and anything below the similarity threshold.
3. Gate: Qwen decides which shortlisted figures would help an officer understand the answer (at most 2, or none).
4. The figures come straight from database/11-key-statistics/key_statistics.csv, never from the model.

Usage: from key_stats import select_figures;  figures = select_figures(question, answer)
Test:  python key_stats.py
"""
import csv
import logging
import math
from pathlib import Path

from langchain_ollama import ChatOllama, OllamaEmbeddings
from pydantic import BaseModel, Field

from config import CHAT_MODEL, EMBED_MODEL, OLLAMA_URL

STATS_FILE = Path(__file__).parent / "database" / "11-key-statistics" / "key_statistics.csv"
SHORTLIST = 3          # candidates shown to the gate
MAX_FIGURES = 2
MIN_SIMILARITY = 0.45  # bge-m3 cosine similarity; below this a statistic is not considered (tune on the dev set)

log = logging.getLogger("agent")
embeddings = OllamaEmbeddings(model=EMBED_MODEL, base_url=OLLAMA_URL)
gate_model = ChatOllama(model=CHAT_MODEL, temperature=0, reasoning=False, base_url=OLLAMA_URL)

STATS = list(csv.DictReader(STATS_FILE.open(encoding="utf-8-sig")))
_stat_vectors = []     # embedded on first use, so the program starts even if the model is down


def stat_vectors():
    if not _stat_vectors:
        _stat_vectors.extend(embeddings.embed_documents(
            [f"{s['statistic']}. Helps with {s['when_it_helps']}" for s in STATS]))
    return _stat_vectors


class Choice(BaseModel):
    """Which shortlisted statistics to show under the answer."""
    reason: str = Field(description="One sentence on why the chosen figures help, or why none do")
    chosen: list[str] = Field(description="stat_id values that would help an officer understand the answer, "
                                          "at most 2. Empty if none would help")


GATE_PROMPT = """An officer asked: {question}

The answer given: {answer}

Candidate key statistics:
{candidates}

Choose at most 2 statistics that would help the officer understand or put the answer in context.
Choose only figures directly about the question's subject. When a statistic is the closest figure available for
what is asked, choose it, for example the farm census count of wells for "how many wells does Qatar have"; the
answer will say what it covers. Choose none if none would clearly help."""


def cosine(a, b):
    return sum(x * y for x, y in zip(a, b)) / (math.sqrt(sum(x * x for x in a)) * math.sqrt(sum(y * y for y in b)))


def already_stated(stat, answer):
    """True if the answer already gives this statistic's value."""
    value = stat["value"].replace("about", "").replace("up to", "").replace(",", "").split("/")[0].strip()
    return value and value in answer.replace(",", "")


def label(stat):
    return f"[{stat['source_file']} {stat['location']}]"


def as_line(stat):
    year = f" ({stat['year']})" if stat["year"] else ""
    return f"{stat['statistic']}: {stat['value']} {stat['unit']}{year} {label(stat)}"


def select_figures(question, answer):
    """Returns at most 2 statistics (rows of key_statistics.csv) that help this answer, or []."""
    query = embeddings.embed_query(f"{question} {answer}")
    scored = sorted(((cosine(query, v), s) for v, s in zip(stat_vectors(), STATS)), key=lambda x: x[0], reverse=True)
    shortlist = [(score, s) for score, s in scored if score >= MIN_SIMILARITY and not already_stated(s, answer)][:SHORTLIST]
    log.info("KEYSTATS  shortlist: %s", [(s["stat_id"], round(score, 2)) for score, s in shortlist] or "none above threshold")
    if not shortlist:
        return []
    candidates = "\n".join(f"- {s['stat_id']}: {s['statistic']} = {s['value']} {s['unit']} ({s['year']})"
                           for _, s in shortlist)
    choice = gate_model.with_structured_output(Choice).invoke(
        [{"role": "user", "content": GATE_PROMPT.format(question=question, answer=answer, candidates=candidates)}])
    allowed = {s["stat_id"]: s for _, s in shortlist}
    chosen = [allowed[i] for i in choice.chosen if i in allowed][:MAX_FIGURES]
    log.info("KEYSTATS  chose %s: %s", [s["stat_id"] for s in chosen] or "none", choice.reason)
    return chosen


if __name__ == "__main__":
    import sys
    sys.stdout.reconfigure(encoding="utf-8")
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    tests = [
        ("How many agricultural wells are there in Qatar?", "The documents do not give the number of agricultural wells."),
        ("What share of groundwater is used by agriculture?", "The evidence does not give the share."),
        ("Why does high SAR damage soil?", "High SAR makes soil seal up so water soaks in poorly [glossary.csv p.10]."),
    ]
    for q, a in tests:
        print(f"\nQ: {q}")
        for s in select_figures(q, a):
            print("  ", as_line(s))
