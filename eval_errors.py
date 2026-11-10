"""Milestone 5 check: force each failure on purpose and confirm it takes its route, with no invented answer.

Run:  python eval_errors.py          the verifier tests (no model needed, seconds)
      python eval_errors.py --live   also the tests that need Ollama: model down, failed tool, missing evidence
Results are saved to logs/eval_errors.json.
"""
import json
import os
import subprocess
import sys
from pathlib import Path

from checks import tool_results_text
from verifier import UNCONFIRMED_NOTE, conflict_notes, find_problems, fix_miscopied_citations, remove_failing

sys.stdout.reconfigure(encoding="utf-8")
ROOT = Path(__file__).parent
results = []


def record(name, route, passed, detail):
    results.append(dict(test=name, expected_route=route, passed=passed, detail=detail))
    print(f"{'PASS' if passed else 'FAIL'}  {name}\n      route: {route}\n      {detail}")


# Evidence the fake answers below are checked against, in the form the agent's trace uses
TRACE = [{"step": "result", "tool": "lookup_table",
          "text": "[total-abstraction-from-ground-water.csv p.3] Total abstraction from groundwater. year: 2023; "
                  "groundwater_abstraction_million_m3: 200"},
         {"step": "result", "tool": "search_documents",
          "text": "[NPC_Water_Statistics_2023.txt p.29] The safe yield of groundwater amounted to 49.6 million m3 per year."}]
QUESTION = "How does abstraction compare with the safe yield?"


def verifier_tests():
    # 1. A number no tool returned
    answer = ("Abstraction was 200 million m3 in 2023 [total-abstraction-from-ground-water.csv p.3]. "
              "That is 5.04 times the safe yield [NPC_Water_Statistics_2023.txt p.29].")
    problems = find_problems(answer, TRACE, QUESTION)
    final = remove_failing(answer, problems)
    record("number not found in any tool result", "verifier flags it -> repair -> removed if still there",
           any(p["kind"] == "number_not_in_tool_results" and "5.04" in p["detail"] for p in problems)
           and "5.04" not in final and UNCONFIRMED_NOTE in final, f"final answer: {final!r}")

    # 2. A citation to a file no tool returned
    answer = ("Abstraction was 200 million m3 in 2023 [total-abstraction-from-ground-water.csv p.3]. "
              "Pumping is falling every year [Qatar_National_Water_Strategy_2035.txt p.15].")
    problems = find_problems(answer, TRACE, QUESTION)
    final = remove_failing(answer, problems)
    record("citation to a file no tool returned", "verifier flags it -> repair -> removed if still there",
           any(p["kind"] == "cited_file_not_returned" for p in problems) and "Strategy_2035" not in final,
           f"final answer: {final!r}")

    # 3. A claim with no citation, next to an honest "not in the sources" sentence
    answer = ("The safe yield is 49.6 million m3 a year [NPC_Water_Statistics_2023.txt p.29]. "
              "Over-pumping also causes land subsidence across the whole country. "
              "The sources do not mention how fast the water table is falling.")
    problems = find_problems(answer, TRACE, QUESTION)
    flagged = [p["sentence"] for p in problems]
    record("claim without a citation", "verifier flags the claim; the honest 'not in the sources' sentence stays",
           any("subsidence" in s for s in flagged) and not any("do not mention" in s for s in flagged),
           f"flagged: {flagged}")

    # 4. Too little evidence: nothing in the answer can be supported
    answer = "Qatar's groundwater will run out by 2040 [Future_Water_Report.txt p.2]."
    final = remove_failing(answer, find_problems(answer, TRACE, QUESTION))
    record("too little evidence", "every sentence fails -> a clear 'not enough evidence' answer",
           final.startswith("AquaMaa's sources don't contain enough evidence"), f"final answer: {final!r}")

    # 5. One side of a known conflict
    answer = "Groundwater abstraction was 200 million m3 in 2023 [total-abstraction-from-ground-water.csv row 3]."
    notes = conflict_notes(answer)
    record("one side of a known conflict", "a note gives the other side and why they differ",
           any("180" in n for n in notes), f"notes: {notes}")

    # 5b. A miscopied label of a returned source is corrected; a different source with a similar name is not
    wells = ("[number-of-farms-and-wells-by-type-of-the-farm-and-municipality.csv row 91] Wells on farms "
             "(working and not working): 4,564 wells (2023)")
    tool_text = tool_results_text(TRACE) + "\n" + wells
    answer = "Qatar has 4,564 wells on farms [number-of-farms-and-wells-by-type-of-farm-and-region.txt]."
    fixed, fixes = fix_miscopied_citations(answer, tool_text)
    record("miscopied citation label", "corrected to the label the tool returned, not removed",
           "type-of-the-farm-and-municipality.csv row 91]" in fixed and not find_problems(
               fixed, TRACE + [{"step": "result", "tool": "key_statistics", "text": wells}], QUESTION),
           f"fixed: {fixed!r}")
    answer = "The safe yield is 49.6 million m3 a year [PSA_Water_Statistics_2021.txt p.29]."
    fixed, fixes = fix_miscopied_citations(answer, tool_text)
    record("similar but different source", "not swapped: it stays an invented citation for the repair route",
           not fixes, f"fixes: {fixes}")


def run_agent(question, extra_env):
    """Runs the agent in a separate process, so its settings (such as the Ollama address) can be changed."""
    env = dict(os.environ, PYTHONIOENCODING="utf-8", **extra_env)
    out = subprocess.run([sys.executable, str(ROOT / "agent.py"), question], capture_output=True,
                         text=True, encoding="utf-8", env=env, cwd=ROOT, timeout=900)
    return out.stdout + out.stderr


def live_tests():
    from prompts import MODEL_DOWN

    # 6. The model is down: point the agent at an address where nothing is listening
    output = run_agent("What is the groundwater safe yield?", {"OLLAMA_HOST": "http://127.0.0.1:9"})
    record("model down", "ask() catches the error -> a clear message instead of a crash",
           MODEL_DOWN in output and "Traceback" not in output, f"output ends: {output.strip()[-200:]!r}")

    # 7. A tool fails: make the document search raise an error, then ask a question that needs it
    import agent
    import tools
    original = tools.R.hybrid

    def broken(*args, **kwargs):
        raise RuntimeError("search index unavailable (forced by eval_errors.py)")

    tools.R.hybrid = broken
    try:
        r = agent.ask("Why is Qatar's groundwater getting saltier?", save_trace=False)
    finally:
        tools.R.hybrid = original
    error_seen = any(s["step"] == "result" and "unavailable" in s["text"] for s in r["trace"])
    record("a tool fails", "the error goes back to the agent as text; it answers honestly without that tool",
           error_seen and not r["problems_left"], f"answer: {r['answer'][:250]!r}")

    # 8. Missing evidence: a water question the database can't answer
    r = agent.ask("What is the fluoride concentration in Qatar's groundwater?", save_trace=False)
    honest = any(w in r["answer"].lower() for w in ("not ", "no ", "doesn't", "don't", "general knowledge"))
    record("evidence missing from the database", "the agent says what is missing; nothing invented survives",
           honest and not r["problems_left"], f"answer: {r['answer'][:250]!r}")


if __name__ == "__main__":
    verifier_tests()
    if "--live" in sys.argv:
        live_tests()
    passed = sum(r["passed"] for r in results)
    print(f"\n{passed}/{len(results)} forced failures took their route")
    Path("logs").mkdir(exist_ok=True)
    json.dump(results, open("logs/eval_errors.json", "w", encoding="utf-8"), indent=1, ensure_ascii=False)
