"""Graph step: choose up to 2 key statistics from the question, before the agent answers, and give them to the
agent as evidence it can use and cite. Chosen before the answer, so the answer can't contradict them.
Skipped for out-of-scope questions. The selection itself is in key_stats.py."""
import time

from langchain_core.messages import AIMessage, ToolMessage

import key_stats
from agent_log import log


def figures_node(state):
    if not state["route"]["in_scope"]:
        return {"figures": []}
    start = time.time()
    figures = key_stats.select_figures(state["question"], "")
    log.info("KEYSTATS  chose %d (%.1f s)", len(figures), time.time() - start)
    if not figures:
        return {"figures": []}
    # Given in the form of a tool call and its result, because the agent is told to trust only tool results
    evidence = "\n".join(f"{key_stats.label(s)} {key_stats.as_line(s)}" for s in figures)
    call = AIMessage(content="", tool_calls=[{"name": "key_statistics", "args": {"question": state["question"]},
                                              "id": "key-statistics-1"}])
    result = ToolMessage(content=evidence, tool_call_id="key-statistics-1", name="key_statistics")
    return {"figures": figures, "messages": [call, result]}


def figures_block(figures, answer):
    """The "Key figures" list under the answer: only figures the answer didn't already state."""
    unstated = [s for s in figures if not key_stats.already_stated(s, answer)]
    return "\n\nKey figures:\n" + "\n".join(f"- {key_stats.as_line(s)}" for s in unstated) if unstated else ""
