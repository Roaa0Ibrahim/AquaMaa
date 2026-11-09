"""Prints one agent run: for each question, its route, the tools used, flagged numbers, and the answer.

Run:
    python show_run.py                             # the latest runs/agent_*.json
    python show_run.py runs/agent_20261107-210805.json
"""
import json
import sys
from pathlib import Path

from checks import CITATION, agent_text, citation_check, numbers, tool_results_text, uncited_sentences

sys.stdout.reconfigure(encoding="utf-8")

path = Path(sys.argv[1]) if len(sys.argv) > 1 else max(Path("runs").glob("agent_*.json"), key=lambda p: p.stat().st_mtime)
run = json.load(open(path, encoding="utf-8"))
print(f"Run {run['run']['run_id']}  ({run['run']['questions_from']}, code {run['run']['code_version']})\n")

no_tools, invented_any, uncited_any, numbers_any = [], [], [], []
for a in run["answers"]:
    label = a.get("id", "")
    if not a["tools_used"] and a["got_type"] != "out_of_scope":
        no_tools.append(label or a["question"][:40])
    # Checks look only at what the agent wrote, not the notes Python adds from verified sources
    written = agent_text(a["answer"])
    tool_text = tool_results_text(a["trace"])
    invented, _ = citation_check(written, tool_text)
    uncited = uncited_sentences(written)
    bad_numbers = sorted(numbers(CITATION.sub("", written)) - numbers(tool_text) - numbers(a["question"]))
    if a["got_type"] != "out_of_scope":
        if invented:
            invented_any.append(label or a["question"][:40])
        if uncited:
            uncited_any.append(label or a["question"][:40])
        if bad_numbers:
            numbers_any.append(label or a["question"][:40])
    print(f"{label} [{a.get('kb_can_answer', '-')}] {a['got_type']}  tools={a['tools_used']}  "
          f"numbers not in tool results={bad_numbers}  invented citations={invented}  "
          f"uncited sentences={len(uncited)}")
    print(f"   Q: {a['question']}")
    print(f"   A: {a['answer'][:400]}\n")

print(f"In-scope answers that called no tool: {len(no_tools)} {no_tools}")
print(f"In-scope answers with a number not in any tool result: {len(numbers_any)} {numbers_any}")
print(f"In-scope answers citing a file no tool returned: {len(invented_any)} {invented_any}")
print(f"In-scope answers with a sentence that has no citation: {len(uncited_any)} {uncited_any}")
