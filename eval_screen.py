"""Check of the screen step (steps/screen.py): questions asked from a dashboard page, and outside the website.

For each question in tests/screen_questions.csv: the screen step must take the expected mode, the answer must
include every must_include text and none of the must_not_include texts, and the verifier must leave no problems.
In must_include, SOURCE means at least one citation to AquaMaa's own sources (not the dashboard, not general knowledge).
Needs Ollama and the dashboard running (scripts/start_dashboard.ps1). Questions run one at a time.
Run:  python eval_screen.py        Results are saved to logs/eval_screen.json
"""
import csv
import json
import sys
from pathlib import Path

from agent import ask
from checks import CITATION

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).parent
rows = list(csv.DictReader((ROOT / "tests" / "screen_questions.csv").open(encoding="utf-8-sig")))
split = lambda s: [t for t in (s or "").split(";") if t]

results = []
for row in rows:
    context = {"page": row["page"], "year": int(row["year"]) if row["year"] else None} if row["page"] else None
    r = ask(row["question"], context=context)
    answer = r["answer"]
    # SOURCE means: at least one citation to AquaMaa's own sources, not the dashboard or general knowledge
    real_sources = [c for c in CITATION.findall(answer)
                    if not c.lower().startswith("[dashboard") and "general knowledge" not in c.lower()]
    missing = [t for t in split(row["must_include"])
               if (t == "SOURCE" and not real_sources) or (t != "SOURCE" and t.lower() not in answer.lower())]
    unwanted = [t for t in split(row["must_not_include"]) if t.lower() in answer.lower()]
    checks = {"screen": r["screen"] == row["expected_screen"], "includes": not missing, "excludes": not unwanted,
              "verifier": not r["problems_left"]}
    passed = all(checks.values())
    results.append(dict(id=row["id"], question=row["question"], context=context, passed=passed, checks=checks,
                        screen=r["screen"], missing=missing, unwanted=unwanted, problems_left=r["problems_left"],
                        repairs=r["repairs"], seconds=r["seconds"], answer=answer))
    print(f"\n{'PASS' if passed else 'FAIL'}  {row['id']} {row['question']}  (page={row['page'] or '-'}, "
          f"screen={r['screen']}, {r['repairs']} repair(s), {r['seconds']} s)")
    for name, ok in checks.items():
        if not ok:
            print(f"      failed: {name}  missing={missing} unwanted={unwanted} problems={r['problems_left']}")
    print("      " + answer.replace("\n", "\n      "))
    (ROOT / "logs").mkdir(exist_ok=True)
    json.dump(results, open(ROOT / "logs" / "eval_screen.json", "w", encoding="utf-8"), indent=1, ensure_ascii=False)

print(f"\n{sum(r['passed'] for r in results)} of {len(results)} passed. Saved to logs/eval_screen.json")
