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
import os
import re
from difflib import SequenceMatcher
from pathlib import Path

from checks import CITATION, _file_of, citation_check, numbers, tool_results_text

CONFLICTS_FILE = Path(__file__).parent / "database" / "12-known-conflicts" / "known_conflicts.csv"
CONFLICTS = list(csv.DictReader(CONFLICTS_FILE.open(encoding="utf-8-sig")))
UNCONFIRMED_NOTE = "Some points couldn't be confirmed from AquaMaa's sources, so they were left out."
NOT_ENOUGH = "AquaMaa's sources don't contain enough evidence to answer this question."
# A sentence ends at . ! ? (or the Arabic ؟) followed by a capital letter, a quote, a bracket or an Arabic letter
SENTENCE_SPLIT = re.compile(r"(?<=[.!?؟])\s+(?=[A-Z\"'(ء-ي])")


def sentences(text):
    return [s for s in SENTENCE_SPLIT.split(text.strip()) if s]


# Sentences saying what the sources don't contain are honest abstentions, so they need no citation
MISSING_INFO = re.compile(r"\b(not (explicitly |directly )?(mentioned|specified|provided|stated|available|given|covered|"
                          r"addressed|included)|do(es)? not (specify|mention|provide|address|contain|give|include|state)|"
                          r"no (mention|information|data|evidence)|isn't (in|covered)|aren't (in|covered))\b"
                          # the same in Arabic: "the sources don't mention / specify / provide", "not mentioned", ...
                          r"|لا (تذكر|يذكر|تحدد|يحدد|توفر|يوفر|تتضمن|يتضمن|تقدم|يقدم|تشير|يشير)|لم (تذكر|يذكر|تحدد|يحدد)"
                          r"|غير (مذكور|متوفر|متاح|محدد)|لا توجد (معلومات|بيانات)", re.I)


SEARCH_TOOLS = ("search_documents", "lookup_table")
CONTRAST = re.compile(r"\b(but|however|although|while|whereas)\b|لكن|إلا أن|بينما|غير أن", re.I)
# Kinds that don't make a sentence wrong: after the repair attempt they are fixed in place, not removed
SOFT_KINDS = ("gave_up_early", "cited_for_missing", "wrong_language")
HEADING = re.compile(r"^\s*#{1,6}\s", re.M)
MAX_SENTENCES = 8              # the prompt asks for at most 5; 8 leaves room for notes
ARABIC_LETTER = re.compile(r"[ء-ي]")
LATIN_LETTER = re.compile(r"[A-Za-z]")


def arabic_share(text):
    """Share of Arabic letters among Arabic and Latin letters, without the citation labels (which stay in English)."""
    text = CITATION.sub("", text)
    ar, la = len(ARABIC_LETTER.findall(text)), len(LATIN_LETTER.findall(text))
    return ar / (ar + la) if ar + la else 0.0


def wrong_language(answer, question):
    """The answer must be in the question's language: mostly Arabic for an Arabic question, mostly not otherwise."""
    question_is_arabic = arabic_share(question) > 0.5
    answer_share = arabic_share(answer)
    return answer_share < 0.5 if question_is_arabic else answer_share > 0.5


def _uncited(sentence):
    """A sentence of more than 4 words with no [citation], unless it says what the sources don't contain."""
    return len(sentence.split()) > 4 and not CITATION.search(sentence) and not MISSING_INFO.search(sentence)


def _cited_for_missing(sentence):
    """Says the sources don't contain something, and cites a file for it (a source can't show its own gap).
    Sentences that also state a fact ("X isn't given, but Y [file]") are left alone."""
    files = [c for c in CITATION.findall(sentence) if "general knowledge" not in c.lower()]
    return bool(MISSING_INFO.search(sentence) and files and not CONTRAST.search(sentence))


def fix_miscopied_citations(answer, tool_text):
    """A cited label that no tool returned, but that is almost exactly a label a tool did return, is the same source
    miscopied (9 Nov, an Arabic answer: "...by-type-of-farm-and-region.txt" for "...by-type-of-the-farm-and-
    municipality.csv row 91"). It is replaced by the real label. A source that only looks similar is not: the two
    file names must share most of their beginning, so NPC_..._2023 is never swapped for PSA_..._2021.
    Returns the answer and the list of (cited, replaced by)."""
    blocks = re.split(r"\n(?=\[)", tool_text)
    labels = [m.group(1) for b in blocks if (m := re.match(r"\[([^\]]+)\]", b))]
    returned_files = {_file_of(l) for l in labels}
    answer_numbers = numbers(CITATION.sub("", answer))
    fixes = []
    for cited in set(CITATION.findall(answer)):
        name = _file_of(cited)
        if name.lower() == "general knowledge" or name.isdigit() or name in returned_files or not labels:
            continue
        best_file, best = None, 0.0
        for f in returned_files:
            prefix = len(os.path.commonprefix([name.lower(), f.lower()]))
            ratio = SequenceMatcher(None, name.lower(), f.lower()).ratio()
            if prefix >= 0.6 * min(len(name), len(f)) and ratio >= 0.7 and ratio > best:
                best_file, best = f, ratio
        if not best_file:
            continue
        # Of that file's labels, prefer the one whose result holds a number the answer uses
        same_file = [(l, b) for l, b in zip(labels, blocks) if _file_of(l) == best_file]
        label = next((l for l, b in same_file if numbers(b) & answer_numbers), same_file[0][0])
        answer = answer.replace(cited, f"[{label}]")
        fixes.append((cited, f"[{label}]"))
    return answer, fixes


def find_problems(answer, trace, question):
    """Deterministic problems in the answer, with the sentences they occur in."""
    tool_text = tool_results_text(trace)
    allowed = numbers(tool_text) | numbers(question)
    invented, _ = citation_check(answer, tool_text)
    body = answer.split("\n\nKey figures:")[0]            # the key figures block is generated, not written by the model
    searches = sum(1 for s in trace if s["step"] == "result" and s["tool"] in SEARCH_TOOLS)
    # "Gave up early" applies only to a pure "not in the sources" answer. An answer that says the exact figure isn't
    # given but offers the closest cited one (9 Nov: wells on farms, K19) is what we want, so it isn't sent back.
    cites_a_source = any("general knowledge" not in c.lower() for c in CITATION.findall(body))
    problems = []
    for s in sentences(body):
        if MISSING_INFO.search(s) and searches < 2 and not cites_a_source:
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
    # Not an answer at all: a report with headings, or far longer than the 5-sentence rule (13 Nov: "What is the
    # fluoride concentration...?" found nothing on fluoride and twice wrote "Qatar's Groundwater Deficit: A Deep Dive")
    if HEADING.search(body) or len(sentences(body)) > MAX_SENTENCES:
        problems.append(dict(kind="off_format", detail=[], sentence=body))
    if wrong_language(body, question):
        target = "Arabic" if arabic_share(question) > 0.5 else "English"
        problems.append(dict(kind="wrong_language", detail=[target], sentence=body))
    return problems


def repair_request(problems):
    """The exact list of problems, written for the agent's one repair attempt."""
    lines = []
    for p in problems:
        if p["kind"] == "number_not_in_tool_results":
            lines.append(f'- "{p["sentence"]}" uses {", ".join(p["detail"])}, which no tool result contains. '
                         "If you added, averaged or divided numbers yourself, call calculate with them now and use its "
                         "result; if a key statistic already gives the figure, use that. Otherwise remove the number.")
        elif p["kind"] == "cited_file_not_returned":
            lines.append(f'- "{p["sentence"]}" cites {", ".join(p["detail"])}, which no tool returned. '
                         "Cite a label from the tool results, or remove the sentence.")
        elif p["kind"] == "gave_up_early":
            lines.append(f'- "{p["sentence"]}" says the sources don\'t have it, after only {p["detail"][0]}. '
                         "Search again first with different words: other terms (municipality for area), no year "
                         "filter, or the place, sector or cause behind the question. Then answer.")
        elif p["kind"] == "off_format":
            lines.append("- This is not an answer to the question: it is a report with headings or far too long. "
                         "Answer the question asked, in at most 5 sentences, with no headings or sections. If the "
                         "tool results don't answer it, say so in one sentence and say what they do cover.")
        elif p["kind"] == "wrong_language":
            lines.append(f"- The answer is not in the question's language. Rewrite the whole answer in "
                         f"{'simple Modern Standard Arabic' if p['detail'][0] == 'Arabic' else 'English'}, with the "
                         "same facts and the same citation labels, written exactly as they are.")
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
    if any(p["kind"] == "off_format" for p in problems):
        # Still a report after the repair: no part of it is shown
        return f"{NOT_ENOUGH}\n\n{UNCONFIRMED_NOTE}"
    failing = {p["sentence"] for p in problems if p["kind"] not in SOFT_KINDS}
    if not failing:
        return answer
    body, _, figures = answer.partition("\n\nKey figures:")
    kept = [s for s in sentences(body) if s not in failing]
    # What is left must still say something supported or honest: a cited sentence or a "not in the sources" one.
    # Otherwise (13 Nov: a derailed essay left only "### **1." and a note about edits) the clear message is used.
    useful = any(CITATION.search(s) or MISSING_INFO.search(s) for s in kept)
    text = " ".join(kept) if kept and useful else NOT_ENOUGH
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
