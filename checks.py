"""Deterministic answer checks, used to measure answers (not steps in the agent).

numbers(text)                      -> the numbers written in a text, without thousands separators
tool_results_text(trace)           -> all tool results joined so each result's labels start a line
uncited_sentences(answer)          -> sentences with no [citation]
citation_check(answer, tool_text)  -> (files cited but never returned by a tool, number of [general knowledge] tags)
"""
import re

CITATION = re.compile(r"\[[^\]]*\]")          # [file p.3] citations hold page numbers, not answer numbers


def numbers(text):
    """Numbers as written, without thousands separators or a trailing full stop: '1,000.' -> '1000'."""
    return {n.replace(",", "") for n in re.findall(r"\d[\d,]*(?:\.\d+)?", text)}


def tool_results_text(trace):
    """All tool results, one per line block, so every result's labels start a line."""
    return "\n".join(s["text"] for s in trace if s["step"] == "result")


def uncited_sentences(answer):
    """Sentences with no [citation], ignoring short lead-ins such as "No." or "Yes,"."""
    sentences = re.split(r"(?<=[.!?])\s+", answer.strip())
    return [s for s in sentences if len(s.split()) > 4 and not CITATION.search(s)]


def citation_check(answer, tool_text):
    """Compares file names only, so "[file p.2-7]" matches a tool result labelled "[file p.2]"."""
    returned = {label.split(" p.")[0].strip() for label in re.findall(r"^\[([^\]]+)\]", tool_text, re.M)}
    cited = [c.strip("[]").split(" p.")[0].strip() for c in CITATION.findall(answer)]
    general = sum(c.lower() == "general knowledge" for c in cited)
    invented = sorted({c for c in cited if c.lower() != "general knowledge" and c not in returned and not c.isdigit()})
    return invented, general
