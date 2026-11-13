"""The fast path (13 Nov): facts by code, words by the model, in one short call.

    question -> intent (fastpath/intents.py, ~0.2 s) -> facts (fastpath/facts.py, code) -> one phrasing call
             -> check: every number comes from the facts or the question, right language, short, no headings
             -> answer, or None: the question then takes the deep path (the full agent in agent.py)
Switch off with  $env:AQUAMAA_FAST = "0"
"""
import time

from langchain_core.messages import HumanMessage
from langchain_ollama import ChatOllama

from agent_log import log
from checks import CITATION, numbers
from config import CHAT_MODEL, OLLAMA_URL
from fastpath.facts import BUILDERS
from fastpath.intents import detect
from prompts import LANGUAGE_NOTE, PHRASE, PHRASE_STYLE
from retrieval import is_arabic
from verifier import HEADING, sentences, wrong_language

MAX_SENTENCES = 5
phraser = ChatOllama(model=CHAT_MODEL, temperature=0, reasoning=False, base_url=OLLAMA_URL, num_predict=220,
                     keep_alive="2h")      # keep the model loaded between questions: no reload pause


def check(answer, facts_text, question):
    reasons = []
    added = sorted(numbers(CITATION.sub("", answer)) - numbers(facts_text) - numbers(question))
    if added:
        reasons.append(f"numbers not in the facts: {added}")
    # Only the facts' own source tags (13 Nov: the model invented "[no current sensor reading]")
    invented = sorted(set(CITATION.findall(answer)) - set(CITATION.findall(facts_text)))
    if invented:
        reasons.append(f"source tags not in the facts: {invented}")
    if wrong_language(answer, question):
        reasons.append("not in the question's language")
    if HEADING.search(answer) or len(sentences(answer)) > MAX_SENTENCES:
        reasons.append("too long, or has headings")
    if not answer.strip():
        reasons.append("empty")
    return reasons


def fast_answer(question, persona, grounding):
    """A fast answer dict, or None to use the deep path."""
    start = time.time()
    intent, score, example = detect(question)
    if not intent:
        log.info("FAST      no fast intent (closest %.2f: %s): deep path", score, example)
        return None
    arabic = is_arabic(question)
    builder = BUILDERS[intent]
    facts = (builder(question, grounding, arabic, score) if intent in ("law", "explain")
             else builder(question, grounding, arabic))
    if not facts and intent == "trend":
        # "Is my well getting saltier?" without live data is often a "why" question (13 Nov: لماذا تزداد ملوحة مياه
        # بئري؟ was read as a trend): answer from the explanation cards instead
        intent, facts = "explain", BUILDERS["explain"](question, grounding, arabic, 0.9)
    if not facts and intent == "live_reading":
        # "How salty is my well?" with no live sensor data (Pepper, or the sensor offline): say so, and give the
        # closest card, such as how to test well water (13 Nov: it fell to the deep path and took minutes)
        card = BUILDERS["explain"](question, grounding, arabic, 0.9) or []
        facts = ["[live sensors] " + ("لا تتوفر الآن قراءة مباشرة من حساس البئر." if arabic
                                      else "No live reading from the well sensor is available right now.")] + card
    if not facts:
        log.info("FAST      %s (%.2f) but no facts for it: deep path", intent, score)
        return None
    facts_text = "\n".join(f"- {f}" for f in facts)
    reader, style = PHRASE_STYLE.get(persona, PHRASE_STYLE["farmer"])
    prompt = PHRASE.format(reader=reader, style=style, language=LANGUAGE_NOTE["ar" if arabic else "en"],
                           question=question, facts=facts_text)
    answer = phraser.invoke([HumanMessage(prompt)]).content.strip()
    reasons = check(answer, facts_text, question)
    seconds = round(time.time() - start, 1)
    if reasons:
        log.info("FAST      %s: answer failed its check (%s): deep path (%.1f s)", intent, "; ".join(reasons), seconds)
        return None
    log.info("FAST      %s (%.2f), %d fact(s), answered in %.1f s", intent, score, len(facts), seconds)
    return dict(path="fast", intent=intent, intent_score=score, facts=facts, answer=answer, seconds=seconds)
