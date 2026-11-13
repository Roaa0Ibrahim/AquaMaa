"""Realistic questions for each persona (farmer, officer), with the time each answer takes.

Reads tests/persona_questions.csv and asks each question with the account role given there, so the persona is
chosen the same way as on the website. The agent's live log (every step with its time) goes to the console and to
logs/agent.log; the answers and totals are saved to logs/eval_personas.json.
Needs Ollama. Questions run one at a time.
Run:  python eval_personas.py
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
QUESTIONS = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "tests" / "persona_questions.csv"
OUT = ROOT / "logs" / f"eval_{QUESTIONS.stem}.json"
rows = list(csv.DictReader(QUESTIONS.open(encoding="utf-8-sig")))

results = []
for row in rows:
    print(f"\n========== {row['id']} [{row['persona']}, role={row['role']}, {row['language']}] {row['question']}")
    r = ask(row["question"], role=row["role"])
    shown = agent_text(r["answer"]).strip()
    language_ok = (arabic_share(shown) > 0.5) == row["language"].startswith("ar")
    results.append(dict(id=row["id"], persona=r.get("persona"), expected_persona=row["persona"], role=row["role"],
                        language=row["language"], question=row["question"], seconds=r["seconds"],
                        path=r.get("path"), intent=r.get("intent"),
                        simplified=r.get("simplified"), language_ok=language_ok, sentences=len(sentences(shown)),
                        answer=r["answer"], checked_answer=r.get("checked_answer"), note=r.get("simplify_note", "")))
    print(f"---------- {r['seconds']} s | path={r.get('path')} {r.get('intent') or ''} | persona={r.get('persona')} | "
          f"simplified={r.get('simplified')} | "
          f"language_ok={language_ok}\nANSWER:\n{r['answer']}")
    (ROOT / "logs").mkdir(exist_ok=True)
    json.dump(results, open(OUT, "w", encoding="utf-8"), indent=1, ensure_ascii=False)

print("\n========== Summary")
for persona in ("farmer", "officer"):
    group = [r for r in results if r["expected_persona"] == persona]
    if group:
        times = sorted(r["seconds"] for r in group)
        print(f"{persona}: {len(group)} questions, persona right {sum(r['persona'] == persona for r in group)}, "
              f"fast path {sum(r['path'] == 'fast' for r in group)}, "
              f"simplified {sum(bool(r['simplified']) for r in group)}, right language "
              f"{sum(r['language_ok'] for r in group)}, time median {times[len(times) // 2]} s, max {times[-1]} s")
