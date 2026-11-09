"""Milestone 4, step 1: the tools the agent can call.

Each tool is a plain Python function with a docstring. The docstring is what the model reads
to decide when to use the tool, so it says what the tool is for, not how it works.
"""
from typing import Literal, Optional

from langchain_core.tools import tool

import dashboard
from retrieval import Retrievers

R = Retrievers()     # loaded once, shared by all tools


def _format(hits):
    """Each hit as one block, labelled with its file and page, so the answer can cite it."""
    if not hits:
        return "No results."
    return "\n\n".join(f"[{h['file']} p.{h['page']}] {h['text']}" for h in hits)


@tool
def search_documents(query: str) -> str:
    """Search AquaMaa's documents: national reports, standards, research, policies, the glossary and
    known misconceptions. Use it for explanations, definitions, goals, plans and facts stated in text.
    Write a specific query, and search again with different words if the first results don't answer."""
    return _format(R.hybrid(query, k=6))


@tool
def lookup_table(query: str, year_from: Optional[int] = None, year_to: Optional[int] = None) -> str:
    """Look up exact values in AquaMaa's data tables: groundwater abstraction, water production and use,
    population and farms by municipality, water quality indicators, and water quality limits.
    Give year_from and year_to to filter by year (the same year twice for one year).
    Returns table rows with exact numbers and units."""
    conditions = [str(y) for y in (year_from, year_to) if y]
    return _format(R.structured(query, conditions, k=30))


@tool
def calculate(operation: Literal["sum", "mean", "ratio", "percent_change", "difference"], numbers: list[float]) -> str:
    """Do arithmetic in Python. Never calculate in your head.
    - sum, mean: of all the numbers
    - ratio: the first number divided by the second
    - percent_change: from the first number to the second
    - difference: the second number minus the first
    Copy the numbers exactly from tool results."""
    if not numbers:
        return "Error: no numbers given."
    if operation in ("ratio", "percent_change", "difference") and len(numbers) != 2:
        return f"Error: {operation} needs exactly 2 numbers, got {len(numbers)}."
    a = numbers[0]
    b = numbers[1] if len(numbers) > 1 else None
    if operation == "sum":
        result, formula = sum(numbers), " + ".join(f"{n:g}" for n in numbers)
    elif operation == "mean":
        result, formula = sum(numbers) / len(numbers), f"({' + '.join(f'{n:g}' for n in numbers)}) / {len(numbers)}"
    elif operation == "ratio":
        if b == 0:
            return "Error: division by zero."
        result, formula = a / b, f"{a:g} / {b:g}"
    elif operation == "percent_change":
        if a == 0:
            return "Error: percent change from zero is undefined."
        result, formula = (b - a) / a * 100, f"({b:g} - {a:g}) / {a:g} x 100"
    else:
        result, formula = b - a, f"{b:g} - {a:g}"
    return f"{formula} = {round(result, 2):g}" + ("%" if operation == "percent_change" else "")


@tool
def read_dashboard(view: Literal["overview", "extraction_trend", "wells", "stations", "station_readings"],
                   year: Optional[int] = None, station_code: Optional[str] = None) -> str:
    """Read what AquaMaa's dashboard website shows, for questions about the dashboard, its charts and cards,
    its monitoring wells and stations, or a station's readings.
    - overview: the main cards for one year (1998-2022), with the counts and percentages the dashboard shows:
      extraction, safe yield, their ratio, sectors, how many wells meet the TDS threshold, station coverage.
      Use it for any "how many" or "what share" question about the dashboard; don't count lists yourself
    - extraction_trend: extraction by year and sector, as in the trend chart
    - wells, stations: the individual monitoring wells and stations listed on the dashboard
    - station_readings: monthly water level and TDS for one station; give station_code, such as ST-01
    Each line says its status. Figures marked "demonstration" are not real data: always say so."""
    try:
        return dashboard.read(view, year=year, station_code=station_code)
    except dashboard.DashboardError as error:
        return f"Error: {error}. Answer from the other tools instead, and say the dashboard couldn't be read."


TOOLS = [search_documents, lookup_table, calculate, read_dashboard]


if __name__ == "__main__":
    import sys
    sys.stdout.reconfigure(encoding="utf-8")
    print(lookup_table.invoke({"query": "total abstraction from groundwater", "year_from": 2019, "year_to": 2024})[:400])
    print("---")
    print(search_documents.invoke({"query": "how many new recharge wells NDC"})[:300])
    print("---")
    for op, nums in [("mean", [250, 250, 250, 250, 200, 200]), ("ratio", [200, 49.6]), ("percent_change", [250, 200]),
                     ("ratio", [5, 0]), ("difference", [1])]:
        print(op, nums, "->", calculate.invoke({"operation": op, "numbers": nums}))
