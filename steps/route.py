"""Graph step: the router's reading of the question, and the scope check."""
import time
from datetime import datetime, timedelta, timezone

from langchain_core.messages import HumanMessage, SystemMessage

from agent_log import log
from prompts import LANGUAGE_NOTE, OUT_OF_SCOPE, SYSTEM, TIME_NOTE

QATAR_TIME = timezone(timedelta(hours=3), "AST")
from retrieval import is_arabic
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
    # The answer is in the question's language, stated for this question rather than left to a general rule
    # (9 Nov: an Arabic question got an English answer once the English sources came back)
    # The current time in Qatar (UTC+3, no daylight saving), from the server clock: nothing is collected from the user
    now = datetime.now(QATAR_TIME).strftime("%A %d %B %Y, %H:%M")
    language = LANGUAGE_NOTE["ar" if is_arabic(question) else "en"] + "\n" + TIME_NOTE.format(now=now)
    if not route.in_scope:
        return {"route": info, "rounds": 0,
                "messages": [SystemMessage(f"{OUT_OF_SCOPE}\n{language}"), HumanMessage(question)]}
    system = SYSTEM.format(question_type=route.question_type, conditions=route.conditions or "none",
                           sub_questions=route.sub_questions or "none", premise_issue=route.premise_issue or "none")
    return {"route": info, "rounds": 0, "messages": [SystemMessage(f"{system}\n\n{language}"), HumanMessage(question)]}
