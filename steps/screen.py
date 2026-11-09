"""Graph step: what the user sees on the dashboard (decided 9 Nov: read on every question from the website).

Position:  route -> SCREEN -> key statistics -> agent <-> tools -> verify -> finalize

Input:  the question, and state["context"] = {"page": ..., "year": ...} sent by the website chat panel.
        A question asked outside the website (agent.py, eval scripts) has no context.
Output: state["screen"], one of
          "about_dashboard"  the question names the dashboard (English or Arabic words below): the dashboard's figures
                             are the answer, and key statistics are skipped
          "context"          asked from a dashboard page: the screen is read and given to the agent, which follows
                             rule 7 in prompts.py (dashboard figure first, labelled demonstration, then the sources)
          "none"             no page and no dashboard words, or the question is out of scope
          "unavailable"      the dashboard couldn't be read; the agent answers from its sources
        and, when read, one tool call and result named dashboard_screen, so the verifier counts its numbers as evidence.
No model call: one read of the overview cards, in milliseconds.
"""
import re

from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

import dashboard
from agent_log import log
from prompts import SCREEN_ABOUT, SCREEN_CONTEXT

DASHBOARD_WORDS = re.compile(
    r"\b(dashboard|chart|graph|card|this (figure|page|screen)|on (the|my) screen|station(s)? ST-\d+|ST-\d+)\b"
    r"|لوحة|الشاشة|شاشة|البطاقة|بطاقة|الرسم البياني|المخطط", re.I)

# The screen is kept short: the overview cards (about 12 lines, with the counts and shares) on every page, plus one
# line saying what the page lists. Full lists are not pre-read: on 9 Nov the map page's 28 wells and 7 stations
# (about 40 lines) derailed the model into a 3-minute table. The agent calls read_dashboard if it needs a list.
PAGE_LISTS = {
    "map": "a map of the dashboard's wells and monitoring stations: read_dashboard(view='wells') gives each well's "
           "place, aquifer, depth and TDS",
    "wells": "the dashboard's wells and stations: read_dashboard(view='wells') or (view='stations') gives each one",
    "quality": "the TDS of each dashboard well: read_dashboard(view='wells') gives them",
    "extraction": "the extraction trend from 1998 to 2022: read_dashboard(view='extraction_trend') gives each year",
}
YEARS = range(1998, 2023)


def names_dashboard(question):
    return bool(DASHBOARD_WORDS.search(question))


def _context(state):
    ctx = state.get("context") or {}
    page = str(ctx.get("page") or "").strip().lower() or None
    try:
        year = int(ctx.get("year")) if ctx.get("year") is not None else None
    except (TypeError, ValueError):
        year = None
    return page, (year if year in YEARS else None)


def screen_node(state):
    page, year = _context(state)
    about = names_dashboard(state["question"])
    if not state["route"]["in_scope"] or not (page or about):
        return {"screen": "none"}
    mode = "about_dashboard" if about else "context"
    try:
        text = dashboard.read("overview", year=year)
    except dashboard.DashboardError as error:
        log.info("SCREEN    couldn't read the dashboard: %s", error)
        return {"screen": "unavailable"}
    if page in PAGE_LISTS:
        text += f"\nThis page also shows {PAGE_LISTS[page]}."
    log.info("SCREEN    %s: page=%s year=%s (%d lines)", mode, page, year, len(text.splitlines()))
    header = (f"What the user sees on the dashboard (page: {page or 'not given'}, year: {year or 'latest'}). "
              "Figures marked demonstration are not real data.\n")
    call = AIMessage(content="", tool_calls=[{"name": "dashboard_screen", "args": {"page": page, "year": year},
                                              "id": "dashboard-screen-1"}])
    result = ToolMessage(content=header + text, tool_call_id="dashboard-screen-1", name="dashboard_screen")
    # A ready-made tool result made the agent answer from the screen alone, with no search (4 of 6 questions, 9 Nov),
    # so the next instruction is explicit: about the dashboard, answer from it; otherwise, search the sources now
    instruction = SCREEN_ABOUT if mode == "about_dashboard" else SCREEN_CONTEXT
    return {"screen": mode, "messages": [call, result, HumanMessage(instruction)]}
