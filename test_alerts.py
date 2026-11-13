"""Offline test of the spoken alerts (alerts.py): no model, no dashboard needed.

Feeds the watcher a made-up sequence of live data, shaped like Deema's grounding, as in the demo:
  1. normal water: nothing to announce (the first poll is never announced)
  2. salty water: her server flags TDS out of range -> one alert, with meaning, advice and crops
  3. still salty: nothing new
  4. back to normal: one "back within range" message
  5. the sensor goes offline -> one notice
Then the same salty alert in Arabic.
Run:  python test_alerts.py
"""
import sys

from alerts import AlertWatcher

sys.stdout.reconfigure(encoding="utf-8")
DEVICE = "AquaNova-ESP32-01"


def live(tds, alerts=()):
    return {"live": {"devices": [{"device_id": DEVICE, "online": True,
                                  "latestFresh": {"tds_ppm": {"value": tds}, "ph": {"value": 7.4}}}],
                     "alerts": list(alerts)}}


salty = {"id": f"thr:{DEVICE}:tds_ppm", "severity": "warning", "type": "threshold", "device_id": DEVICE,
         "param": "tds_ppm", "title": "Total dissolved solids above reference range", "detail": f"{DEVICE}: 2400"}
offline = {"id": f"off:{DEVICE}", "severity": "warning", "type": "offline", "device_id": DEVICE,
           "title": "No recent readings", "detail": f"{DEVICE} last reported 12 min ago"}

w = AlertWatcher("en")
steps = [("normal water", live(350)), ("salty water", live(2400, [salty])), ("still salty", live(2410, [salty])),
         ("back to normal", live(380)), ("sensor offline", live(380, [offline]))]
results = []
for name, g in steps:
    new = w.process(g)
    results.append((name, len(new)))
    print(f"{name}: {len(new)} message(s)")
    for m in new:
        print(f"   [{m['kind']}] {m['text']}")

expected = [0, 1, 0, 1, 1]
ok = [n for _, n in results] == expected
print(f"\nCounts {[n for _, n in results]}, expected {expected}: {'PASS' if ok else 'FAIL'}")

ar = AlertWatcher("ar")
ar.process(live(350))
print("\nArabic:", ar.process(live(2400, [salty]))[0]["text"])
print(f"\nGET /alerts?after=1 would return: {[m['seq'] for m in w.since(1)]}")
