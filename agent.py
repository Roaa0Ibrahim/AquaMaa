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
from arabic_text import arabic_only
from config import FAST, MAX_REPAIRS, MAX_TOOL_ROUNDS
from fastpath.answer import fast_answer
from prompts import MODEL_DOWN, localize
from guess import guess, reread, unknown_arabic
from understand import is_dialect, to_msa
from state import State, trace_of
from steps.figures import figures_block, figures_node
from steps.live import live_node
from steps.react import after_agent, agent_node, tools_node
from steps.route import route_node
from steps.simplify import persona_of, simplify_node
from steps.verify import after_verify, finalize_node, repair_node, verify_node

TRACE_DIR = Path("logs/traces")

graph = StateGraph(State)
graph.add_node("route", route_node)
graph.add_node("live", live_node)
graph.add_node("figures", figures_node)
graph.add_node("agent", agent_node)
graph.add_node("tools", tools_node)
graph.add_node("verify", verify_node)
graph.add_node("repair", repair_node)
graph.add_node("finalize", finalize_node)
graph.add_node("simplify", simplify_node)
graph.add_edge(START, "route")
graph.add_edge("route", "live")
graph.add_edge("live", "figures")
graph.add_edge("figures", "agent")
graph.add_conditional_edges("agent", after_agent, {"tools": "tools", "verify": "verify"})
graph.add_edge("tools", "agent")
graph.add_conditional_edges("verify", after_verify, {"repair": "repair", "finalize": "finalize"})
graph.add_edge("repair", "agent")
graph.add_edge("finalize", "simplify")
graph.add_edge("simplify", END)
app = graph.compile()


def ask(question: str, save_trace: bool = True, role: str | None = None, grounding: dict | None = None,
        _reread: bool = True, intent: str | None = None) -> dict:
    """role: the website account's role; it picks the reader persona (farmer or officer, see steps/simplify.py).
    grounding: live sensor data from Deema's dashboard, given to the agent by steps/live.py."""
    start = time.time()
    persona = persona_of(role)
    asked = question
    guessed = None
    try:
        # The dialect layer first: Arabic -> Modern Standard Arabic (understand.py). Then dialect words aren't taken
        # for mistakes (13 Nov: "شكثر" = how much became "أكثر" = most, when guessing ran first)
        # Only when the question has Arabic words AquaMaa doesn't know; a standard question is left as asked.
        msa, rewritten = asked, False
        if unknown_arabic(asked) or is_dialect(asked):
            msa, rewritten, _ = to_msa(asked)
        if rewritten:
            log.info("DIALECT   %s -> %s", asked, msa)
        # The guessing layer: words that don't fit are replaced by what was probably meant (guess.py). Only the
        # person's own words can change, not the dialect rewrite's (13 Nov: "يمكنني" became "يمكن ل")
        question, changed, _, _ = guess(msa, only=asked)
        if changed:
            guessed = question
            log.info("GUESS     %s -> %s", msa, question)
    except (ConnectionError, OSError, httpx.HTTPError, ollama.ResponseError) as error:
        log.info("LAYERS    skipped, the model didn't respond: %r", error)
        question = asked
    if FAST:
        try:
            fast = fast_answer(question, persona, grounding, intent)
        except (ConnectionError, OSError, httpx.HTTPError, ollama.ResponseError) as error:
            log.info("FAST      skipped, the model didn't respond: %s", error)
            fast = None
        if fast:
            result = dict(question=asked, understood=question, persona=persona, path="fast", intent=fast["intent"],
                          route={"question_type": f"fast:{fast['intent']}", "in_scope": True},
                          answer=understood_note(guessed, asked) + localize(fast["answer"], asked),
                          tool_rounds=0, key_figures=[], repairs=0, problems_left=[], checked_answer=None,
                          simplified=False, simplify_note="",
                          trace=[{"step": "result", "tool": "fast_facts", "text": "\n".join(fast["facts"])}],
                          seconds=round(time.time() - start, 1))
            save(arabic_answer(result), save_trace)
            return result
    try:
        final = app.invoke({"question": question, "persona": persona, "grounding": grounding or {},
                            "repairs": 0, "problems": []},
                           {"recursion_limit": 2 * (MAX_REPAIRS + 1) * (MAX_TOOL_ROUNDS + 2) + 8})
    except (ConnectionError, OSError, httpx.HTTPError, ollama.ResponseError) as error:
        # Milestone 5: the model is down or failed. A clear message instead of a crash, for the website and Pepper.
        log.info("ERROR     the model didn't respond: %s", error)
        return dict(question=asked, route={"question_type": None, "in_scope": None}, answer=localize(MODEL_DOWN, asked),
                    tool_rounds=0, key_figures=[], repairs=0, problems_left=[], trace=[], error=str(error),
                    seconds=round(time.time() - start, 1))
    if _reread and not final["route"].get("in_scope"):
        # Before answering "outside AquaMaa's sources", assume AquaMaa misunderstood and re-read the question once
        try:
            intended = reread(asked)
        except (ConnectionError, OSError, httpx.HTTPError, ollama.ResponseError):
            intended = None
        if intended:
            log.info("REREAD    out of scope as asked; understood as: %s", intended)
            again = ask(intended, save_trace=False, role=role, grounding=grounding, _reread=False)
            if again["route"].get("in_scope"):
                again["answer"] = understood_note(intended, asked) + again["answer"]
                again.update(question=asked, understood=intended, seconds=round(time.time() - start, 1))
                save(arabic_answer(again), save_trace)
                return again
    figures = final.get("figures") or []
    answer = (final.get("final") or final["messages"][-1].content).strip()
    if not (final.get("simplified") and persona == "farmer"):   # a farmer sees the simple answer without the list
        answer += figures_block(figures, answer)
    answer = understood_note(guessed, asked) + localize(answer, asked)
    result = dict(question=asked, understood=question, persona=persona, route=final["route"], answer=answer,
                  tool_rounds=final["rounds"],
                  key_figures=[s["stat_id"] for s in figures], repairs=final.get("repairs", 0),
                  problems_left=final.get("problems", []), trace=trace_of(final["messages"]),
                  checked_answer=final.get("checked_answer"), simplified=final.get("simplified", False),
                  simplify_note=final.get("simplify_note", ""),
                  seconds=round(time.time() - start, 1), path="deep")
    save(arabic_answer(result), save_trace)
    return result


def understood_note(guessed, asked):
    """When the guessing layer changed the question, the answer first says how it was understood."""
    if not guessed:
        return ""
    if any("؀" <= ch <= "ۿ" for ch in asked):
        return f"فهمت سؤالك على أنه: «{guessed}»\n\n"
    return f"I understood your question as: \"{guessed}\"\n\n"


def arabic_answer(result):
    """An Arabic question gets an answer in Arabic only (arabic_text.py); the original, with its source tags, is kept
    as tagged_answer for the website's source list."""
    if "tagged_answer" not in result and any("؀" <= ch <= "ۿ" for ch in result.get("question", "")):
        result["tagged_answer"] = result["answer"]
        result["answer"] = arabic_only(result["answer"])
    return result


def save(result, save_trace):
    if save_trace:
        TRACE_DIR.mkdir(parents=True, exist_ok=True)
        name = datetime.now().strftime("%Y%m%d-%H%M%S-%f")
        json.dump(result, open(TRACE_DIR / f"{name}.json", "w", encoding="utf-8"), indent=1, ensure_ascii=False)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    for q in sys.argv[1:] or ["What was the average groundwater abstraction from 2019 to 2024?"]:
        r = ask(q)
        log.info("DONE      %d tool rounds, %d repair(s), %.1f s", r["tool_rounds"], r["repairs"], r["seconds"])
        print(f"\nA: {r['answer']}\n")
