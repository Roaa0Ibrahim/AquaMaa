# 1. Imports and settings
"""Milestone 3 baseline: answer each test question from its retrieved evidence only, so the answers
can be judged for faithfulness and answer relevancy. Milestone 4's agent is compared against this.

Run: python answer_baseline.py      (saves baseline_answers_v3.json)
"""
import json
import re
import sys
import time

from langchain_ollama import ChatOllama

from eval_routing import TESTS
from retrieval import Retrievers
from routing import classify, retrieve

import subprocess
from datetime import datetime
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
MAX_EVIDENCE = 6          # pieces of evidence given to the model
EVIDENCE_LIMIT = {"aggregation": 30, "set": 10}   # totals and lists need every matching row
RUN_ID = datetime.now().strftime("%Y%m%d-%H%M%S")
LOG_FILE = Path("logs/answers_log.jsonl")
RUNS_DIR = Path("runs")


def code_version():
    """The Git commit, marked 'dirty' if there are uncommitted changes, so every answer is traceable to its code."""
    commit = subprocess.run(["git", "rev-parse", "--short", "HEAD"], capture_output=True, text=True).stdout.strip()
    dirty = subprocess.run(["git", "status", "--porcelain"], capture_output=True, text=True).stdout.strip()
    return commit + ("-dirty" if dirty else "")

model = ChatOllama(model="qwen3:14b", temperature=0, reasoning=False)

# 2. The two prompts

ANSWER_PROMPT = """Answer the question using ONLY the evidence below.
- Cite each fact with its evidence number in square brackets, like [2].
- Copy numbers exactly as they appear in the evidence, with their units and years.
- If the evidence does not answer the question, say so plainly and stop.
- At most 5 sentences.

Question: {question}

Evidence:
{evidence}"""

OUT_OF_SCOPE_PROMPT = """This question is outside AquaMaa's sources on water in Qatar.
Start with "This is outside AquaMaa's sources." then give a short general answer, in at most 3 sentences.

Question: {question}"""

# 3. Flattening the evidence
def flatten(result):
    """Evidence hits in order. Sub-question steps are interleaved so each step is represented."""
    if result["method"] != "per_sub_question":
        return result["evidence"]
    steps = [flatten(step["result"]) for step in result["evidence"]]
    return [hit for group in zip(*steps) for hit in group] + [h for s in steps for h in s[min(map(len, steps)):]]

# 4. The number check (with the fix)
def numbers(text):
    """Numbers as written, without thousands separators or a trailing full stop: '1,000.' -> '1000'."""
    found = re.findall(r"\d[\d,]*(?:\.\d+)?", text)
    return {n.replace(",", "") for n in found}

# 5. The main loop
def main():
    r = Retrievers()
    rows = []
    for question, expected_type, expected_files in TESTS:
        start = time.time()
        route = classify(question)
        result = retrieve(route, question, r)
        evidence = flatten(result)[:EVIDENCE_LIMIT.get(result["type"], MAX_EVIDENCE)]

        if result["type"] == "out_of_scope":
            prompt = OUT_OF_SCOPE_PROMPT.format(question=question)
        else:
            listed = "\n\n".join(f"[{i}] ({h['file']}, p.{h['page']}) {h['text']}"
                                 for i, h in enumerate(evidence, start=1))
            prompt = ANSWER_PROMPT.format(question=question, evidence=listed)
        answer = model.invoke([{"role": "user", "content": prompt}]).content.strip()

        # Every number in the answer should come from the evidence. Citation numbers like [2]
        # and numbers copied from the question don't count.
        answer_without_citations = re.sub(r"\[\d+(?:,\s*\d+)*\]", "", answer)
        allowed = numbers(" ".join(h["text"] for h in evidence)) | numbers(question)
        unsupported = sorted(numbers(answer_without_citations) - allowed)

        rows.append(dict(question=question, expected_type=expected_type, got_type=result["type"],
                         method=result["method"], answer=answer, numbers_not_in_evidence=unsupported,
                         evidence=[dict(n=i, file=h["file"], page=h["page"], text=h["text"])
                                   for i, h in enumerate(evidence, start=1)]))
        flag = f"  numbers not in evidence: {unsupported}" if unsupported else ""
        print(f"{time.time() - start:5.1f}s  {result['type']:22} {question[:60]}{flag}")

    run_info = dict(run_id=RUN_ID, code_version=code_version(), model="qwen3:14b",
                    max_evidence=MAX_EVIDENCE, evidence_limit=EVIDENCE_LIMIT)
    json.dump(rows, open("baseline_answers_v3.json", "w", encoding="utf-8"), indent=1, ensure_ascii=False)   # latest run

    RUNS_DIR.mkdir(exist_ok=True)
    json.dump(dict(run=run_info, answers=rows), open(RUNS_DIR / f"baseline_{RUN_ID}.json", "w", encoding="utf-8"),
              indent=1, ensure_ascii=False)                                                                # this run

    LOG_FILE.parent.mkdir(exist_ok=True)
    with LOG_FILE.open("a", encoding="utf-8") as log:                                                      # all runs
        for row in rows:
            log.write(json.dumps(dict(run_info, **row), ensure_ascii=False) + "\n")
    print(f"Run {RUN_ID} saved to {RUNS_DIR / f'baseline_{RUN_ID}.json'} and added to {LOG_FILE}")
    answered = [row for row in rows if row["got_type"] != "out_of_scope"]
    clean = sum(not row["numbers_not_in_evidence"] for row in answered)
    print(f"\nAnswers with every number found in their evidence: {clean}/{len(answered)}")


if __name__ == "__main__":
    main()




