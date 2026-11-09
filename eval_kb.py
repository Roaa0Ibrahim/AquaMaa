"""Milestone 2 check: does a search return the right file for each test question?

Run after build_kb.py: python eval_kb.py
Passes when every question finds its expected file in the top K results.
The rank of the first right result is printed too: Milestone 3 aims to bring it into the top 3.
"""
import sys
from pathlib import Path

from langchain_core.vectorstores import InMemoryVectorStore
from langchain_ollama import OllamaEmbeddings

from config import EMBED_MODEL

sys.stdout.reconfigure(encoding="utf-8")
VECTOR_FILE = Path(__file__).parent / "vector_store.json"
K = 10

# question, files that answer it (any one counts)
TESTS = [
    ("What is the safe yield of Qatar's groundwater?", ["NPC_Water_Statistics_2023.txt"]),
    ("How much groundwater was abstracted in 2023, and why did the estimate change?", ["Kahramaa_Statistics_Report_2023.txt", "NPC_Water_Statistics_2023.txt"]),
    ("Which TDS levels put a slight to moderate restriction on irrigation water?", ["FAO_29_Water_Quality_for_Agriculture_ch1-5.txt"]),
    ("What turbidity is required for drinking water at disinfection?", ["Kahramaa_Drinking_Water_Quality_Requirements_2014.txt"]),
    ("Is there a health-based guideline value for total dissolved solids?", ["WHO_TDS_background_document.txt", "misconceptions.csv"]),
    ("What share of groundwater samples are unsuitable for agricultural irrigation?", ["QEERI_2022_Qatar_Groundwater_Challenges.txt"]),
    ("How many groundwater recharge wells is Qatar building?", ["Qatar_NDC_3.txt"]),
    ("What is the national target for reducing groundwater extraction?", ["Qatar_NDS3.txt", "NPC_NDS3_Strategic_Outcomes.txt", "policy-goals.csv"]),
    ("What is the measurement range of the analog TDS sensor?", ["DFRobot_SEN0244_TDS.txt"]),
    ("ما هي نسبة امتزاز الصوديوم وكيف تؤثر على التربة؟", ["glossary.csv", "FAO_29_Water_Quality_for_Agriculture_ch1-5.txt"]),
]


def main():
    store = InMemoryVectorStore.load(str(VECTOR_FILE), embedding=OllamaEmbeddings(model=EMBED_MODEL))
    passed = 0
    for question, expected in TESTS:
        results = store.similarity_search(question, k=K)
        ranks = [i for i, doc in enumerate(results, start=1) if doc.metadata["file"] in expected]
        ok = bool(ranks)
        passed += ok
        rank = f"first right result at rank {ranks[0]}" if ok else f"not in the top {K}"
        top = ", ".join(f"{d.metadata['file']} p.{d.metadata['page']}" for d in results[:3])
        print(f"{'PASS' if ok else 'FAIL'}  {question}\n      {rank}; top 3: {top}")
    print(f"\n{passed}/{len(TESTS)} found the right file in the top {K}")


if __name__ == "__main__":
    main()
