"""End-to-end test of Deema's chat box connected to the AquaMaa agent.

Signs in to the dashboard, shows how many sensor devices her server sees, then asks through her chat box
(POST /api/assistant), exactly as the website does. Needs the dashboard (connect-agent branch) and python api.py running.
Run:  python test_assistant_link.py
"""
import os
import sys
import time

import requests

sys.stdout.reconfigure(encoding="utf-8")
SITE = os.environ.get("AQUAMAA_DASHBOARD_URL", "http://localhost:3000")
EMAIL = os.environ.get("AQUAMAA_DASHBOARD_EMAIL", "water.planning@kahramaa.demo")
PASSWORD = os.environ.get("AQUAMAA_DASHBOARD_PASSWORD", "AquaMaa-Demo-2026")
QUESTIONS = ["What is the salinity of the water right now?", "كم درجة الحموضة في الماء الآن؟"]

web = requests.Session()
r = web.post(f"{SITE}/api/auth/login", json={"email": EMAIL, "password": PASSWORD}, timeout=10)
print(f"1. Sign in as {EMAIL}: status {r.status_code}")
r.raise_for_status()

ctx = web.post(f"{SITE}/api/assistant/context", json={"page": "dashboard", "context": {}}, timeout=30)
print(f"2. Live data her server sees: status {ctx.status_code}")
if ctx.ok:
    devices = ctx.json().get("live", {}).get("devices", [])
    print(f"   {len(devices)} device(s): " + ", ".join(f"{d['device_id']} ({'online' if d['online'] else 'offline'})"
                                                    for d in devices))
else:
    print(f"   {ctx.text[:300]}")

for i, q in enumerate(QUESTIONS, start=3):
    start = time.time()
    a = web.post(f"{SITE}/api/assistant", json={"message": q, "page": "dashboard", "context": {}}, timeout=300)
    print(f"\n{i}. {q}\n   status {a.status_code}, {time.time() - start:.1f} s")
    print("   " + (a.json().get("text") if a.ok else a.text[:400]).replace("\n", "\n   "))
