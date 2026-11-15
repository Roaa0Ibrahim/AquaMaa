"""What the agent graph carries from step to step, and a readable trace of what happened."""
from langchain_core.messages import AIMessage, ToolMessage
from langgraph.graph import MessagesState


class State(MessagesState):
    question: str
    route: dict            # the router's reading of the question
    rounds: int            # tool rounds used
    figures: list          # key statistics given to the agent
    repairs: int           # repair attempts used after the verifier found problems
    problems: list         # what the verifier found in the latest answer
    final: str             # the answer after the verifier, then after the simplification if it passed its checks
    checked_answer: str    # the verified answer before simplification (Milestone 6), for comparison
    simplified: bool       # whether the farmer's rewrite passed its checks and is the answer shown
    simplify_note: str     # why a rewrite was not used, with the rewrite itself, for review
    persona: str           # who reads the answer: farmer or officer (from the website account's role)
    grounding: dict        # live sensor data from Deema's dashboard, if the question came from her chat box


def trace_of(messages):
    """Every tool call and result, step by step, in a form that's easy to read and to log."""
    steps = []
    for m in messages:
        if isinstance(m, AIMessage) and m.tool_calls:
            steps += [{"step": "call", "tool": c["name"], "args": c["args"]} for c in m.tool_calls]
        elif isinstance(m, ToolMessage):
            steps.append({"step": "result", "tool": m.name, "text": m.content})
    return steps
