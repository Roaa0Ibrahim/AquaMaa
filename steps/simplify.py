"""Graph step (Milestone 6): rewrite the checked answer for its reader (farmer or officer), then make sure nothing
changed.

Two personas (decided 13 Nov):
  farmer   farm owner or manager; also Pepper and anyone whose role is unknown (the public default). Direct answer,
           a next step only for their own water, crops or a decision, no notes under the answer.
  officer  Kahramaa or ministry staff (the dashboard's officer accounts). Main finding with number and source, what it
           means for planning, and the notes under the answer (key figures, conflicting sources) kept.

Position:  ... verify -> finalize -> SIMPLIFY -> end. The rewrite comes after the verifier, so accuracy stays the
first pass, and Python checks the rewrite against the checked answer before it is used:
  - no number that the checked answer doesn't have (so no rounding, no unit change, nothing copied from the examples)
  - every number the checked answer used is kept, if the rewrite drops all of them the main finding is lost
  - no source label that the checked answer doesn't have
  - the question's language (Arabic or English), at most 6 sentences, no headings
If any check fails, the checked answer is used as it is, and the reason is logged.
The prompts and their few-shot examples are SIMPLIFY_FARMER and SIMPLIFY_OFFICER in prompts.py; the research behind
them is in context/research/simplification-for-farmers.md. Switch off with  $env:AQUAMAA_SIMPLIFY = "0"
"""
import time

from langchain_core.messages import HumanMessage

from agent_log import log
from checks import ADDED_BLOCKS, CITATION, numbers
from config import SIMPLIFY
from prompts import LANGUAGE_NOTE, SIMPLIFY_FARMER, SIMPLIFY_OFFICER
from retrieval import is_arabic
from steps.react import model
from verifier import HEADING, NOT_ENOUGH, sentences, wrong_language

MAX_SIMPLE_SENTENCES = 6
DEMO_NOTE_START = "\n\nNote: these dashboard figures are demonstration data"
PROMPTS = {"farmer": SIMPLIFY_FARMER, "officer": SIMPLIFY_OFFICER}
# The dashboard's officer accounts (Deema's roles); everything else, including Pepper and no role, is a farmer
OFFICER_ROLES = {"officer", "admin", "kahramaa", "mecc", "municipality", "agriculture", "researcher"}


def persona_of(role):
    return "officer" if (role or "").strip().lower() in OFFICER_ROLES else "farmer"


def split_blocks(answer):
    """The answer the agent wrote, and the notes Python added after it (key figures, conflict notes, ...)."""
    cut = min([answer.find(b) for b in ADDED_BLOCKS if b in answer] or [len(answer)])
    return answer[:cut].strip(), answer[cut:]


def check_rewrite(checked, simple, question):
    """The reasons the rewrite can't be used; an empty list means it can."""
    reasons = []
    checked_numbers = numbers(CITATION.sub("", checked))
    simple_numbers = numbers(CITATION.sub("", simple))
    added = sorted(simple_numbers - checked_numbers - numbers(question))
    if added:
        reasons.append(f"numbers not in the checked answer: {added}")
    if checked_numbers and not (simple_numbers & checked_numbers):
        reasons.append("dropped every number of the checked answer")
    new_labels = sorted(set(CITATION.findall(simple)) - set(CITATION.findall(checked)))
    if new_labels:
        reasons.append(f"source labels not in the checked answer: {new_labels}")
    if wrong_language(simple, question):
        reasons.append("not in the question's language")
    if HEADING.search(simple) or len(sentences(simple)) > MAX_SIMPLE_SENTENCES:
        reasons.append("too long, or has headings")
    if not simple.strip():
        reasons.append("empty")
    return reasons


def simplify_node(state):
    final = state.get("final") or ""
    if not SIMPLIFY or not state["route"]["in_scope"] or not final:
        return {}
    checked, notes = split_blocks(final)
    if checked.startswith(NOT_ENOUGH):
        return {}                                  # nothing to simplify
    start = time.time()
    persona = state.get("persona") or "farmer"
    language = LANGUAGE_NOTE["ar" if is_arabic(state["question"]) else "en"]
    prompt = PROMPTS[persona].format(language=language, question=state["question"], answer=checked)
    simple = model.invoke([HumanMessage(prompt)]).content.strip()
    reasons = check_rewrite(checked, simple, state["question"])
    if reasons:
        log.info("SIMPLIFY  %s: kept the checked answer: %s (%.1f s)", persona, "; ".join(reasons), time.time() - start)
        return {"checked_answer": checked + notes, "simplified": False,
                "simplify_note": f"kept the checked answer: {'; '.join(reasons)}. Rewrite was: {simple}"}
    log.info("SIMPLIFY  rewritten for a %s (%.1f s)", persona, time.time() - start)
    if persona == "officer":
        return {"final": simple + notes, "checked_answer": checked + notes, "simplified": True, "simplify_note": ""}
    # A farmer sees the simple answer alone (13 Nov: the conflict note and key figures were "too much for a farmer").
    # The demonstration-data label always stays; the full checked answer with its notes is kept in checked_answer.
    keep = DEMO_NOTE_START in notes
    shown = simple + (notes[notes.index(DEMO_NOTE_START):].split("\n\nNote on sources:")[0] if keep else "")
    return {"final": shown, "checked_answer": checked + notes, "simplified": True, "simplify_note": ""}
