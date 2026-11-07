"""Compares vector, BM25 and hybrid search on the Milestone 2 questions, and tries the structured lookup.

Run: python compare_retrieval.py
"""
import sys

from eval_kb import TESTS
from retrieval import Retrievers

sys.stdout.reconfigure(encoding="utf-8")
K = 3


def first_rank(hits, expected):
    return next((i for i, h in enumerate(hits, start=1) if h["file"] in expected), None)


r = Retrievers()
totals = {"vector": 0, "bm25": 0, "hybrid": 0}
print(f"Rank of the first right file (top 10). '-' means not found.\n")
print(f"{'vector':>6} {'bm25':>5} {'hybrid':>6}  question")
for question, expected in TESTS:
    ranks = {m: first_rank(getattr(r, m)(question, k=10), expected) for m in totals}
    for m, rank in ranks.items():
        totals[m] += rank is not None and rank <= K
    cells = " ".join(f"{str(ranks[m] or '-'):>{w}}" for m, w in (("vector", 6), ("bm25", 5), ("hybrid", 6)))
    print(f"{cells}  {question[:70]}")
print("\nIn the top 3: " + ", ".join(f"{m} {n}/{len(TESTS)}" for m, n in totals.items()))

print("\nStructured lookup:")
for query, conditions in [("total abstraction from groundwater", ["year=2019"]),
                          ("total abstraction from groundwater", ["2019", "2023"]),
                          ("TDS irrigation limit FAO", []),
                          ("population Al Rayyan", ["year=2020"])]:
    hits = r.structured(query, conditions, k=3)
    print(f"  {query} {conditions}")
    for h in hits:
        print(f"    {h['file']} row {h['page']}: {h['text'][:110]}")
