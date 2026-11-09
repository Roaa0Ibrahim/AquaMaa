"""Graph step: the router's reading of the question, and the scope check."""
import time

from langchain_core.messages import HumanMessage, SystemMessage

from agent_log import log
from prompts import OUT_OF_SCOPE, SYSTEM
from routing import classify
from tools import R


def route_node(state):
    question = state["question"]
    log.info("QUESTION  %s", question)
    start = time.time()
    route = classify(question)
    if not route.in_scope and R.structured(question, route.conditions, k=1):
        route = route.model_copy(update={"in_scope": True})          # a data table matches, as in Milestone 3
        log.info("SCOPE     router said out of scope, but a data table matches, so in scope")
    info = route.model_dump()
    log.info("ROUTE     type=%s in_scope=%s conditions=%s sub_questions=%s premise=%s (%.1f s)",
             route.question_type, route.in_scope, route.conditions, route.sub_questions, route.premise_issue,
             time.time() - start)
    if not route.in_scope:
        return {"route": info, "rounds": 0, "messages": [SystemMessage(OUT_OF_SCOPE), HumanMessage(question)]}
    system = SYSTEM.format(question_type=route.question_type, conditions=route.conditions or "none",
                           sub_questions=route.sub_questions or "none", premise_issue=route.premise_issue or "none")
    return {"route": info, "rounds": 0, "messages": [SystemMessage(system), HumanMessage(question)]}
