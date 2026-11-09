"""End-to-end test of the website chat: sign in to Deema's dashboard, then ask through its /api/ask route.

Needs both running: the dashboard (scripts/start_dashboard.ps1, with the chat-widget branch) and the agent (python api.py).
Run:  python test_website_chat.py
"""
import json
import os
import sys
import time

import requests

sys.stdout.reconfigure(encoding="utf-8")
SITE = os.environ.get("AQUAMAA_DASHBOARD_URL", "http://localhost:3000")
EMAIL = os.environ.get("AQUAMAA_DASHBOARD_EMAIL", "water.planning@kahramaa.demo")
PASSWORD = os.environ.get("AQUAMAA_DASHBOARD_PASSWORD", "AquaMaa-Demo-2026")

web = requests.Session()

r = requests.post(f"{SITE}/api/ask", json={"question": "Test without signing in"}, timeout=10)
print(f"1. Not signed in: status {r.status_code} (expected 401)")

r = web.post(f"{SITE}/api/auth/login", json={"email": EMAIL, "password": PASSWORD}, timeout=10)
print(f"2. Sign in as {EMAIL}: status {r.status_code}")
r.raise_for_status()

print("3. Agent health through the website:", web.get(f"{SITE}/api/ask/health", timeout=10).json())

r = web.post(f"{SITE}/api/ask", json={"question": "hi"}, timeout=10)
print(f"4. Too-short question: status {r.status_code} (expected 400) {r.json()}")

start = time.time()
r = web.post(f"{SITE}/api/ask", json={"question": "What share of Qatar's water comes from desalination?"}, timeout=300)
print(f"5. Question through the website ({time.time() - start:.1f} s, status {r.status_code}):")
print(json.dumps(r.json(), indent=1, ensure_ascii=False))
