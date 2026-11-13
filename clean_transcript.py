"""Fixes speech-recognition mistakes in a spoken question before it goes to the AI, using the guessing layer
(guess.py): words that don't fit AquaMaa's vocabulary but look or sound like a word that does are checked in
context, and replaced only when they don't make sense. No hand-written word lists.
Used by POST /clean in api.py, which the website chat box calls after speech recognition (public/speech.js).
Test:  python clean_transcript.py "كم عدد الغبار في سدرية الكيسة؟"
"""
import sys

from guess import guess


def clean(text):
    """(corrected text, changed?, seconds)."""
    fixed, changed, _, seconds = guess(text)
    return fixed, changed, seconds


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    for heard in sys.argv[1:] or ["كم عدد الغبار في سدرية الكيسة؟"]:
        fixed, changed, seconds = clean(heard)
        print(f"Heard:     {heard}\nCorrected: {fixed}\nChanged: {changed}, {seconds} s\n")
