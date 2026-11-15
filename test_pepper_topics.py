"""Asks AquaMaa every Pepper topic the way the Pepper app does (POST /pepper/ask with a topic and a mode), for the
officer and the farmer, and prints each answer and its time. AquaMaa (api.py) must be running.
Run:  python test_pepper_topics.py      (output also in logs/pepper_topics_test.txt)
"""
import sys
import time

import httpx

OFFICER = ["hello", "report", "salinity", "attention", "offline", "index", "ph", "municipality", "trend", "law", "dashboard"]
FARMER = ["report", "salinity", "temperature", "ph", "drink", "irrigation", "crops", "trend", "advice", "test", "bye"]

sys.stdout.reconfigure(encoding="utf-8")
lines = []
for mode, topics in (("officer", OFFICER), ("farmer", FARMER)):
    for topic in topics:
        t = time.time()
        try:
            r = httpx.post("http://127.0.0.1:8000/pepper/ask", json={"topic": topic, "mode": mode}, timeout=240).json()
            answer = r.get("answer", "")
        except Exception as error:
            answer = f"ERROR {error}"
        s = time.time() - t
        out = f"[{mode} · {topic} · {s:.1f} s]\n{answer}\n"
        print(out, flush=True)
        lines.append(out)
open("logs/pepper_topics_test.txt", "w", encoding="utf-8").write("\n".join(lines))
