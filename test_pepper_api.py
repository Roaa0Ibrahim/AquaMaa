"""Makes exactly the calls the Pepper app makes (pepper/.../AgentClient.kt), so the service side can be checked without
the robot: POST /ask with role officer and live true, then GET /alerts.
Needs python api.py and the dashboard running.
Run:  python test_pepper_api.py
"""
import os
import sys
import time

import requests

sys.stdout.reconfigure(encoding="utf-8")
URL = os.environ.get("AQUAMAA_API_URL", "http://127.0.0.1:8000")
QUESTIONS = ["What is the salinity of the water right now", "Is the water right now suitable for irrigation",
             "Which sensors need attention and which are offline right now", "Do farmers need a licence to dig a new well"]

for q in QUESTIONS:
    start = time.time()
    r = requests.post(f"{URL}/ask", json={"question": q, "role": "officer", "live": True}, timeout=180)
    print(f"\nPepper hears: {q}\n   {time.time() - start:.1f} s, status {r.status_code}\n   {r.json().get('answer')}")

a = requests.get(f"{URL}/alerts", params={"after": 0}, timeout=5).json()
print(f"\nAlerts so far: {len(a['messages'])} (last seq {a['last']})")
