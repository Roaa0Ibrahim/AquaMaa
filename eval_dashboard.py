"""Milestone 8 check: for 5 dashboard charts, do the agent's numbers match what the dashboard shows, exactly?

The expected numbers are read live from the dashboard's API, so the check stays right if Deema's data changes.
Each question passes when the answer contains the chart's numbers, every number in it came from the dashboard
or the question, and it says the figures are demonstration data (while they are).
Needs the dashboard running:  powershell -ExecutionPolicy Bypass -File scripts\\start_dashboard.ps1
Run:  python eval_dashboard.py      (saves logs/eval_dashboard.json)
"""
import json
import sys
from pathlib import Path

import dashboard
from agent import ask
from checks import CITATION, numbers, tool_results_text

sys.stdout.reconfigure(encoding="utf-8")


def g(value):
    """A number as the dashboard writes it: 250.0 -> '250', 57.5 -> '57.5'."""
    return f"{value:g}"


def cases():
    d = dashboard._get("/api/dashboard", year=2022)
    series = {r["year"]: r for r in dashboard._get("/api/extraction")["series"]}
    stations = dashboard._get("/api/stations")["stations"]
    first = stations[0]
    readings = dashboard._get(f"/api/stations/{first['id']}/readings")["readings"]
    last = readings[-1]
    sectors = {i["key"]: i for i in d["sectors"]["items"]}
    return [
        ("What does the dashboard show for groundwater extraction compared with the safe yield in 2022?",
         "overview card: extraction, safe yield and ratio", [g(d["extraction"]["value"]), g(d["safe_yield"]["value"]), g(d["ratio"])]),
        ("On the dashboard's sector chart, how much did agriculture extract in 2022 and what share is that?",
         "sector chart", [g(sectors["agriculture"]["value"]), g(sectors["agriculture"]["pct"])]),
        ("According to the dashboard's trend chart, what was total extraction in 2010?",
         "extraction trend chart", [g(series[2010]["total"])]),
        ("How many wells on the dashboard meet the TDS threshold?",
         "well quality card", [g(d["quality"]["suitable_count"]), g(d["quality"]["total"])]),
        (f"What was the latest TDS reading at station {first['code']} on the dashboard?",
         "station readings chart", [g(last["tds_mgl"])]),
    ]


def main():
    rows, passed = [], 0
    for question, chart, expected in cases():
        r = ask(question)
        answer_numbers = numbers(CITATION.sub("", r["answer"]))
        dashboard_text = tool_results_text([s for s in r["trace"] if s.get("tool") == "read_dashboard"])
        missing = [n for n in expected if n not in answer_numbers]
        foreign = sorted(answer_numbers - numbers(dashboard_text) - numbers(question))
        says_demo = "demonstration" in r["answer"].lower()
        used_tool = any(s["step"] == "call" and s["tool"] == "read_dashboard" for s in r["trace"])
        ok = used_tool and not missing and not foreign and says_demo
        passed += ok
        print(f"{'PASS' if ok else 'FAIL'}  {chart}: {question}\n      expected {expected}; missing {missing}; "
              f"numbers not from the dashboard {foreign}; says demonstration: {says_demo}; used read_dashboard: {used_tool}"
              f"\n      A: {r['answer'][:220]}")
        rows.append(dict(question=question, chart=chart, expected=expected, missing=missing,
                         numbers_not_from_dashboard=foreign, says_demonstration=says_demo,
                         used_read_dashboard=used_tool, passed=ok, answer=r["answer"]))
    print(f"\n{passed}/{len(rows)} charts: the agent's numbers match the dashboard")
    Path("logs").mkdir(exist_ok=True)
    json.dump(rows, open("logs/eval_dashboard.json", "w", encoding="utf-8"), indent=1, ensure_ascii=False)


if __name__ == "__main__":
    main()
