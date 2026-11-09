"""Graph steps (Milestone 5): check the answer, give the agent one repair attempt, then remove what still fails
(decided option B) and add notes for known conflicts. The checks themselves are in verifier.py."""
from langchain_core.messages import HumanMessage

from agent_log import log
from config import MAX_REPAIRS, VERIFY
from prompts import DEMO_NOTE
from state import trace_of
from steps.figures import is_about_dashboard
from verifier import conflict_notes, find_problems, remove_failing, repair_request


def verify_node(state):
    """Python checks the answer: numbers in tool results, real citations, a citation per sentence."""
    if not state["route"]["in_scope"] or not VERIFY:
        return {"problems": []}
    problems = find_problems(state["messages"][-1].content, trace_of(state["messages"]), state["question"])
    for p in problems:
        log.info("VERIFY    %s %s <- %s", p["kind"], p["detail"] or "", p["sentence"][:90])
    if not problems:
        log.info("VERIFY    no problems")
    return {"problems": problems}


def after_verify(state):
    return "repair" if state["problems"] and state.get("repairs", 0) < MAX_REPAIRS else "finalize"


def repair_node(state):
    """One repair attempt: the agent gets the exact list of problems and rewrites its answer."""
    log.info("REPAIR    sending %d problem(s) back to the agent", len(state["problems"]))
    return {"messages": [HumanMessage(repair_request(state["problems"]))], "repairs": state.get("repairs", 0) + 1}


def finalize_node(state):
    """Removes sentences that still fail, then adds notes for known conflicts."""
    answer = state["messages"][-1].content.strip()
    if not state["route"]["in_scope"] or not VERIFY:
        return {"final": answer}
    if state["problems"]:
        answer = remove_failing(answer, state["problems"])
        log.info("FINALIZE  removed %d sentence(s) that still failed", len({p["sentence"] for p in state["problems"]}))
    # Dashboard demonstration figures must always be labelled: guaranteed here rather than left to the model
    dashboard_results = [s["text"] for s in trace_of(state["messages"])
                         if s["step"] == "result" and s["tool"] == "read_dashboard"]
    if any("demonstration" in t for t in dashboard_results) and "demonstration" not in answer.lower():
        answer += f"\n\n{DEMO_NOTE}"
        log.info("FINALIZE  added the demonstration-data note")
    # Conflict notes compare AquaMaa's own sources, so they don't belong on answers about the dashboard
    notes = [] if is_about_dashboard(state["question"]) else conflict_notes(answer)
    if notes:
        answer += "\n\nNote on sources: " + " ".join(notes)
        log.info("FINALIZE  added %d conflict note(s)", len(notes))
    return {"final": answer}
