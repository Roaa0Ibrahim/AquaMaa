"""The AquaMaa agent: connects the steps into one graph, and runs it.

    route -> figures -> agent <-> tools -> verify -(problems, once)-> repair -> agent
                                          verify -(no problems, or after one repair)-> finalize -> simplify -> end
    simplify (Milestone 6, steps/simplify.py): the checked answer rewritten for a farmer, used only if Python finds
    no changed number, source or language in it

Each step lives in steps/, and each step's logic in a top-level module:
    steps/route.py    routing.py     the router's reading of the question, and the scope check
    steps/figures.py  key_stats.py   up to 2 key statistics, given to the agent before it answers
    steps/react.py    tools.py       the ReAct loop: the agent decides, the tools act
    steps/verify.py   verifier.py    checks, one repair attempt, removal of what still fails, conflict notes
Settings are in config.py, prompts in prompts.py, the graph's state in state.py, logging in agent_log.py.

Usage: from agent import ask;  result = ask("What is the safe yield?")
Run:   python agent.py "your question"
"""
import json
import sys
import time
from datetime import datetime
from pathlib import Path

import httpx
import ollama
from langgraph.graph import END, START, StateGraph

from agent_log import log
from config import MAX_REPAIRS, MAX_TOOL_ROUNDS
from prompts import MODEL_DOWN
from state import State, trace_of
from steps.figures import figures_block, figures_node
from steps.react import after_agent, agent_node, tools_node
from steps.route import route_node
from steps.simplify import simplify_node
from steps.verify import after_verify, finalize_node, repair_node, verify_node

TRACE_DIR = Path("logs/traces")

graph = StateGraph(State)
graph.add_node("route", route_node)
graph.add_node("figures", figures_node)
graph.add_node("agent", agent_node)
graph.add_node("tools", tools_node)
graph.add_node("verify", verify_node)
graph.add_node("repair", repair_node)
graph.add_node("finalize", finalize_node)
graph.add_node("simplify", simplify_node)
graph.add_edge(START, "route")
graph.add_edge("route", "figures")
graph.add_edge("figures", "agent")
graph.add_conditional_edges("agent", after_agent, {"tools": "tools", "verify": "verify"})
graph.add_edge("tools", "agent")
graph.add_conditional_edges("verify", after_verify, {"repair": "repair", "finalize": "finalize"})
graph.add_edge("repair", "agent")
graph.add_edge("finalize", "simplify")
graph.add_edge("simplify", END)
app = graph.compile()


def ask(question: str, save_trace: bool = True) -> dict:
    start = time.time()
    try:
        final = app.invoke({"question": question, "repairs": 0, "problems": []},
                           {"recursion_limit": 2 * (MAX_REPAIRS + 1) * (MAX_TOOL_ROUNDS + 2) + 8})
    except (ConnectionError, OSError, httpx.HTTPError, ollama.ResponseError) as error:
        # Milestone 5: the model is down or failed. A clear message instead of a crash, for the website and Pepper.
        log.info("ERROR     the model didn't respond: %s", error)
        return dict(question=question, route={"question_type": None, "in_scope": None}, answer=MODEL_DOWN,
                    tool_rounds=0, key_figures=[], repairs=0, problems_left=[], trace=[], error=str(error),
                    seconds=round(time.time() - start, 1))
    figures = final.get("figures") or []
    answer = (final.get("final") or final["messages"][-1].content).strip()
    answer += figures_block(figures, answer)
    result = dict(question=question, route=final["route"], answer=answer, tool_rounds=final["rounds"],
                  key_figures=[s["stat_id"] for s in figures], repairs=final.get("repairs", 0),
                  problems_left=final.get("problems", []), trace=trace_of(final["messages"]),
                  checked_answer=final.get("checked_answer"), simplified=final.get("simplified", False),
                  simplify_note=final.get("simplify_note", ""),
                  seconds=round(time.time() - start, 1))
    if save_trace:
        TRACE_DIR.mkdir(parents=True, exist_ok=True)
        name = datetime.now().strftime("%Y%m%d-%H%M%S-%f")
        json.dump(result, open(TRACE_DIR / f"{name}.json", "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    return result


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    for q in sys.argv[1:] or ["What was the average groundwater abstraction from 2019 to 2024?"]:
        r = ask(q)
        log.info("DONE      %d tool rounds, %d repair(s), %.1f s", r["tool_rounds"], r["repairs"], r["seconds"])
        print(f"\nA: {r['answer']}\n")
