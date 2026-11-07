"""Compares all logged answer runs. Run: python analyze_runs.py"""
import pandas as pd

df = pd.read_json("logs/answers_log.jsonl", lines=True)
in_scope = df[df["got_type"] != "out_of_scope"]

summary = in_scope.groupby("run_id").agg(
    code_version=("code_version", "first"),
    answers=("question", "count"),
    numbers_all_found=("numbers_not_in_evidence", lambda s: (s.str.len() == 0).mean()),
)
print(summary)
