"""Milestone 4, step 3: run a question set through the agent and log every answer.

Run:
    python eval_agent.py                                  # the 28 labelled questions from eval_routing.py
    python eval_agent.py tests/dev_real_questions.csv     # a CSV with at least a "question" column

Each run is saved to runs/agent_<time>.json and appended to logs/agent_answers_log.jsonl (never overwritten).
The number check: every number in an answer must appear in a tool result or in the question.
"""
import csv
import json
import re
import sys
import time
from datetime import datetime
from pathlib import Path

from agent import ask
from agent_log import log
from answer_baseline import code_version
from checks import CITATION, agent_text, citation_check, numbers, tool_results_text
from config import CHAT_MODEL, MAX_TOOL_ROUNDS
from eval_routing import TESTS

RUN_ID = datetime.now().strftime("%Y%m%d-%H%M%S")
LOG_FILE = Path("logs/agent_answers_log.jsonl")
RUNS_DIR = Path("runs")


def load_questions(path):
    if path is None:
        return "eval_routing.TESTS", [dict(question=q, expected_type=t, expected_files=f) for q, t, f in TESTS]
    with open(path, encoding="utf-8-sig") as f:
        return path, list(csv.DictReader(f))


def save(run_info, rows, complete):
    """Writes the run file so far. "complete" says whether every question has been answered."""
    RUNS_DIR.mkdir(exist_ok=True)
    LOG_FILE.parent.mkdir(exist_ok=True)
    out = RUNS_DIR / f"agent_{RUN_ID}.json"
    json.dump(dict(run=dict(run_info, complete=complete, answered=len(rows)), answers=rows),
              open(out, "w", encoding="utf-8"), indent=1, ensure_ascii=False)


def main():
    source, questions = load_questions(sys.argv[1] if len(sys.argv) > 1 else None)
    run_info = dict(run_id=RUN_ID, code_version=code_version(), questions_from=source,
                    model=CHAT_MODEL, max_tool_rounds=MAX_TOOL_ROUNDS)
    rows = []
    for i, item in enumerate(questions, start=1):
        log.info("========== %d/%d", i, len(questions))
        result = ask(item["question"])
        tool_text = tool_results_text(result["trace"])
        written = agent_text(result["answer"])      # checks judge the agent's text, not the notes Python adds
        answer_numbers = numbers(CITATION.sub("", written))
        unsupported = sorted(answer_numbers - numbers(tool_text) - numbers(item["question"]))
        tools_used = [s["tool"] for s in result["trace"] if s["step"] == "call"]
        invented, general = citation_check(written, tool_text)
        rows.append(dict(item, got_type=result["route"]["question_type"] if result["route"]["in_scope"] else "out_of_scope",
                         answer=result["answer"], tools_used=tools_used, tool_rounds=result["tool_rounds"],
                         hit_step_limit=result["tool_rounds"] >= MAX_TOOL_ROUNDS,
                         numbers_not_in_tool_results=unsupported, cited_files_not_in_tool_results=invented,
                         general_knowledge_tags=general, seconds=result["seconds"], trace=result["trace"]))
        if unsupported:
            log.info("NUMBERS   not in any tool result: %s", unsupported)
        if invented:
            log.info("CITATION  files cited but never returned by a tool: %s", invented)
        # Saved after every question, so a crash or a laptop going to sleep keeps everything answered so far
        save(run_info, rows, complete=(i == len(questions)))
        with LOG_FILE.open("a", encoding="utf-8") as f:
            f.write(json.dumps(dict(run_info, **{k: v for k, v in rows[-1].items() if k != "trace"}), ensure_ascii=False) + "\n")
    out = RUNS_DIR / f"agent_{RUN_ID}.json"

    answered = [r for r in rows if r["got_type"] != "out_of_scope"]
    clean = sum(not r["numbers_not_in_tool_results"] for r in answered)
    print(f"\nRun {RUN_ID}: {len(rows)} questions, saved to {out} and added to {LOG_FILE}")
    print(f"Every number found in a tool result: {clean}/{len(answered)}")
    print(f"Answers citing a file no tool returned: {sum(bool(r['cited_files_not_in_tool_results']) for r in answered)}/{len(answered)}.  "
          f"Answers that called no tool: {sum(not r['tools_used'] for r in answered)}.  "
          f"[general knowledge] tags: {sum(r['general_knowledge_tags'] for r in answered)}")
    print(f"Step limit reached: {sum(r['hit_step_limit'] for r in rows)}.  "
          f"Average tool rounds: {sum(r['tool_rounds'] for r in rows) / len(rows):.1f}.  "
          f"Average time: {sum(r['seconds'] for r in rows) / len(rows):.1f} s")


if __name__ == "__main__":
    main()
