"""The fast path (13 Nov): facts by code, words by the model, in one short call.

    question -> intent (fastpath/intents.py, ~0.2 s) -> facts (fastpath/facts.py, code) -> one phrasing call
             -> check: every number comes from the facts or the question, right language, short, no headings
             -> answer, or None: the question then takes the deep path (the full agent in agent.py)
Switch off with  $env:AQUAMAA_FAST = "0"
"""
import re
import time

from langchain_core.messages import HumanMessage
from langchain_ollama import ChatOllama

from agent_log import log
from checks import CITATION, numbers
from config import CHAT_MODEL, FANAR_API_KEY, FAST_PHRASE_MODEL, OLLAMA_URL
from understand_model import make_model
from fastpath.facts import BUILDERS, no_reading
from fastpath.intents import detect
from prompts import LANGUAGE_NOTE, PHRASE, PHRASE_STYLE
from retrieval import is_arabic
from verifier import HEADING, sentences, wrong_language

MAX_SENTENCES = 5
phraser = ChatOllama(model=CHAT_MODEL, temperature=0, reasoning=False, base_url=OLLAMA_URL, num_predict=220,
                     keep_alive="2h")      # keep the model loaded between questions: no reload pause
# The farmer gets at most 3 short sentences, so fewer words to write: the answer comes sooner (14 Nov: farm
# questions took 3.5-8 s, almost all of it writing)
farmer_phraser = ChatOllama(model=CHAT_MODEL, temperature=0, reasoning=False, base_url=OLLAMA_URL, num_predict=130,
                            keep_alive="2h")
# A small model words the farmer's answer first (about 4-5x faster); the same check applies, and the big model tries
# if it fails. The facts and verdicts are already decided by code, so the small model only has to phrase them.
small_phraser = ChatOllama(model=FAST_PHRASE_MODEL, temperature=0, base_url=OLLAMA_URL, num_predict=130,
                           keep_alive="2h") if FAST_PHRASE_MODEL else None
# Only where code has already decided the verdict, so wording it is simple (14 Nov: on a trend question the small
# model said to keep salinity "below 92 mg/L", correct numbers in a wrong sentence); trends, explanations and law
# stay with the big model
SMALL_MODEL_INTENTS = {"live_reading", "suitability", "page"}
# Arabic farm answers are worded by Fanar (online, good Arabic, about 1.5 s); without a key, the big local model
arabic_phraser = make_model(130, "Fanar-C-2-27B") if FANAR_API_KEY else None


def tidy_tags(answer):
    """Source tags joined with an Arabic comma ("[AquaMaa check، limits.csv row 2]") split into the facts' own tags."""
    return re.sub(r"\[([^\]]*?)،\s*([^\]]*?)\]", r"[\1] [\2]", answer)


def warm():
    """Loads the small model when the service starts, so the first farm question is fast too."""
    if small_phraser is not None:
        try:
            small_phraser.invoke([HumanMessage("Reply with: ok")])
        except Exception:
            pass


# Answers already written, for the same question, reader and facts: returned at once (the farm page's "Ask AquaMaa"
# button and rehearsed questions). New readings change the facts, so a changed well gets a new answer.
_answers = {}
MAX_REMEMBERED = 200


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


def fast_answer(question, persona, grounding, intent=None):
    """A fast answer dict, or None to use the deep path. intent: given by Pepper's topic (15 Nov), else detected."""
    start = time.time()
    if intent:
        score, example = 1.0, "(given)"
    else:
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
        facts = no_reading(grounding, arabic)
    if not facts:
        log.info("FAST      %s (%.2f) but no facts for it: deep path", intent, score)
        return None
    facts_text = "\n".join(f"- {f}" for f in facts)
    reader, style = PHRASE_STYLE.get(persona, PHRASE_STYLE["farmer"])
    prompt = PHRASE.format(reader=reader, style=style, language=LANGUAGE_NOTE["ar" if arabic else "en"],
                           question=question, facts=facts_text)
    key = (question.strip().lower(), persona, facts_text)
    if key in _answers:
        log.info("FAST      %s: the same question with the same facts, answered at once", intent)
        return dict(path="fast", intent=intent, intent_score=score, facts=facts, answer=_answers[key],
                    seconds=round(time.time() - start, 1))
    answer, reasons = "", ["not tried"]
    # English: the small local model; Arabic: Fanar (14 Nov: the small model's Arabic repeated the question and
    # misspelled a word). Either falls back to the big local model.
    quick = (arabic_phraser if arabic else small_phraser)
    if persona == "farmer" and quick is not None and intent in SMALL_MODEL_INTENTS:
        try:
            answer = tidy_tags(quick.invoke([HumanMessage(prompt)]).content.strip())
            reasons = check(answer, facts_text, question)
            if reasons:
                log.info("FAST      small model's answer failed its check (%s); the big model tries", "; ".join(reasons))
        except Exception as error:                           # the small model isn't installed or failed
            log.info("FAST      small model unavailable (%s); the big model answers", error)
    if reasons:
        model = farmer_phraser if persona == "farmer" else phraser
        answer = tidy_tags(model.invoke([HumanMessage(prompt)]).content.strip())
        reasons = check(answer, facts_text, question)
    if not reasons:
        if len(_answers) >= MAX_REMEMBERED:
            _answers.pop(next(iter(_answers)))
        _answers[key] = answer
    seconds = round(time.time() - start, 1)
    if reasons:
        log.info("FAST      %s: answer failed its check (%s): deep path (%.1f s)", intent, "; ".join(reasons), seconds)
        return None
    log.info("FAST      %s (%.2f), %d fact(s), answered in %.1f s", intent, score, len(facts), seconds)
    return dict(path="fast", intent=intent, intent_score=score, facts=facts, answer=answer, seconds=seconds)
