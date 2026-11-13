"""Spoken alerts (scene 3 of the demo): when Deema's dashboard flags a new problem, AquaMaa writes one short sentence
for Pepper and the website to say, without anyone asking.

How it works:
  - api.py polls Deema's live data every few seconds (dashboard.grounding()) and passes it to AlertWatcher.process()
  - her server already detects the problems: grounding["live"]["alerts"], each with a stable id such as
    thr:<device>:tds_ppm (a reading outside its reference range), off:<device> (no recent readings) or dev:<param>
    (an unusual change from recent history)
  - a NEW id becomes a message; an id that disappears becomes a "back to normal" message
  - messages are built from templates and the fast-path tables (meanings, crops), so they are instant and never wait
    for the model, in English or Arabic (AQUAMAA_ALERT_LANGUAGE)
  - alerts that already exist when the service starts are not announced (no backlog)
Pepper and the website read the messages from GET /alerts?after=<last seq seen>.
"""
from collections import deque
from datetime import datetime, timedelta, timezone

from fastpath.facts import CROPS, MEANINGS, TDS_PER_ECW, _fmt, _num

QATAR = timezone(timedelta(hours=3))
NAMES = {
    "en": {"tds_ppm": "salinity (TDS)", "ph": "pH", "temperature": "water temperature", "turbidity_raw": "turbidity"},
    "ar": {"tds_ppm": "الملوحة", "ph": "درجة الحموضة", "temperature": "حرارة الماء", "turbidity_raw": "العكارة"},
}
UNITS = {"tds_ppm": "ppm", "ph": "", "temperature": "°C", "turbidity_raw": ""}
SENSOR_OF = {"tds_ppm": "tds", "ph": "ph"}


def meaning_row(sensor, use, value):
    for r in MEANINGS:
        if r["sensor"] == sensor and r["use"] == use:
            low = _num(r["low"]) if r["low"] else float("-inf")
            high = _num(r["high"]) if r["high"] else float("inf")
            if low <= value < high:
                return r
    return None


def latest(grounding, device, param):
    for d in ((grounding.get("live") or {}).get("devices") or []):
        if d.get("device_id") == device:
            v = ((d.get("latestFresh") or {}).get(param) or {}).get("value")
            return v if isinstance(v, (int, float)) else None
    return None


def threshold_message(alert, grounding, lang):
    device, param = alert.get("device_id", "a sensor"), alert.get("param")
    value = latest(grounding, device, param)
    name, unit = NAMES[lang].get(param, param), UNITS.get(param, "")
    shown = f"{_fmt(value)} {unit}".strip() if value is not None else alert.get("detail", "")
    if lang == "ar":
        text = f"تنبيه: {name} في {device} أصبحت {shown}، وهي خارج المدى المرجعي."
    else:
        text = f"Alert: the {name} at {device} is now {shown}, outside its reference range."
    sensor = SENSOR_OF.get(param)
    if sensor and value is not None:
        # One use only, so the spoken alert stays short: irrigation first (these are farm wells), else drinking
        for use in ("irrigation", "drinking"):
            row = meaning_row(sensor, use, value)
            if row and row["level"] != "good":
                text += f" {row['meaning_' + lang]}؛ {row['advice_' + lang]}." if lang == "ar" else \
                        f" For {use}: {row['meaning_en']}; {row['advice_en']}."
                break
        if sensor == "tds":
            fine = [c["crop_" + lang] for c in CROPS if float(c["ecw_no_loss"]) * TDS_PER_ECW >= value]
            if fine:
                text += (f" المحاصيل التي تتحمل هذا المستوى دون خسارة: {'، '.join(fine)}." if lang == "ar" else
                         f" Crops that still grow without loss at this level: {', '.join(fine)}.")
    return text


def message_for(alert, grounding, lang):
    kind = alert.get("type")
    if kind == "threshold":
        return threshold_message(alert, grounding, lang)
    if kind == "offline":
        device = alert.get("device_id", "a sensor")
        return (f"تنبيه: الحساس {device} توقف عن الإرسال. {alert.get('detail', '')}" if lang == "ar" else
                f"Notice: sensor {device} has stopped reporting. {alert.get('detail', '')}.")
    if kind == "deviation":
        name = NAMES[lang].get(alert.get("param"), alert.get("param"))
        return (f"ملاحظة: {name} تغيرت بشكل غير معتاد مقارنة بالقراءات السابقة." if lang == "ar" else
                f"Notice: the {name} has changed unusually compared with its recent history ({alert.get('detail', '')}).")
    return alert.get("title", "")


def cleared_message(alert, lang):
    kind, device = alert.get("type"), alert.get("device_id", "")
    name = NAMES[lang].get(alert.get("param"), alert.get("param") or "")
    if kind == "offline":
        return f"الحساس {device} عاد للإرسال." if lang == "ar" else f"Sensor {device} is reporting again."
    if kind == "threshold":
        return (f"{name} في {device} عادت ضمن المدى المرجعي." if lang == "ar" else
                f"The {name} at {device} is back within its reference range.")
    return ""


class AlertWatcher:
    def __init__(self, lang="en", keep=50):
        self.lang = lang if lang in NAMES else "en"
        self.active = None                      # alert id -> alert, as seen at the last poll; None before the first
        self.messages = deque(maxlen=keep)
        self.seq = 0

    def _add(self, alert, text, kind):
        self.seq += 1
        self.messages.append(dict(seq=self.seq, kind=kind, id=alert.get("id"), severity=alert.get("severity"),
                                  device_id=alert.get("device_id"), text=text,
                                  at=datetime.now(QATAR).strftime("%H:%M:%S")))

    def process(self, grounding):
        """New messages from this poll of the live data."""
        current = {a["id"]: a for a in ((grounding.get("live") or {}).get("alerts") or []) if a.get("id")}
        if self.active is None:                 # first poll: remember what is already there, announce nothing
            self.active = current
            return []
        start = self.seq
        for aid, alert in current.items():
            if aid not in self.active:
                self._add(alert, message_for(alert, grounding, self.lang), "alert")
        for aid, alert in self.active.items():
            if aid not in current:
                text = cleared_message(alert, self.lang)
                if text:
                    self._add(alert, text, "cleared")
        self.active = current
        return [m for m in self.messages if m["seq"] > start]

    def since(self, after):
        return [m for m in self.messages if m["seq"] > after]
