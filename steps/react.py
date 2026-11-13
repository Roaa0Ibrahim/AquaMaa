"""Graph steps: the ReAct loop. The agent reasons and decides; the tools act; their results come back to it."""
import re
import time

from langchain_core.messages import AIMessage, HumanMessage
from langchain_ollama import ChatOllama
from langgraph.prebuilt import ToolNode

from agent_log import log
from config import CHAT_MODEL, MAX_ANSWER_TOKENS, MAX_TOOL_ROUNDS, OLLAMA_URL
from prompts import FIRST_SEARCH, STEP_LIMIT
from tools import TOOLS

# num_predict caps each reply. Answers are at most 5 sentences, so 500 tokens is plenty; a runaway essay is cut off
# early (13 Nov: the fluoride question produced a 70-second essay with headings, unrelated to the question)
model = ChatOllama(model=CHAT_MODEL, temperature=0, reasoning=False, base_url=OLLAMA_URL, num_predict=MAX_ANSWER_TOKENS)
agent_model = model.bind_tools(TOOLS)


def tool_failed(error):
    """Milestone 5, failed-tool route: any tool error goes back to the agent as text, so it answers from its other
    tools instead of the whole answer crashing (13 Nov: ToolNode's default only catches input errors and re-raises
    the rest, so a broken search index stopped the answer; found by eval_errors.py --live)."""
    log.info("TOOL      failed: %s", error)
    return (f"Error: this tool failed ({error}). Answer from the other tools, and say that this source "
            "couldn't be searched.")


tool_node = ToolNode(TOOLS, handle_tool_errors=tool_failed)


def agent_node(state):
    """Reason: Qwen reads everything so far and decides to call a tool or to answer."""
    start = time.time()
    if not state["route"]["in_scope"]:
        reply = model.invoke(state["messages"])                         # general answer, no tools
        log.info("ANSWER    out of scope, general answer (%.1f s)", time.time() - start)
        return {"messages": [reply]}
    if state["rounds"] >= MAX_TOOL_ROUNDS:
        reply = model.invoke(state["messages"] + [HumanMessage(STEP_LIMIT)])
        log.info("LIMIT     %d tool rounds reached, answering now (%.1f s)", MAX_TOOL_ROUNDS, time.time() - start)
        return {"messages": [reply]}
    reply = agent_model.invoke(state["messages"])
    # An answer from the live reading needs no search first (13 Nov: the live sensors from Deema's dashboard)
    if not reply.tool_calls and state["rounds"] == 0 and "[live sensors" not in reply.content:
        # Rule 1 enforced in code: an answer before any search goes back once with a reminder.
        # Key statistics given before the agent starts don't count as a search (9 Nov: "where is the most number
        # of wells" answered from a key statistic without searching, and missed the municipality table)
        log.info("REASON    answered before searching: sent back to search first (%.1f s)", time.time() - start)
        reply = agent_model.invoke(state["messages"] + [HumanMessage(FIRST_SEARCH)])
    if reply.tool_calls:
        for call in reply.tool_calls:
            log.info("REASON    round %d: call %s(%s) (%.1f s)", state["rounds"] + 1, call["name"], call["args"],
                     time.time() - start)
    else:
        log.info("REASON    round %d: enough evidence, answering (%.1f s)", state["rounds"] + 1, time.time() - start)
    return {"messages": [reply]}


def tools_node(state):
    """Act: run the tools the agent asked for. Their results go back to the agent (observe)."""
    start = time.time()
    out = tool_node.invoke(state)
    for m in out["messages"]:
        sources = re.findall(r"^\[([^\]]+)\]", m.content, re.M)
        summary = ", ".join(sources) if sources else m.content.replace("\n", " ")[:120]
        log.info("OBSERVE   %s -> %s (%.1f s)", m.name, summary, time.time() - start)
    return {"messages": out["messages"], "rounds": state["rounds"] + 1}


def after_agent(state):
    """Decide: a tool call goes to the tools; plain text is an answer, which goes to the verifier."""
    last = state["messages"][-1]
    return "tools" if isinstance(last, AIMessage) and last.tool_calls else "verify"
