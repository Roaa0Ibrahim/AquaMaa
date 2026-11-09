"""Milestone 5: the verifier, a fixed step after the agent answers.

find_problems(answer, trace, question) -> the deterministic problems in an answer:
    numbers not found in any tool result, cited files no tool returned, sentences with no citation.
remove_failing(answer, problems)        -> the answer without the sentences that still fail, plus a note.
conflict_notes(answer)                  -> notes for known conflicts the answer touches on one side only.

In the graph, an answer with problems gets one repair attempt by the agent; whatever still fails is
removed (decided option B: drop it, and say that some points couldn't be confirmed).
Test on a saved run: python verifier.py runs/agent_20261107-212533.json
"""
import csv
import re
from pathlib import Path

from checks import CITATION, citation_check, numbers, tool_results_text

CONFLICTS_FILE = Path(__file__).parent / "database" / "12-known-conflicts" / "known_conflicts.csv"
CONFLICTS = list(csv.DictReader(CONFLICTS_FILE.open(encoding="utf-8-sig")))
UNCONFIRMED_NOTE = "Some points couldn't be confirmed from AquaMaa's sources, so they were left out."
SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+(?=[A-Z\"'(])")


def sentences(text):
    return [s for s in SENTENCE_SPLIT.split(text.strip()) if s]


# Sentences saying what the sources don't contain are honest abstentions, so they need no citation
MISSING_INFO = re.compile(r"\b(not (explicitly |directly )?(mentioned|specified|provided|stated|available|given|covered|"
                          r"addressed|included)|do(es)? not (specify|mention|provide|address|contain|give|include|state)|"
                          r"no (mention|information|data|evidence)|isn't (in|covered)|aren't (in|covered))\b", re.I)


SEARCH_TOOLS = ("search_documents", "lookup_table")
CONTRAST = re.compile(r"\b(but|however|although|while|whereas)\b", re.I)
# Kinds that don't make a sentence wrong: after the repair attempt they are fixed in place, not removed
SOFT_KINDS = ("gave_up_early", "cited_for_missing")


def _uncited(sentence):
    """A sentence of more than 4 words with no [citation], unless it says what the sources don't contain."""
    return len(sentence.split()) > 4 and not CITATION.search(sentence) and not MISSING_INFO.search(sentence)


def _cited_for_missing(sentence):
    """Says the sources don't contain something, and cites a file for it (a source can't show its own gap).
    Sentences that also state a fact ("X isn't given, but Y [file]") are left alone."""
    files = [c for c in CITATION.findall(sentence) if "general knowledge" not in c.lower()]
    return bool(MISSING_INFO.search(sentence) and files and not CONTRAST.search(sentence))


def find_problems(answer, trace, question):
    """Deterministic problems in the answer, with the sentences they occur in."""
    tool_text = tool_results_text(trace)
    allowed = numbers(tool_text) | numbers(question)
    invented, _ = citation_check(answer, tool_text)
    body = answer.split("\n\nKey figures:")[0]            # the key figures block is generated, not written by the model
    searches = sum(1 for s in trace if s["step"] == "result" and s["tool"] in SEARCH_TOOLS)
    problems = []
    for s in sentences(body):
        if MISSING_INFO.search(s) and searches < 2:
            problems.append(dict(kind="gave_up_early", detail=[f"{searches} search(es)"], sentence=s))
        if _cited_for_missing(s):
            problems.append(dict(kind="cited_for_missing", detail=[], sentence=s))
        bad_numbers = sorted(numbers(CITATION.sub("", s)) - allowed)
        bad_cites = [c for c in invented if c in s]
        if bad_numbers:
            problems.append(dict(kind="number_not_in_tool_results", detail=bad_numbers, sentence=s))
        if bad_cites:
            problems.append(dict(kind="cited_file_not_returned", detail=bad_cites, sentence=s))
        if _uncited(s):
            problems.append(dict(kind="sentence_without_citation", detail=[], sentence=s))
    return problems


def repair_request(problems):
    """The exact list of problems, written for the agent's one repair attempt."""
    lines = []
    for p in problems:
        if p["kind"] == "number_not_in_tool_results":
            lines.append(f'- "{p["sentence"]}" uses {", ".join(p["detail"])}, which no tool result contains. '
                         "Use calculate for derived numbers, or remove the number.")
        elif p["kind"] == "cited_file_not_returned":
            lines.append(f'- "{p["sentence"]}" cites {", ".join(p["detail"])}, which no tool returned. '
                         "Cite a label from the tool results, or remove the sentence.")
        elif p["kind"] == "gave_up_early":
            lines.append(f'- "{p["sentence"]}" says the sources don\'t have it, after only {p["detail"][0]}. '
                         "Search again first with different words: other terms (municipality for area), no year "
                         "filter, or the place, sector or cause behind the question. Then answer.")
        elif p["kind"] == "cited_for_missing":
            lines.append(f'- "{p["sentence"]}" says the sources don\'t have something but cites a file. '
                         "Remove the citation from that sentence, or, if the cited result does answer, use what it says.")
        else:
            lines.append(f'- "{p["sentence"]}" has no citation. Add the label it rests on, '
                         "mark it [general knowledge] if it is general knowledge you are sure of, or remove it.")
    return ("Your answer has these problems. Rewrite it fixing every one, using only the tool results above, "
            "and keep the rest unchanged:\n" + "\n".join(lines))


def remove_failing(answer, problems):
    """Drops every sentence that still has a problem, and adds the note if anything was dropped.
    Soft problems are fixed in place instead: a file citation on a "not in the sources" sentence is removed,
    and a sentence that gave up early stays (it is honest; the repair attempt already asked for another search)."""
    for p in problems:
        if p["kind"] == "cited_for_missing":
            fixed = CITATION.sub("", p["sentence"]).replace(" .", ".").strip()
            answer = answer.replace(p["sentence"], fixed)
    failing = {p["sentence"] for p in problems if p["kind"] not in SOFT_KINDS}
    if not failing:
        return answer
    body, _, figures = answer.partition("\n\nKey figures:")
    kept = [s for s in sentences(body) if s not in failing]
    text = " ".join(kept) if kept else ("AquaMaa's sources don't contain enough evidence to answer this question.")
    text += f"\n\n{UNCONFIRMED_NOTE}"
    return text + (f"\n\nKey figures:{figures}" if figures else "")


def _label(source):
    return source if source.startswith("[") else f"({source})"


def conflict_notes(answer):
    """For each known conflict the answer touches, a note giving both sides, unless the answer already gives both."""
    lowered = answer.lower()
    notes = []
    for c in CONFLICTS:
        terms = [t.strip().lower() for t in c["trigger_terms"].split(";") if t.strip()]
        if not any(t in lowered for t in terms):
            continue
        # Only the numbers that differ between the two sides count (200 vs 180), not shared ones like the year
        a_nums, b_nums = numbers(c["side_a"]), numbers(c["side_b"])
        a_only, b_only = a_nums - b_nums, b_nums - a_nums
        answer_nums = numbers(CITATION.sub("", answer))
        gives_a = bool(a_only & answer_nums)
        gives_b = bool(b_only & answer_nums)
        if gives_a and gives_b:
            continue                              # both sides are already in the answer
        if not (gives_a or gives_b):
            continue                              # the answer doesn't use either figure, so no conflict to flag
        side_b = c["side_b"]
        if len(side_b) > 1 and side_b[1].islower():          # "The 2021 report" -> "the 2021 report", but keep "NPC's"
            side_b = side_b[0].lower() + side_b[1:]
        notes.append(f"{c['side_a']} {_label(c['source_a'])}, while {side_b} {_label(c['source_b'])}. "
                     f"{c['explanation']}.")
    return notes


if __name__ == "__main__":
    import json
    import sys
    sys.stdout.reconfigure(encoding="utf-8")
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else max(Path("runs").glob("agent_*.json"), key=lambda p: p.stat().st_mtime)
    run = json.load(open(path, encoding="utf-8"))
    kinds, needing_repair, with_conflicts = {}, 0, 0
    for a in run["answers"]:
        if a["got_type"] == "out_of_scope":
            continue
        problems = find_problems(a["answer"], a["trace"], a["question"])
        notes = conflict_notes(a["answer"])
        needing_repair += bool(problems)
        with_conflicts += bool(notes)
        for p in problems:
            kinds[p["kind"]] = kinds.get(p["kind"], 0) + 1
        if problems or notes:
            print(f"\n{a.get('id', '')} {a['question']}")
            for p in problems:
                print(f"   {p['kind']}: {p['detail']}  <- {p['sentence'][:100]}")
            for n in notes:
                print(f"   CONFLICT NOTE: {n[:160]}")
    print(f"\n{path.name}: {needing_repair} answers would get a repair attempt; problems by kind: {kinds}; "
          f"{with_conflicts} answers would get a conflict note")
