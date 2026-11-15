"""Milestone 8: read the figures Deema's dashboard shows, through its API, so the agent can answer about them.

Each view is returned as labelled lines, like the other tools, for example:
    [dashboard overview 2022] Groundwater extraction: 250 MCM/year (status: demonstration; source: ...)
The label lets the agent cite the dashboard, and lets the checks confirm every number came from it.

Settings (environment variables, or the defaults below):
    AQUAMAA_DASHBOARD_URL       http://localhost:3000
    AQUAMAA_DASHBOARD_EMAIL     a service account; in demonstration mode the researcher demo account is used
    AQUAMAA_DASHBOARD_PASSWORD  in demonstration mode, the demo password from Deema's README
Start the dashboard with:  powershell -ExecutionPolicy Bypass -File scripts\\start_dashboard.ps1
Test:                      python dashboard.py
"""
import os

import requests

URL = os.environ.get("AQUAMAA_DASHBOARD_URL", "http://localhost:3000")
EMAIL = os.environ.get("AQUAMAA_DASHBOARD_EMAIL")
PASSWORD = os.environ.get("AQUAMAA_DASHBOARD_PASSWORD", "AquaMaa-Demo-2026")
VIEWS = ("overview", "extraction_trend", "wells", "stations", "station_readings")

_session = None


class DashboardError(Exception):
    pass


def _login():
    """Logs in once and keeps the session cookie. In demonstration mode, picks the researcher demo account."""
    global _session
    s = requests.Session()
    email = EMAIL
    if not email:
        accounts = s.get(f"{URL}/api/auth/demo-accounts", timeout=10).json().get("accounts", [])
        researcher = [a for a in accounts if "research" in (a.get("title", "") + a.get("email", "")).lower()]
        if not (researcher or accounts):
            raise DashboardError("No dashboard account set: give AQUAMAA_DASHBOARD_EMAIL and AQUAMAA_DASHBOARD_PASSWORD")
        email = (researcher or accounts)[0]["email"]
    r = s.post(f"{URL}/api/auth/login", json={"email": email, "password": PASSWORD}, timeout=10)
    if r.status_code != 200:
        raise DashboardError(f"Dashboard login failed ({r.status_code}): {r.text[:120]}")
    _session = s


def _get(path, **params):
    if _session is None:
        _login()
    r = _session.get(f"{URL}{path}", params=params, timeout=15)
    if r.status_code == 401:                     # session expired: log in again once
        _login()
        r = _session.get(f"{URL}{path}", params=params, timeout=15)
    if r.status_code != 200:
        raise DashboardError(f"{path} returned {r.status_code}: {r.text[:120]}")
    return r.json()


def grounding(page="dashboard"):
    """The live sensor data as Deema's server prepares it for her chat box (POST /api/assistant/context): each
    device's latest values, online or offline, her thresholds, and her alerts. Read by alerts.py."""
    try:
        if _session is None:
            _login()
        r = _session.post(f"{URL}/api/assistant/context", json={"page": page, "context": {}}, timeout=15)
        if r.status_code == 401:
            _login()
            r = _session.post(f"{URL}/api/assistant/context", json={"page": page, "context": {}}, timeout=15)
    except requests.RequestException as error:
        raise DashboardError(f"The dashboard at {URL} can't be reached: {error.__class__.__name__}") from error
    if r.status_code != 200:
        raise DashboardError(f"/api/assistant/context returned {r.status_code}: {r.text[:120]}")
    return r.json()


def farm_context(grounding_data, email="farmer@aquamaa.demo"):
    """The farmer's wells as the My Farm page shows them, for Pepper in farmer mode (15 Nov): each well with its
    crop, area, sensor and its live values, plus what its water can be used for (Deema's Water Card, by well)."""
    s = requests.Session()
    r = s.post(f"{URL}/api/auth/login", json={"email": email, "password": PASSWORD}, timeout=10)
    if r.status_code != 200:
        raise DashboardError(f"Farmer login failed ({r.status_code})")
    wells = s.get(f"{URL}/api/farm/wells", timeout=10).json().get("wells", [])
    live = (grounding_data or {}).get("live") or {}
    devices = {d.get("device_id"): d for d in live.get("devices") or []}
    uses = {u.get("well"): u for u in ((live.get("metrics") or {}).get("waterUse") or [])}
    out = []
    for w in wells:
        d = devices.get(w.get("device_id")) or {}
        fresh = d.get("latestFresh") or {}
        val = lambda f: (fresh.get(f) or {}).get("value")
        use = uses.get(f"Well {d.get('well_id')}") if d.get("well_id") is not None else None
        out.append({"well": w.get("name"), "crop": w.get("crop"), "location": w.get("location"), "sensor": w.get("device_id"),
                    "online": bool(d.get("online")), "minutesAgo": d.get("minutesAgo"), "tds_ppm": val("tds_ppm"),
                    "ph": val("ph"), "temperature": val("temperature"),
                    "suitable": (use or {}).get("suitable") or [], "notSuitable": (use or {}).get("notSuitable") or [],
                    "quality": "sensor offline, last known values" if d and not d.get("online") else
                               ("no sensor linked" if not d else "live")})
    return {"page": "farm", "pageTitle": "My Farm", "farmWells": out}


def _status(item):
    parts = [f"status: {item.get('status')}" if item.get("status") else "", f"source: {item.get('source')}" if item.get("source") else ""]
    return f" ({'; '.join(p for p in parts if p)})" if any(parts) else ""


def overview(year=None):
    d = _get("/api/dashboard", **({"year": year} if year else {}))
    tag = f"[dashboard overview {d['year']}]"
    lines = [f"{tag} Data mode: {d['mode']}. Last data update: {d.get('updated_at')}"]
    if d.get("extraction"):
        e = d["extraction"]
        lines.append(f"{tag} Groundwater extraction: {e['value']} {e['unit']}, change from the year before: "
                     f"{e['yoy_pct']}%{_status(e)}")
    if d.get("safe_yield"):
        sy = d["safe_yield"]
        lines.append(f"{tag} Safe yield: {sy['value']} {sy['unit']} for {sy['period']}{_status(sy)}")
    lines.append(f"{tag} Extraction as a multiple of safe yield: "
                 f"{d['ratio'] if d['ratio'] is not None else 'not shown (the safe yield is for a different period)'}")
    if d.get("sectors"):
        for item in d["sectors"]["items"]:
            lines.append(f"{tag} Extraction by sector, {item['key']}: {item['value']} {d['sectors']['unit']} "
                         f"({item['pct']}%){_status(d['sectors'])}")
    q = d["quality"]
    lines.append(f"{tag} Wells meeting the TDS threshold of {q['threshold_tds_mgl']} mg/L: {q['suitable_count']} "
                 f"of {q['total']} ({q['suitable_pct']}%) (status: {q['status']})")
    st = d["stations"]
    lines.append(f"{tag} Monitoring stations: {st['count']}, active: {st['active']}, readings received: "
                 f"{st['received']} of {st['expected']} expected ({st['coverage_pct']}%)")
    c = d["coverage"]
    lines.append(f"{tag} Wells: {c['wells']}, wells with no measurement (data gaps): {c['data_gaps']}")
    i = d["integrations"]
    lines.append(f"{tag} Data integrations connected: {i['connected']} of {i['total']}")
    lines.append(f"{tag} Insight shown on the dashboard: {d['insight']}")
    return "\n".join(lines)


def extraction_trend():
    series = _get("/api/extraction")["series"]
    return "\n".join(f"[dashboard extraction {r['year']}] Extraction: total {r['total']} {r['unit']}, agriculture "
                     f"{r['agriculture']}, municipal {r['municipal']}, industrial {r['industrial']} "
                     f"(status: {r['data_status']}; source: {r['source']})" for r in series)


def wells():
    d = _get("/api/wells")
    return "\n".join(f"[dashboard wells {w['code']}] {w['name']}: aquifer {w['aquifer']}, depth {w['depth_m']} m, "
                     f"TDS {w['tds_mgl'] if w['tds_mgl'] is not None else 'not measured'} mg/L, last measured "
                     f"{w['last_measured'] or 'never (data gap)'}, meets the {d['threshold_tds_mgl']} mg/L threshold: "
                     f"{w['suitable']} (status: {w['data_status']})" for w in d["wells"])


def stations():
    rows = _get("/api/stations")["stations"]
    return "\n".join(f"[dashboard stations {s['code']}] {s['name']} (id {s['id']}): {s['status']}, readings in 2022: "
                     f"{s['readings_2022']} (status: {s['data_status']})" for s in rows)


def station_readings(station_code):
    match = [s for s in _get("/api/stations")["stations"] if s["code"].lower() == str(station_code).lower()]
    if not match:
        return f"No station with code {station_code}. Use the stations view to list the codes."
    s = match[0]
    rows = _get(f"/api/stations/{s['id']}/readings")["readings"]
    return "\n".join(f"[dashboard readings {s['code']} {r['period']}] water level {r['water_level_m']} m, "
                     f"TDS {r['tds_mgl']} mg/L (status: {s['data_status']})" for r in rows) or f"No readings for {s['code']}."


def read(view, year=None, station_code=None):
    """One dashboard view as labelled lines. Raises DashboardError if the dashboard can't be reached."""
    try:
        if view == "overview":
            return overview(year)
        if view == "extraction_trend":
            return extraction_trend()
        if view == "wells":
            return wells()
        if view == "stations":
            return stations()
        if view == "station_readings":
            return station_readings(station_code)
    except requests.RequestException as error:
        raise DashboardError(f"The dashboard at {URL} can't be reached: {error.__class__.__name__}") from error
    raise DashboardError(f"Unknown view {view!r}. Use one of: {', '.join(VIEWS)}")


if __name__ == "__main__":
    import sys
    sys.stdout.reconfigure(encoding="utf-8")
    for v in ("overview", "extraction_trend", "stations"):
        text = read(v)
        print(f"===== {v} ({len(text.splitlines())} lines)\n" + "\n".join(text.splitlines()[:6]))
    first_station = stations().splitlines()[0].split()[2].rstrip("]")
    print(f"===== station_readings {first_station}\n" + "\n".join(read("station_readings", station_code=first_station).splitlines()[:3]))
