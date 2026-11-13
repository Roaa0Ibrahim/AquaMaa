"""The dialect layer (13 Nov): a question in Qatari or Gulf dialect is rewritten into Modern Standard Arabic before
the rest of AquaMaa reads it, so the search, the question type and the cards work on standard words.
    "ليش ماي البير صار مالح؟"  ->  "لماذا أصبح ماء البئر مالحًا؟"
Only questions with dialect words pay for it (about 1 s): DIALECT_WORDS is a quick check, no model.
One short call to the chat model; the meaning must not change, and a safety check keeps the original when the
rewrite is too different. The answer still comes in simple Modern Standard Arabic, as agreed.
Test:  python understand.py "ليش ماي البير صار مالح"
"""
import re
import sys
import time
from difflib import SequenceMatcher

from langchain_core.messages import HumanMessage

from understand_model import make_model

DIALECT_WORDS = re.compile(
    r"(^|\s)(ليش|ليه|شنو|شو|وش|ايش|إيش|شلون|كيفك|الحين|ذحين|زين|مب|مو|ماي|الماي|البير|بير|أبي|ابي|ابغى|أبغى|وايد|"
    r"عشان|علشان|هال\S*|هذي|ذي|اللي|يبه|يعني|أقدر|اقدر|نقدر|ينفع|يصير|صار|خلاص|شي|اشلون|كذا)(\s|$|[؟?،,.])")
MIN_SIMILARITY = 0.35          # dialect and standard Arabic differ a lot, so this only blocks a different question
model = make_model(num_predict=120)     # local Qwen, or Fanar (understand_model.py)

PROMPT = """Rewrite this question from Qatari or Gulf Arabic dialect into clear Modern Standard Arabic.
Keep exactly the same meaning, the same numbers, units and place names. Don't answer it and don't add anything.
Examples:
"ليش ماي البير صار مالح؟" -> "لماذا أصبح ماء البئر مالحًا؟"
"أقدر أسقي النخل بهالماي؟" -> "هل يمكنني سقي النخيل بهذا الماء؟"
"شنو قراءة الحساس الحين؟" -> "ما قراءة الحساس الآن؟"
Question: {text}
Modern Standard Arabic:"""


DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")


def numbers(text):
    """The numbers in a text, Arabic-Indic digits read as 0-9, so ٣٠٠٠ and 3000 are equal."""
    return sorted(re.findall(r"\d+(?:\.\d+)?", text.translate(DIGITS)))


def is_dialect(text):
    return bool(DIALECT_WORDS.search(text or ""))


def to_msa(text):
    """(question to use, rewritten?, seconds). Non-dialect questions come back unchanged with no model call."""
    text = (text or "").strip()
    if not is_dialect(text):
        return text, False, 0.0
    start = time.time()
    out = model.invoke([HumanMessage(PROMPT.format(text=text))]).content.strip()
    out = out.strip('"“”').splitlines()[0].strip() if out else ""
    out = out.translate(DIGITS)     # 0-9 digits, as the rest of AquaMaa reads them (Fanar wrote ٣٠٠٠ for 3000)
    if not out or SequenceMatcher(None, text, out).ratio() < MIN_SIMILARITY or numbers(out) != numbers(text):
        # a different question, or a number lost or changed (13 Nov: "تي دي اس ١٢٠٠" came back without 1200)
        return text, False, round(time.time() - start, 1)
    return out, out != text, round(time.time() - start, 1)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    for q in sys.argv[1:] or ["ليش ماي البير صار مالح؟", "كيف اقيس جودة ماء البير", "ما ملوحة الماء الآن؟"]:
        msa, changed, s = to_msa(q)
        print(f"Asked:      {q}\nUnderstood: {msa}\nRewritten: {changed}, {s} s\n")
