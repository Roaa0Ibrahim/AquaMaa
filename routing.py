# 1. The router 
from typing import Literal, Optional
from pydantic import BaseModel, Field
from langchain_ollama import ChatOllama

QuestionType = Literal["simple", "simple_with_condition", "set", "comparison", "aggregation",
                       "multi_hop", "post_processing", "false_premise", "explanation"]

class Route(BaseModel):
    """How to answer a question about Qatar groundwater."""
    topic: str = Field(description="The question's subject in 3 words or fewer")
    in_scope: bool = Field(description="True if the subject is water, groundwater, water quality, water use, "
                                       "water policy, or the context data AquaMaa holds: population, farms, wells, "
                                       "rainfall and municipalities in Qatar. Food, sport and other subjects are False")
    premise_issue: Optional[str] = Field(description="If the question assumes something wrong or "
                                                     "unsupported, state the assumption. Otherwise null")
    question_type: QuestionType
    conditions: list[str] = Field(description="Constraints such as 'year=2019', 'use=irrigation'. Empty if none")
    sub_questions: list[str] = Field(description="Smaller questions to answer first, for comparison, "
                                                 "aggregation, multi_hop. Each must make sense on its own: "
                                                 "repeat the subject instead of writing 'it' or 'they'. Empty otherwise")

# Examples are deliberately NOT questions from eval_routing.py, so the test stays fair.
ROUTER_PROMPT = """Classify the question by what its answer needs. Types:
- simple: one fact or number. "What is the WHO guideline value for fluoride?"
- simple_with_condition: one fact with a constraint such as a year, place or water use. "What was rainfall in 2018?"
- set: a list of items. "Which municipalities have farms?"
- comparison: two or more items compared. "Compare Station A and Station B."
- aggregation: a total, average or count across items or years. "What was total water production from 2015 to 2020?"
- multi_hop: several linked steps, where one answer is needed to find the next. "Which ministry licenses wells, and how many licences did it issue?"
- post_processing: a calculation from facts, such as a ratio or percentage. "What percentage of the population lives in Doha?"
- false_premise: the question assumes something wrong or unsupported. "Since rivers supply Qatar's farms, is irrigation sustainable?"
- explanation: why or how something happens, or what something means. "How does leaching reduce soil salinity?"

Rules:
- Qatar is the default country, so never list "Qatar" as a condition.
- If premise_issue is not null, the type is false_premise.
- Sub-questions must stand alone: "How many recharge wells does the plan include?", not "How many does it include?"
- in_scope is False for subjects outside water and its context data, even if they are about Qatar.

Known wrong assumptions about water in Qatar, from AquaMaa's misconceptions table:
{misconceptions}

Question: {question}"""

router = ChatOllama(model="qwen3:14b", temperature=0, reasoning=False).with_structured_output(Route)

import csv
from pathlib import Path
_MIS = Path(__file__).parent / "database" / "10-misconceptions" / "misconceptions.csv"
MISCONCEPTIONS = "\n".join(f"- Wrong: {row['wrong_assumption']} Correct: {row['correction']}"
                            for row in csv.DictReader(_MIS.open(encoding="utf-8-sig")))

def classify(question: str) -> Route:
    return router.invoke([{"role": "user", "content": ROUTER_PROMPT.format(question=question, misconceptions=MISCONCEPTIONS)}])

# 2. The map from question type to retrieval method and checks.
# Methods are tried in order until one returns evidence. Hybrid replaced BM25 as the fallback after
# compare_retrieval.py: hybrid found the right file in the top 3 for 10/10 questions, BM25 for 9/10.
ROUTES = {
    #  type                    retrieval methods, tried in order            k   checks after retrieval
    "simple":                (["structured", "hybrid"],                     3, ["number_in_source"]),
    "simple_with_condition": (["structured", "hybrid"],                     3, ["condition_matches", "number_in_source"]),
    "set":                   (["structured", "hybrid"],                    10, ["list_each_with_source"]),
    "comparison":            (["per_sub_question", "structured", "hybrid"], 5, ["same_unit_and_year"]),
    "aggregation":           (["structured", "hybrid"],                    30, ["years_covered", "python_math"]),
    "multi_hop":             (["per_sub_question", "hybrid"],               5, ["evidence_per_step"]),
    "post_processing":       (["structured", "hybrid"],                     5, ["python_math", "show_formula"]),
    "false_premise":         (["hybrid"],                                   5, ["correct_premise_first"]),
    "explanation":           (["hybrid"],                                   6, ["quote_per_source", "flag_conflicts"]),
}


def plan(route: Route) -> dict:
    if not route.in_scope:
        return {"methods": [], "k": 0, "checks": ["label_general_knowledge"]}
    methods, k, checks = ROUTES[route.question_type]
    return {"methods": methods, "k": k, "checks": checks}


# 3. Running the methods in order. The methods themselves are in retrieval.py.
def retrieve(route: Route, question: str, r, depth: int = 0) -> dict:
    """Returns {"type", "method", "evidence", "checks"}. evidence is a list of hits, or for
    per_sub_question a list of {"question", "result"} steps. Sub-questions go one level deep only."""
    scope_note = None
    if not route.in_scope and r.structured(question, route.conditions, k=1):
        # The router said out of scope, but our own tables hold a strong match, so the knowledge base can answer it.
        route = route.model_copy(update={"in_scope": True})
        scope_note = "in scope: a data table matches the question"
    p = plan(route)
    out = {"type": route.question_type if route.in_scope else "out_of_scope", "checks": p["checks"],
           "scope_note": scope_note}
    for method in p["methods"]:
        if method == "per_sub_question":
            if depth > 0 or len(route.sub_questions) < 2:
                continue                                  # nothing to split, so try the next method
            steps = [{"question": q, "result": retrieve(classify(q), q, r, depth + 1)} for q in route.sub_questions]
            return dict(out, method="per_sub_question", evidence=steps)
        if method == "structured":
            hits = r.structured(question, route.conditions, k=p["k"])
        else:
            hits = getattr(r, method)(question, k=p["k"])
        if hits:
            return dict(out, method=method, evidence=hits)
    return dict(out, method=None, evidence=[])


if __name__ == "__main__":
    tests = [
        "What is Qatar's groundwater safe yield?",
        "What was groundwater abstraction in 2019?",
        "Which laws regulate well drilling in Qatar?",
        "Compare abstraction in the Northern and Southern basins.",
        "What was the average rainfall recharge from 2015 to 2020?",
        "Which ministry is responsible for the national goal on groundwater extraction, and what target did it set?",
        "What percentage of abstraction comes from farm wells?",
        "Where can we find the greatest amount of drinkable groundwater in Qatar?",
        "Why does high SAR damage soil?",
        "What is the best recipe for machboos?",
    ]
    for q in tests:
        r = classify(q)
        print(f"{r.question_type if r.in_scope else 'out_of_scope':22} {plan(r)['methods']}  <- {q}")
