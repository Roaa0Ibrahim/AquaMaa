"""Shows a saved agent trace: the question, each tool call with a short view of its result, and the answer.

Run:  python show_trace.py                     the latest trace in logs/traces/
      python show_trace.py "TDS threshold"     the latest trace whose question contains these words
"""
import json
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
TRACES = sorted(Path("logs/traces").glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
words = " ".join(sys.argv[1:]).lower()

for path in TRACES:
    t = json.load(open(path, encoding="utf-8"))
    if words and words not in t["question"].lower():
        continue
    print(f"{path.name}\nQ: {t['question']}\nscreen/route: {t.get('route', {}).get('question_type')}, "
          f"rounds {t.get('tool_rounds')}, repairs {t.get('repairs')}, {t.get('seconds')} s\n")
    for s in t["trace"]:
        if s["step"] == "call":
            print(f"CALL   {s['tool']} {json.dumps(s['args'], ensure_ascii=False)}")
        else:
            text = " ".join(s["text"].split())
            print(f"RESULT {s['tool']}: {text[:500]}{' ...' if len(text) > 500 else ''}")
    print(f"\nA: {t['answer']}\n\nproblems left: {t.get('problems_left')}")
    break
else:
    print("No trace found" + (f" for '{words}'" if words else ""))
