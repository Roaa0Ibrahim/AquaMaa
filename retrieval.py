"""Milestone 3: the retrieval methods.

- vector:     bge-m3 meaning search over the document chunks (built by build_kb.py)
- bm25:       keyword search over the same chunks, for exact terms
- hybrid:     both, merged with reciprocal rank fusion (RRF)
- structured: exact rows from the data tables, filtered by the router's conditions (e.g. year=2019)

Usage:
    r = Retrievers()
    r.hybrid("What is the safe yield?", k=5)
    r.structured("groundwater abstraction", conditions=["year=2019"])
"""
import csv
import json
import re
from pathlib import Path

from langchain_core.vectorstores import InMemoryVectorStore
from langchain_ollama import OllamaEmbeddings
from rank_bm25 import BM25Okapi

from config import EMBED_MODEL, OLLAMA_URL

ROOT = Path(__file__).parent
DATABASE = ROOT / "database"
VECTOR_FILE = ROOT / "vector_store.json"
CHUNKS_FILE = ROOT / "chunks.jsonl"

# Tables whose rows become facts. Glossary, misconceptions and policy goals are already chunks.
FACT_TABLES = {"DS-01", "DS-04", "DS-09", "DS-16", "DS-17", "LIM", "DS-30", "DS-67"}
SKIP_COLUMNS = {"source_publisher", "source_url", "source_license", "retrieved_on", "source_id", "source_title"}
STOPWORDS = set("""a all an and are across as at be by can did do does for from has have how in is it its many
much of on or that the their there this to was were what when where which who why with qatar""".split())
MIN_COVERAGE = 0.5   # a table row must contain at least half the question's key words, weighted by rarity
# Units written out, so the model doesn't read "mm3" as cubic millimetres or cubic metres
UNIT_NAMES = {"ground_water_abstraction_mm3": "groundwater_abstraction_million_m3"}
VALUE_UNITS = {"DS-04": "million m3"}   # tables whose "value" column has one unit for every row
# OPERATION_WORDS (below, after stem) say what to do with the data, not what it is about,
# so they are left out of the coverage check.
YEAR = re.compile(r"\b(19|20)\d{2}\b")


def stem(word):
    """Very light stemming, so "wells" matches "well" and "municipalities" matches "municipality"."""
    if len(word) > 4 and word.endswith("ies"):
        return word[:-3] + "y"
    if len(word) > 3 and word.endswith("s") and not word.endswith("ss"):
        return word[:-1]
    return word


OPERATION_WORDS = {stem(w) for w in """average mean total sum compare comparison measured measure percentage percent
change changed between difference trend list value level rate year""".split()}


def tokenize(text):
    """Lowercase, lightly stemmed words, without common words. \\w also matches Arabic letters."""
    return [stem(w) for w in re.findall(r"\w+", text.lower()) if w not in STOPWORDS]


def is_arabic(text):
    return any("؀" <= ch <= "ۿ" for ch in text)


def years_in(items):
    return sorted({int(m.group(0)) for item in items for m in YEAR.finditer(str(item))})


class Retrievers:
    def __init__(self):
        self.chunks = [json.loads(line) for line in CHUNKS_FILE.open(encoding="utf-8")]
        self.bm25_index = BM25Okapi([tokenize(c["text"]) for c in self.chunks])
        if not VECTOR_FILE.exists() or not CHUNKS_FILE.exists():
            raise SystemExit("The knowledge base hasn't been built yet. Run: python build_kb.py")
        self.vectors = InMemoryVectorStore.load(str(VECTOR_FILE),
                                                embedding=OllamaEmbeddings(model=EMBED_MODEL, base_url=OLLAMA_URL))
        self.facts = self._load_facts()
        self.facts_index = BM25Okapi([tokenize(f["text"]) for f in self.facts])

    # Document chunks -------------------------------------------------------------------
    def bm25(self, query, k=5):
        scores = self.bm25_index.get_scores(tokenize(query))
        top = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:k]
        return [dict(self.chunks[i], score=float(scores[i]), method="bm25") for i in top if scores[i] > 0]

    def vector(self, query, k=5):
        hits = self.vectors.similarity_search_with_score(query, k=k)
        return [dict(text=d.page_content, **d.metadata, score=float(s), method="vector") for d, s in hits]

    def hybrid(self, query, k=5, rrf_k=60):
        """Reciprocal rank fusion: score = sum of 1 / (60 + rank) across the two methods.
        A chunk ranked high by either method rises, and one ranked high by both rises most."""
        fused = {}
        for results in (self.bm25(query, k * 4), self.vector(query, k * 4)):
            for rank, hit in enumerate(results, start=1):
                key = (hit["file"], hit["page"], hit["text"][:80])
                entry = fused.setdefault(key, dict(hit, score=0.0, method="hybrid"))
                entry["score"] += 1 / (rrf_k + rank)
        return sorted(fused.values(), key=lambda h: h["score"], reverse=True)[:k]

    # Data tables -----------------------------------------------------------------------
    def _load_facts(self):
        sources = json.loads((DATABASE / "sources.json").read_text(encoding="utf-8"))
        facts = []
        for source in sources:
            if source["id"] not in FACT_TABLES:
                continue
            for file_name in source["files"]:
                path = DATABASE / source["folder"] / file_name
                for number, row in enumerate(csv.DictReader(path.open(encoding="utf-8-sig")), start=2):
                    fields = {UNIT_NAMES.get(k, k): v for k, v in row.items()
                              if k not in SKIP_COLUMNS and v and not is_arabic(v)}
                    if source["id"] in VALUE_UNITS and "value" in fields:
                        fields["unit"] = VALUE_UNITS[source["id"]]
                    text = source["title"] + ". " + "; ".join(f"{k}: {v}" for k, v in fields.items())
                    facts.append(dict(text=text, fields=fields, source_id=source["id"], title=source["title"],
                                      publisher=source["publisher"], url=source["url"], licence=source["licence"],
                                      file=file_name, page=number, method="structured"))
        return facts

    def structured(self, query, conditions=(), k=5):
        """Exact table rows. Year conditions filter rows; a year range keeps every year in it.
        Returns [] when no row matches, so the caller can try the next method."""
        wanted = years_in(conditions) or years_in([query])
        terms = {t for t in tokenize(query) if not YEAR.fullmatch(t) and t not in OPERATION_WORDS}
        # Rare words carry the meaning, so coverage is weighted by IDF. A word no table contains
        # gets the highest weight, so a row missing it (e.g. "aquifer") can't pass on common words.
        idf = self.facts_index.idf
        top_idf = max(idf.values())
        weight = {t: max(idf.get(t, top_idf), 0.01) for t in terms}
        scores = self.facts_index.get_scores(tokenize(query))
        ranked = sorted(range(len(self.facts)), key=lambda i: scores[i], reverse=True)
        hits = []
        for i in ranked:
            if scores[i] <= 0:
                break
            fact = self.facts[i]
            fact_terms = set(tokenize(fact["text"]))
            covered = sum(w for t, w in weight.items() if t in fact_terms) / sum(weight.values()) if terms else 1
            if covered < MIN_COVERAGE:
                continue                       # too weak a match: let the next method answer
            fact_years = years_in([fact["fields"].get("year", ""), fact["fields"].get("census_year", "")])
            if wanted and fact_years:
                in_range = wanted[0] <= fact_years[0] <= wanted[-1] if len(wanted) > 1 else fact_years[0] in wanted
                if not in_range:
                    continue
            hits.append(dict(fact, score=float(scores[i])))
            if len(hits) == k:
                break
        return hits
