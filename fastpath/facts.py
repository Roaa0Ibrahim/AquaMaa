"""The facts for a fast answer, built by code from the live readings and the fast-path tables.

Every comparison and verdict is decided here, never by the model (13 Nov: the model said 3,000 mg/L is below the
2,000 mg/L limit). Each fact is one short line ending with its source label, so the answer can cite it.
Tables (same columns as Mais's templates in handoff/mais/; hers replace these drafts when she sends them):
  fastpath/data/meanings.csv        what a TDS or pH value means for drinking and irrigation
  fastpath/data/crop_tolerance.csv  salt tolerance of crops, as ECw in dS/m (FAO 29 Table 4)
  fastpath/data/knowledge_cards.csv short sourced facts on the water law and on why wells get saltier
Each builder returns a list of lines, or None when it can't answer (the question then goes to the deep path).
"""
import csv
import re
from pathlib import Path

from fastpath.intents import embeddings
from key_stats import cosine
from steps.live import live_lines

DATA = Path(__file__).parent / "data"
TDS_PER_ECW = 640               # FAO 29: TDS (mg/L) is about 640 x ECw (dS/m)
MIN_CARD_SIMILARITY = 0.6
CERTAIN_INTENT = 0.85           # an intent this close to an example counts as certain
CERTAIN_CARD_SIMILARITY = 0.45


def _table(name):
    return list(csv.DictReader((DATA / name).open(encoding="utf-8-sig")))


MEANINGS = _table("meanings.csv")
CROPS = _table("crop_tolerance.csv")
CARDS = _table("knowledge_cards.csv")
_card_vectors = []
ARABIC_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")


def _num(text):
    return float(text.replace(",", ""))


def _fmt(x):
    return f"{x:,.0f}" if abs(x) >= 100 else f"{x:g}"


def meaning(sensor, use, value, arabic):
    """The meanings.csv row a value falls in: low <= value < high."""
    for r in MEANINGS:
        if r["sensor"] != sensor or r["use"] != use:
            continue
        low = _num(r["low"]) if r["low"] else float("-inf")
        high = _num(r["high"]) if r["high"] else float("inf")
        if low <= value < high:
            text = r["meaning_ar"] if arabic else r["meaning_en"]
            advice = r["advice_ar"] if arabic else r["advice_en"]
            return f"{sensor.upper() if sensor == 'tds' else 'pH'} {_fmt(value)} {r['unit']} for {use}: {text}; {advice} [{r['source']}]"
    if sensor == "ph":   # outside the normal range
        return (f"pH {_fmt(value)} for {use} is outside the normal range; check the sensor and the water "
                f"[{next(r['source'] for r in MEANINGS if r['sensor'] == 'ph' and r['use'] == use)}]")
    return None


def value_in_question(question):
    """A salinity value the asker gives, such as "3000 mg/L" or "3000 ملغم/لتر"."""
    q = question.translate(ARABIC_DIGITS)
    m = re.search(r"(\d[\d,]*(?:\.\d+)?)\s*(mg/?l|ppm|ملغم|ملجم|مجم|ملغ)", q, re.I)
    if m:
        return _num(m.group(1))
    if re.search(r"salin|tds|ملوح|أملاح", q, re.I):
        big = [_num(n) for n in re.findall(r"\d[\d,]*", q) if _num(n) >= 100]
        return big[0] if big else None
    return None


def live_value(grounding, metric):
    m = (((grounding or {}).get("live") or {}).get("metrics") or {}).get(metric) or {}
    return m.get("value") if isinstance(m.get("value"), (int, float)) else None


def crops_in(question):
    q = question.lower()
    found = []
    for c in CROPS:
        names = {c["crop_en"], c["crop_en"] + "s", c["crop_en"] + "es", c["crop_ar"], c["crop_ar"].removeprefix("ال")}
        if c["crop_en"] == "date palm":
            names |= {"palm", "palms", "نخل", "النخل"}
        if any(n and n.lower() in q for n in names):
            found.append(c)
    return found


def uses_in(question):
    q = question.lower()
    uses = []
    if re.search(r"drink|potable|شرب|يشرب|نشرب", q):
        uses.append("drinking")
    if re.search(r"irrigat|grow|crop|plant|farm|سقي|ري |الري|زرع|ازرع|أزرع|محصول|محاصيل", q) or crops_in(question):
        uses.append("irrigation")
    return uses or ["irrigation", "drinking"]


# ---------------------------------------------------------------- builders, one per intent

def live_reading(question, grounding, arabic):
    if not grounding:
        return None                                   # outside the website there is no live reading
    tds, ph = live_value(grounding, "tds"), live_value(grounding, "ph")
    if (tds is None and ph is None) or all_offline(grounding):
        # no current value: answer.py says so simply, with the last known value and its age (14 Nov: the dashboard
        # now gives the last known value even when the sensor is offline; it must not be told as current)
        return None
    lines = live_lines(grounding)
    for use in ("drinking", "irrigation"):
        if tds is not None:
            lines.append(meaning("tds", use, tds, arabic))
        if ph is not None:
            lines.append(meaning("ph", use, ph, arabic))
    return [x for x in lines if x]


def all_offline(grounding):
    devices = (((grounding or {}).get("live") or {}).get("devices")) or []
    return bool(devices) and not any(d.get("online") for d in devices)


def no_reading(grounding, arabic):
    """Facts when the well sensor has no fresh reading: since when, what to check, and how to test the water."""
    devices = (((grounding or {}).get("live") or {}).get("devices")) or []
    ago = devices[0].get("minutesAgo") if devices else None
    if isinstance(ago, (int, float)) and ago >= 120:
        hours = round(ago / 60)
        lines = [f"[live sensors] لم يرسل حساس البئر أي قراءة منذ حوالي {hours} ساعة، فلا توجد قراءة حالية للماء."
                 if arabic else f"[live sensors] The well sensor has not sent a reading for about {hours} hours, so "
                                f"there is no current reading of the water."]
    else:
        lines = ["[live sensors] لا تتوفر الآن قراءة مباشرة من حساس البئر." if arabic
                 else "[live sensors] No live reading from the well sensor is available right now."]
    # The last known salinity, pH and temperature, whichever was asked (15 Nov: a pH question got only the salinity)
    fresh = (devices[0].get("latestFresh") or {}) if devices else {}
    val = lambda f: (fresh.get(f) or {}).get("value") if isinstance(fresh.get(f), dict) else None
    tds, ph, temp = val("tds_ppm") or live_value(grounding, "tds"), val("ph"), val("temperature")
    if any(v is not None for v in (tds, ph, temp)) and isinstance(ago, (int, float)):
        when_ar = f"{round(ago / 60)} ساعة" if ago >= 90 else f"{ago} دقيقة"
        when_en = f"{round(ago / 60)} hours" if ago >= 90 else f"{ago} minutes"
        parts_ar = ([f"الملوحة {_fmt(tds)} جزء في المليون"] if tds is not None else []) + \
                   ([f"درجة الحموضة {_fmt(ph)}"] if ph is not None else []) + \
                   ([f"الحرارة {_fmt(temp)} درجة مئوية"] if temp is not None else [])
        parts_en = ([f"salinity {_fmt(tds)} ppm"] if tds is not None else []) + \
                   ([f"pH {_fmt(ph)}"] if ph is not None else []) + \
                   ([f"temperature {_fmt(temp)} °C"] if temp is not None else [])
        lines.append(f"[live sensors] آخر قراءات معروفة، قبل حوالي {when_ar}: {'، '.join(parts_ar)}." if arabic
                     else f"[live sensors] The last known readings, about {when_en} ago: {', '.join(parts_en)}.")
        # Always what the readings mean (15 Nov, Roaa), also for last known values
        for sensor, v in (("tds", tds), ("ph", ph)):
            if v is not None:
                lines += [m for m in (meaning(sensor, "drinking", v, arabic), meaning(sensor, "irrigation", v, arabic)) if m]
    if devices:
        lines.append("[live sensors] تأكد أن الحساس موصول بالكهرباء وبشبكة الواي فاي." if arabic
                     else "[live sensors] Check that the sensor has power and is connected to Wi-Fi.")
    # The card on testing well water yourself, found by its meaning, not by an id
    lines += card("كيف أفحص جودة مياه البئر؟" if arabic else "How do I test the quality of my well water?",
                  grounding, arabic, 0.9) or []
    return lines


def trend(question, grounding, arabic):
    if not grounding:
        return None
    series = ((((grounding.get("live") or {}).get("series") or {}).get("tds_ppm") or {}).get("points")) or []
    points = [p for p in series if isinstance(p.get("median"), (int, float))]
    if len(points) < 2:
        return [f"[live sensors history] There are not enough recent TDS readings in the selected period "
                f"({grounding.get('dateRange', 'recent period')}) to show a trend."]
    first, last = points[0], points[-1]
    change = last["median"] - first["median"]
    pct = 100 * change / first["median"] if first["median"] else None
    direction = "rose" if change > 0 else "fell" if change < 0 else "stayed the same"
    line = (f"[live sensors history] Over {grounding.get('dateRange', 'the selected period')}, TDS {direction} from "
            f"{_fmt(first['median'])} ppm ({first['t'][11:16]} UTC) to {_fmt(last['median'])} ppm "
            f"({last['t'][11:16]} UTC), a change of {change:+.0f} ppm" + (f" ({pct:+.0f}%)." if pct is not None else "."))
    lines = [line, meaning("tds", "irrigation", last["median"], arabic)]
    if all_offline(grounding):
        # 14 Nov: "the current salinity is 92" was said from a 2-hour-old point while the sensor was offline
        lines.insert(0, "[live sensors] The well sensor is offline now, so the latest point above is its last known "
                        "reading, not a current one.")
    return lines


def suitability(question, grounding, arabic):
    value = value_in_question(question)
    origin = "the value in the question"
    if value is None:
        value, origin = live_value(grounding, "tds"), "the latest live reading [live sensors]"
        if value is not None and all_offline(grounding):
            # 14 Nov: "your well water has a salinity of 93" while the sensor had been offline for 2 hours
            ago = min((d.get("minutesAgo") for d in ((grounding.get("live") or {}).get("devices") or [])
                       if isinstance(d.get("minutesAgo"), (int, float))), default=None)
            origin = ("the last known reading" + (f", about {round(ago / 60)} hours ago" if ago and ago >= 90 else
                      f", {ago} minutes ago" if ago else "") + "; the sensor is offline now, so check again when it "
                      "reports [live sensors]")
    crops, uses = crops_in(question), uses_in(question)
    lines = []
    if value is None:
        lines.append("No salinity value was given and there is no current sensor reading, so the water itself can't "
                     "be judged; measuring its TDS (salinity) is the first step [AquaMaa check].")
    else:
        lines.append(f"Salinity (TDS) used: {_fmt(value)} mg/L, from {origin} [AquaMaa check].")
        for use in uses:
            lines.append(meaning("tds", use, value, arabic))
        ph = live_value(grounding, "ph") if origin != "the value in the question" else None
        if ph is not None:
            # 15 Nov: "this water is good to drink" from salinity alone while the pH was 9.2; the pH counts too
            lines.append(f"pH used: {_fmt(ph)}, from the same reading [live sensors].")
            for use in uses:
                lines.append(meaning("ph", use, ph, arabic))
    for c in crops:
        no_loss, half = float(c["ecw_no_loss"]) * TDS_PER_ECW, float(c["ecw_half_loss"]) * TDS_PER_ECW
        name = c["crop_ar"] if arabic else c["crop_en"]
        line = (f"{name} grows with no yield loss up to about {_fmt(no_loss)} mg/L of salinity (ECw {c['ecw_no_loss']} "
                f"dS/m) and loses about half its yield near {_fmt(half)} mg/L (ECw {c['ecw_half_loss']} dS/m)")
        if value is not None:
            line += f"; {verdict(value, no_loss, half)}"
        lines.append(f"{line} [{c['source']}].")
    if value is not None and not crops and "irrigation" in uses:
        # No crop named (13 Nov: "Which crops can tolerate water at 2000 mg/L?"): list what suits this water
        full = [c for c in CROPS if float(c["ecw_no_loss"]) * TDS_PER_ECW >= value]
        some = [c for c in CROPS if float(c["ecw_no_loss"]) * TDS_PER_ECW < value < float(c["ecw_half_loss"]) * TDS_PER_ECW]
        names = lambda cs: ", ".join(c["crop_ar"] if arabic else c["crop_en"] for c in cs) or "none of the crops listed"
        lines.append(f"At {_fmt(value)} mg/L, crops with no expected yield loss: {names(full)}; crops that grow with "
                     f"some yield loss: {names(some)} [FAO 29 Table 4].")
    return [x for x in lines if x]


def verdict(value, no_loss, half):
    """How much yield a crop is expected to lose, by straight line between no loss and half loss (FAO 29's method
    of a yield potential falling linearly with salinity). Stated as a number, so the answer can't exaggerate it
    (13 Nov: barley at 4,000 mg/L, about 7% loss, was called "too salty to grow well")."""
    if value <= no_loss:
        return "so this water is fine for it, with no expected yield loss"
    if value >= half:
        return "so this water is too salty for it: about half the yield or more would be lost"
    loss = 50 * (value - no_loss) / (half - no_loss)
    return f"so this water would lower its yield by about {loss:.0f}%"


def card(question, grounding, arabic, intent_score=0.0):
    if not _card_vectors:
        _card_vectors.extend(embeddings.embed_documents([f"{c['question_en']} {c['question_ar']}" for c in CARDS]))
    q = embeddings.embed_query(question)
    score, best = max(((cosine(q, v), c) for v, c in zip(_card_vectors, CARDS)), key=lambda x: x[0])
    # When the type of question is certain (13 Nov: "ليش ماي البير صار مالح؟" scored 1.00 as explain), the closest
    # card is accepted at a lower bar; dialect wording sits further from the cards' standard Arabic
    if score < (CERTAIN_CARD_SIMILARITY if intent_score >= CERTAIN_INTENT else MIN_CARD_SIMILARITY):
        return None
    return [f"{best['fact_ar'] if arabic else best['fact_en']} [{best['source']}]"]


FARMS_FILE = "number-of-farms-and-wells-by-type-of-the-farm-and-municipality.csv"
FARMS = list(csv.DictReader((Path(__file__).parent.parent / "database" / "07-geography" / FARMS_FILE)
                            .open(encoding="utf-8-sig")))
PLACES = _table("places.csv")


def place_in(question):
    """The municipality a question names, directly or through an area in it (places.csv); and the area, if any."""
    q = question.lower()
    for p in sorted(PLACES, key=lambda p: -len(p["name_ar"])):      # longer names first: الخيسة before الخور
        names = {p["name_ar"], p["name_ar"].removeprefix("ال"), p["name_en"].lower(),
                 p["name_en"].lower().removeprefix("al ")}
        if any(n and n in q for n in names if len(n) >= 3):
            return p["municipality_en"], (p if p["kind"] == "area" else None)
    return None, None


def census(municipality):
    """Wells and farms on farms in one municipality, latest year: {(indicator, status): value}, year, Arabic name."""
    rows = [r for r in FARMS if r["municipality"] == municipality]
    if not rows:
        return {}, None, None
    year = max(r["year"] for r in rows)
    out = {}
    for r in rows:
        if r["year"] == year:
            out[(r["indicator"], r["farm_status"])] = out.get((r["indicator"], r["farm_status"]), 0) + _num(r["value"])
    return out, year, rows[0].get("lbldy")


def statistic(question, grounding, arabic):
    """Counts of farm wells and farms by municipality, added up by code from the farm census (13 Nov: "كم عدد الآبار
    في مزارع بلدية الخور؟" said "no information"; areas like الخيسة are answered at their municipality's level)."""
    q = question.lower()
    want_wells = bool(re.search(r"well|بئر|آبار|ابار|بير", q))
    want_farms = bool(re.search(r"farm|مزرع|مزارع", q)) and not want_wells
    municipality, area = place_in(question)
    label = f"[{FARMS_FILE}]"
    if municipality is None:
        if not re.search(r"most|highest|largest|أكثر|أكبر", q):
            return None
        totals = {}
        for r in FARMS:
            if r["indicator"] == ("Number of Farms" if want_farms else "Number of Wells"):
                totals.setdefault(r["year"], {}).setdefault(r["municipality"], 0)
                totals[r["year"]][r["municipality"]] += _num(r["value"])
        year = max(totals)
        ranked = sorted(totals[year].items(), key=lambda kv: -kv[1])[:3]
        what = "farms" if want_farms else "wells on farms"
        return [f"In {year}, the municipalities with the most {what} were: "
                + ", ".join(f"{m} ({_fmt(v)})" for m, v in ranked) + f" {label}."]
    counts, year, name_ar = census(municipality)
    if not counts:
        return None
    lines = []
    if area:
        lines.append(f"The farm census counts wells and farms by municipality, not by area; "
                     f"{area['name_ar'] if arabic else area['name_en']} is in {municipality} [AquaMaa place list].")
    place = name_ar if (arabic and name_ar) else municipality
    for indicator, what in (("Number of Wells", "wells"), ("Number of Farms", "farms")):
        if (indicator == "Number of Wells" and want_farms) or (indicator == "Number of Farms" and want_wells):
            continue
        working = counts.get((indicator, "Working Farms"), 0)
        idle = counts.get((indicator, "Farms Not Working"), 0)
        if working or idle:
            lines.append(f"In {year}, {place} had {_fmt(working + idle)} {what} on farms: {_fmt(working)} on working "
                         f"farms and {_fmt(idle)} on farms not working {label}.")
    return lines or None


PARAM_NAMES = {"tds_ppm": ("salinity (TDS)", "ppm"), "temperature": ("water temperature", "°C"),
               "ph": ("pH", ""), "turbidity_raw": ("turbidity (raw, not calibrated)", "")}


def page(question, grounding, arabic):
    """"What does this page show?" (14 Nov): what the person is looking at, read and analysed by code from the data
    the website sends (the page, its sensors, readings, charts over the selected period, alerts, the dashboard's
    figures). Every line is tagged [this page]; the model only phrases it."""
    if not grounding:
        return None
    ctx = grounding.get("clientContext") or {}
    live = grounding.get("live") or {}
    tag = "[this page]"
    title = ctx.get("pageTitle") or (grounding.get("page") or "dashboard").title()
    period = ctx.get("dateRangeLabel") or grounding.get("dateRange") or "the selected period"
    lines = [f"This is the {title} page of the AquaNova dashboard; it shows live readings from the well sensors "
             f"for {period} {tag}."]
    if ctx.get("note"):
        lines.append(f"This page doesn't send its figures to AquaMaa yet, so only the live sensor data is known {tag}.")
    for w in (ctx.get("farmWells") or [])[:10]:            # the farmer's My farm page: each well and its state
        # The crop's name from AquaMaa's own crop table, in the answer's language (14 Nov: "Date palm" became «خوخ»,
        # peach, when the model translated it); the well's name as the farmer typed it, in quotes
        c = next((x for x in CROPS if x["crop_en"] == str(w.get("crop") or "").strip().lower()), None)
        crop = (c["crop_ar"] if arabic else c["crop_en"]) if c else w.get("crop")
        parts = [f"«{w.get('well')}»" if arabic else f"\"{w.get('well')}\""] + \
                ([("المحصول " if arabic else "crop ") + crop] if crop else [])
        vals = ([f"TDS {_fmt(w['tds_ppm'])} ppm"] if isinstance(w.get("tds_ppm"), (int, float)) else []) + \
               ([f"pH {_fmt(w['ph'])}"] if isinstance(w.get("ph"), (int, float)) else []) + \
               ([f"temperature {_fmt(w['temperature'])} °C"] if isinstance(w.get("temperature"), (int, float)) else [])
        lines.append(f"Well {', '.join(parts)}: {w.get('quality')}" + (f" ({', '.join(vals)})" if vals else "")
                     + ("" if w.get("online") else "; the sensor is offline or not linked") + f" {tag}.")
        # What this well's water can be used for (Deema's Water Card, 15 Nov), with crop names in the answer's language
        name = lambda u: next(((x["crop_ar"] if arabic else x["crop_en"]) for x in CROPS
                               if x["crop_en"] == str(u).replace("_", " ").lower()),
                              "الشرب" if (arabic and u == "drinking") else u.replace("_", " "))
        if w.get("suitable") or w.get("notSuitable"):
            lines.append(f"Well \"{w.get('well')}\" can be used for: {', '.join(name(u) for u in w.get('suitable') or []) or 'none'}"
                         + (f"; not suitable for: {', '.join(name(u) for u in w['notSuitable'])}" if w.get("notSuitable") else "")
                         + " [AquaMaa check].")
    if ctx.get("farmWells"):
        return lines                                         # the farm page: the wells are the page
    devices = live.get("devices") or []
    if devices:
        online = [d for d in devices if d.get("online")]
        newest = min((d.get("minutesAgo") for d in devices if isinstance(d.get("minutesAgo"), (int, float))),
                     default=None)
        lines.append(f"{len(devices)} sensor device(s), {len(online)} online"
                     + (f"; the latest reading is {newest} minutes old" if newest is not None else "") + f" {tag}.")
    # Current values, and what they mean (meanings.csv, the same as the live-reading answers)
    tds, temp = live_value(grounding, "tds"), live_value(grounding, "temperature")
    now = "last known" if all_offline(grounding) else "now"
    if all_offline(grounding):
        lines.append(f"The sensors are offline, so the values below are the last known readings, not current ones "
                     f"{tag}.")
    if tds is not None:
        ref = (((grounding.get("thresholds") or {}).get("tds_ppm") or {}).get("reference") or {}).get("max")
        lines.append(f"Salinity (TDS) {now}: {_fmt(tds)} ppm" + (f", within the dashboard's reference limit of "
                     f"{_fmt(ref)}" if ref and tds <= ref else f", above the dashboard's reference limit of {_fmt(ref)}"
                     if ref else "") + f" {tag}.")
        lines += [m for m in (meaning("tds", "drinking", tds, arabic), meaning("tds", "irrigation", tds, arabic)) if m]
    if temp is not None:
        lines.append(f"Water temperature {now}: {_fmt(temp)} °C {tag}.")
    ph = live_value(grounding, "ph")
    lines.append(f"pH {now}: {_fmt(ph)} {tag}." if ph is not None else f"pH: no valid reading in this period {tag}.")
    # The charts: how each value changed over the period
    for key, s in ((live.get("series") or {}).items()):
        pts = [p for p in (s or {}).get("points") or [] if isinstance(p.get("median"), (int, float))]
        if len(pts) < 2 or key not in PARAM_NAMES or key == "turbidity_raw":
            continue
        name, unit = PARAM_NAMES[key]
        first, last = pts[0]["median"], pts[-1]["median"]
        high = max(p.get("max", p["median"]) for p in pts)
        way = "rose" if last > first else "fell" if last < first else "stayed at"
        lines.append(f"Chart: over {period}, {name} {way} from {_fmt(first)} to {_fmt(last)} {unit}".rstrip()
                     + f" (highest {_fmt(high)}) {tag}.")
    wqi = (live.get("metrics") or {}).get("wqi") or {}
    if isinstance(wqi.get("value"), (int, float)):            # Deema's Water Quality Index (CCME), 15 Nov
        lines.append(f"Water Quality Index: {_fmt(wqi['value'])} out of 100, {str(wqi.get('category', '')).lower()}"
                     + (f", for {wqi['well']}" if wqi.get("well") else "") + f" {tag}.")
    alerts_now = live.get("alerts") or []
    for a in alerts_now[:3]:                                     # what needs attention, in the dashboard's own words
        if a.get("title"):
            lines.append(f"Alert: {a['title'].rstrip('.')} {tag}.")
    status = (live.get("assessment") or {}).get("label")
    if status:
        lines.append(f"The dashboard's overall status is \"{status}\"; this is a monitoring indicator, not a "
                     f"drinking-water certification {tag}.")
    alerts = live.get("alerts") or []
    lines.append(f"{len(alerts)} active alert(s) {tag}." if alerts else f"No active alerts {tag}.")
    demo = ctx.get("demonstrationData") or {}
    if demo.get("registeredWells") is not None:
        lines.append(f"The dashboard cards also show {demo['registeredWells']} registered wells and "
                     f"{demo.get('monitoringStations')} monitoring stations, as demonstration data {tag}.")
    return lines


BUILDERS = {"live_reading": live_reading, "trend": trend, "suitability": suitability, "law": card, "explain": card,
            "statistic": statistic, "page": page}
