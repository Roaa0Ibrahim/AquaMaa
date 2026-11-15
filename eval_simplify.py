"""Milestone 6 check: farmer questions in English and Arabic, before and after simplification.

For each question in tests/m6_farmer_questions.csv: the checked answer (before), the answer shown (after), whether the
rewrite passed its Python checks (same numbers, same sources, same language, short), and the answer's language.
The saved file is also the sheet for the 3 non-technical readers: they read the "after" answers.
Needs Ollama. Questions run one at a time.
Run:  python eval_simplify.py        Results: logs/eval_simplify.json
"""
import csv
import json
import sys
from pathlib import Path

from agent import ask
from checks import agent_text
from verifier import arabic_share, sentences

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).parent
rows = list(csv.DictReader((ROOT / "tests" / "m6_farmer_questions.csv").open(encoding="utf-8-sig")))

results = []
for row in rows:
    r = ask(row["question"])
    shown = agent_text(r["answer"]).strip()
    language_ok = (arabic_share(shown) > 0.5) == (row["language"] == "ar")
    results.append(dict(id=row["id"], kind=row["kind"], language=row["language"], question=row["question"],
                        simplified=r["simplified"], language_ok=language_ok, sentences=len(sentences(shown)),
                        before=r["checked_answer"], after=r["answer"], note=r["simplify_note"], seconds=r["seconds"]))
    print(f"\n{row['id']} [{row['language']}, {row['kind']}] simplified={r['simplified']} "
          f"language_ok={language_ok} ({r['seconds']} s)\nQ: {row['question']}\nBEFORE: {r['checked_answer']}\n"
          f"AFTER:  {r['answer']}" + (f"\nNOTE:   {r['simplify_note']}" if r["simplify_note"] else ""))
    (ROOT / "logs").mkdir(exist_ok=True)
    json.dump(results, open(ROOT / "logs" / "eval_simplify.json", "w", encoding="utf-8"), indent=1, ensure_ascii=False)

used = sum(r["simplified"] for r in results)
lang = sum(r["language_ok"] for r in results)
print(f"\n{used} of {len(results)} rewrites passed their checks; {lang} of {len(results)} in the question's language. "
      f"Saved to logs/eval_simplify.json")
