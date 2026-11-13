"""Graph step: the live sensor readings from Deema's dashboard, given to the agent as a tool result.

Position:  route -> LIVE -> key statistics -> agent ...
Input:  state["grounding"], built by Deema's server for every question from her chat box (server/assistant.js,
        buildGrounding): each device's latest fresh values, whether it is online, minutes since it reported, her
        reference ranges, and what is not available. Questions asked outside the website have no grounding.
Output: a tool result named live_sensors, short labelled lines the agent can cite, for example
        [live sensors well-1] online, reported 3 minutes ago: pH 7.42, water temperature 26.1 °C, TDS 812 ppm
        No device reporting is said plainly, so a missing reading is never filled in by the model.
No model call.
"""
from langchain_core.messages import AIMessage, ToolMessage

from agent_log import log

MAX_DEVICES = 6
FORMAT = {   # field -> (name, unit, decimals)
    "ph": ("pH", "", 2),
    "temperature": ("water temperature", " °C", 1),
    "tds_ppm": ("TDS", " ppm (mg/L)", 0),
    "turbidity_raw": ("turbidity raw sensor reading", " (not NTU, uncalibrated)", 0),
}


def _number(value, decimals):
    if not isinstance(value, (int, float)):
        return None
    return f"{value:.{decimals}f}" if decimals else f"{round(value):,}"


def live_lines(grounding):
    """The grounding as short labelled lines. Only measured values; nothing estimated."""
    live = (grounding or {}).get("live") or {}
    devices = live.get("devices") or []
    lines = []
    if not devices:
        lines.append("[live sensors] No sensor device has reported a reading recently, so there is no current "
                     "measurement of the water.")
    for d in devices[:MAX_DEVICES]:
        fresh = d.get("latestFresh") or {}
        values = []
        for field, (name, unit, decimals) in FORMAT.items():
            reading = fresh.get(field)
            n = _number(reading.get("value"), decimals) if isinstance(reading, dict) else None
            if n is not None:
                values.append(f"{name} {n}{unit}")
        state = "online" if d.get("online") else "offline"
        ago = d.get("minutesAgo")
        when = f"reported {ago} minutes ago" if isinstance(ago, (int, float)) else "time of last report unknown"
        lines.append(f"[live sensors {d.get('device_id', 'device')}] {state}, {when}: "
                     + (", ".join(values) if values else "no fresh valid values"))
    label = ((live.get("assessment") or {}).get("label"))
    if label:
        lines.append(f"[live sensors] The dashboard's preliminary monitoring status: {label}. It is not a "
                     "drinking-water certification.")
    for name, t in ((grounding or {}).get("thresholds") or {}).items():
        ref = (t or {}).get("reference") or {}
        if ref:
            low, high = ref.get("min"), ref.get("max")
            span = f"{low} to {high}" if low is not None and high is not None else (f"up to {high}" if high is not None
                                                                                  else f"from {low}")
            lines.append(f"[live sensors] Dashboard reference range for {name}: {span}.")
    for item in ((grounding or {}).get("notAvailable") or [])[:3]:
        lines.append(f"[live sensors] Not available: {item}.")
    return lines


def live_node(state):
    grounding = state.get("grounding")
    if not grounding or not state["route"]["in_scope"]:
        return {}
    lines = live_lines(grounding)
    log.info("LIVE      %d line(s) of live sensor data from the dashboard", len(lines))
    call = AIMessage(content="", tool_calls=[{"name": "live_sensors", "args": {}, "id": "live-sensors-1"}])
    result = ToolMessage(content="\n".join(lines), tool_call_id="live-sensors-1", name="live_sensors")
    return {"messages": [call, result]}
