"""Tests the agent service: health check, one real question, and rejection of a bad request.

Start the service first (python api.py), then run:  python test_api.py
"""
import json
import os
import sys
import time

import requests

sys.stdout.reconfigure(encoding="utf-8")
URL = os.environ.get("AQUAMAA_API_URL", "http://127.0.0.1:8000")
headers = {"X-AquaMaa-Key": os.environ["AQUAMAA_API_KEY"]} if os.environ.get("AQUAMAA_API_KEY") else {}

print("1. Health:", requests.get(f"{URL}/health", timeout=5).json())

start = time.time()
r = requests.post(f"{URL}/ask", json={"question": "How much rain recharges Qatar's aquifers each year?",
                                      "role": "kahramaa"}, headers=headers, timeout=300)
print(f"2. Question ({time.time() - start:.1f} s, status {r.status_code}):")
print(json.dumps(r.json(), indent=1, ensure_ascii=False))

bad = requests.post(f"{URL}/ask", json={"question": ""}, headers=headers, timeout=10)
print(f"3. Empty question rejected: status {bad.status_code} (expected 422)")
