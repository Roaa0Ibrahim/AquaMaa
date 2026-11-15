"""Side by side: local Qwen vs Fanar on the question layers (dialect rewrite, misheard words, re-read).
Same prompts, same code; only the model changes. Questions go one at a time (Qwen is local, Fanar online).
Run:  python compare_fanar.py [Fanar model name]   (output to logs/compare_fanar.txt)
"""
import csv
import sys
import time

from langchain_core.messages import HumanMessage

import guess
import understand
from understand_model import make_model

DIALECT = [r["question"] for r in csv.DictReader(open("tests/arabic_questions.csv", encoding="utf-8-sig"))] + [
    "وش السالفة مع ملوحة البير عندنا؟",
    "شكثر الاملاح في بيري؟",
    "الماي صاير مر، شسوي؟",
    "الحساس يقول تي دي اس ١٢٠٠، زين ولا لا؟",
    "عندي مزرعة في الشمال وابغى احفر بير، شو المطلوب؟",
    "هالماي يصلح للطماط ولا يخرب الزرع؟",
]
MISHEARD = ["كم عدد الغبار في سدرية الخيسة؟", "كم عدد الإضرار في الشحانية؟", "ما آثار الملوحة على النخيل؟",
            "how many wheels are in al khor"]
REREAD = ["is my reading okay?", "كم عدد الغبار في الشحانية؟", "شو صار عندي في البير اليوم؟",
          "who won the football match yesterday?", "how do I test my wheel water?"]

MODELS = {"qwen": make_model(120, "qwen3:14b"), "fanar": make_model(120, sys.argv[1] if len(sys.argv) > 1 else "Fanar-C-2-27B")}


def run(model, prompt):
    start = time.time()
    out = model.invoke([HumanMessage(prompt)]).content.strip()
    out = out.strip('"“”').splitlines()[0].strip() if out else ""
    return out, round(time.time() - start, 1)


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    print("===== DIALECT -> Modern Standard Arabic (every question, the dialect-word check skipped)")
    for q in DIALECT:
        print(f"\nQ: {q}   (dialect check: {'yes' if understand.is_dialect(q) else 'MISSED'})")
        for name, m in MODELS.items():
            out, s = run(m, understand.PROMPT.format(text=q))
            print(f"  {name:6} {s:>4} s  {out}")
    print("\n===== MISHEARD WORDS (the guessing layer, with its suspects and candidates)")
    for q in MISHEARD:
        found = guess.suspects(q)
        print(f"\nQ: {q}   suspects: {found}")
        for name, m in MODELS.items():
            guess.model = m
            out, changed, _, s = guess.guess(q)
            print(f"  {name:6} {s:>4} s  {out}")
    print("\n===== RE-READ (a question that seemed out of scope)")
    for q in REREAD:
        print(f"\nQ: {q}")
        for name, m in MODELS.items():
            out, s = run(m, guess.REREAD.format(text=q))
            print(f"  {name:6} {s:>4} s  {out}")


if __name__ == "__main__":
    main()
