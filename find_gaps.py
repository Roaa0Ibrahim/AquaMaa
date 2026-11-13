"""AquaMaa's enhancement program: finds the gaps in what it answered, so they can be fixed (13 Nov).

Reads every saved answer in logs/traces/ (each question asked through agent.py, the website, Pepper or a test) and
lists, grouped by kind, with a suggested fix:
  no_information   the answer says the sources don't have it         -> add a knowledge card or a source
  wrong_language   not in the question's language                     -> check the prompts and fixed messages
  slow             took longer than SLOW seconds                      -> add example questions so the fast path takes it
  deep_path        answered by the slow full agent                    -> a candidate for a new fast-path card or intent
  repaired         the verifier sent it back, or problems were left   -> look at which check failed
  dialect          rewritten from dialect                             -> check the rewrite kept the meaning
Writes logs/gaps_report.md and prints a summary. No model call.
Run:  python find_gaps.py            (all saved answers)
      python find_gaps.py 2026-11-13 (only answers from that day)
"""
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

from verifier import MISSING_INFO, wrong_language

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).parent
SLOW = 20                       # seconds
NO_INFO = re.compile(r"don't contain enough evidence|لا تحتوي مصادر|لا توجد معلومات|not (explicitly )?(stated|given|available)")
FIX = {
    "no_information": "Add a knowledge card (fastpath/data/knowledge_cards.csv) or a source to database/, then rebuild",
    "wrong_language": "Check the language rule and the fixed messages (prompts.ARABIC_FIXED)",
    "slow": "Add example questions to fastpath/data/intent_questions.csv so the fast path recognises it",
    "deep_path": "If it is a common question, give it a fast-path card or intent",
    "repaired": "Read the trace (python show_trace.py \"words\") to see which check failed",
    "dialect": "Check that the rewrite into standard Arabic kept the meaning",
}

day = sys.argv[1].replace("-", "") if len(sys.argv) > 1 else ""
traces = sorted(p for p in (ROOT / "logs" / "traces").glob("*.json") if p.name.startswith(day))
gaps = defaultdict(list)
for p in traces:
    try:
        t = json.load(open(p, encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        continue
    q, a = t.get("question", ""), t.get("answer", "")
    body = a.split("\n\n")[0]
    entry = dict(file=p.name, question=q, seconds=t.get("seconds"), path=t.get("path", "deep"), answer=body[:200])
    if NO_INFO.search(body) or (MISSING_INFO.search(body) and len(body) < 200):
        gaps["no_information"].append(entry)
    if q and wrong_language(body, q):
        gaps["wrong_language"].append(entry)
    if isinstance(t.get("seconds"), (int, float)) and t["seconds"] > SLOW:
        gaps["slow"].append(entry)
    if t.get("path", "deep") == "deep":
        gaps["deep_path"].append(entry)
    if t.get("repairs") or t.get("problems_left"):
        gaps["repaired"].append(entry)
    if t.get("understood") and t.get("understood") != q:
        gaps["dialect"].append(dict(entry, understood=t["understood"]))

lines = [f"# AquaMaa gaps report", "", f"{len(traces)} saved answers read" + (f" from {sys.argv[1]}" if day else "") + ".", ""]
for kind in FIX:
    items = gaps.get(kind, [])
    lines += [f"## {kind}: {len(items)}", f"Fix: {FIX[kind]}", ""]
    seen = set()
    for e in items:
        if e["question"] in seen:
            continue
        seen.add(e["question"])
        extra = f" (understood as: {e['understood']})" if e.get("understood") else ""
        lines.append(f"- **{e['question']}**{extra} ({e['seconds']} s, {e['path']} path): {e['answer']}")
    lines.append("")
out = ROOT / "logs" / "gaps_report.md"
out.write_text("\n".join(lines), encoding="utf-8")
print(f"{len(traces)} answers read. " + ", ".join(f"{k}: {len(gaps.get(k, []))}" for k in FIX) + f"\nReport: {out}")
