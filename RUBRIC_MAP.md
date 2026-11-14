# Our story against the rubric (draft, to edit)

Judges score **only what we show or say**. For each line: where it appears in our story, how ready it is, and the
sentence that makes the strength visible. Scenes refer to [DEMO_SCRIPT.md](DEMO_SCRIPT.md).
Status: ✅ ready · ⚠️ needs a check today · ❌ gap.

## Our five strengths (say them, show them)
1. **The well gets a voice, before anyone asks.** One salt sample travels the whole chain, and Pepper speaks the alert
   in the monitoring room by itself: value, meaning, advice, crops that still tolerate it. (M5, X3, X5, end-to-end)
2. **It cannot invent a number.** Facts by code, words by the model; a check rejects any number or source not in the
   facts. Tested: 11 of 11 forced failures handled with no invented answer. (X4 "how tested", Design choices, Q&A)
3. **Made for Qatar.** Farmers ask by voice in Qatari dialect («شكثر الاملاح في بيري؟»); Fanar, the Qatari Arabic
   model from QCRI, understands it; answers in Arabic, read aloud with a Qatari voice. National data: the farm census
   wells by municipality. (X5 voice AI, Problem-solution fit)
4. **Every number comes with its meaning and an action.** "1,800 ppm: too salty to drink, fine for date palms." Two
   readers: the farmer gets plain words, the officer gets numbers and options. (M5 "with their meaning", X3
   recommendations)
5. **We measured it.** Answers in 4-7 s; 21 of 21 test questions in the right language; right source for 26 of 27;
   dashboard 5 of 5 charts read exactly. (Results, Problem-solution fit)

## 1. Core system (35)

| Item | Pts | Where in our story | Status | What makes it Excellent |
|---|---|---|---|---|
| M1 Sensors | 5 | Video scene 2-3, live pour | ⚠️ | 4 sensors (TDS, pH, temperature, turbidity); **show TDS rising in salty water**. pH must give valid readings today (dashboard showed "no valid pH"). Turbidity: say it is raw, not yet calibrated |
| M2 Data storage | 5 | Deema, slide 3; live: open the history chart at the moment of the pour | ✅ | Every reading saved with its time in Supabase; **show the past moment on request** (the jump in the chart) |
| M3 Live dashboard | 5 | Video scene 3 with the timer | ⚠️ | Updates by itself, units, history chart. **Measure the delay today** (target 5 s); show it on screen |
| M4 Wireless | 5 | Video scene 2 | ⚠️ | ESP32 on its own power, across the room, **no USB**; keep it online for the whole demo |
| M5 Robot interaction | 5 | Video scene 4-5, live | ⚠️ | Speaks current values **with their meaning**, answers 2+ questions, gestures (Pepper moves its arms while speaking). Not yet tested on the robot |
| End-to-end | 10 | The whole video, one sample | ⚠️ | One sample change: sensor → database → dashboard → alert → Pepper, **without touching anything**. Needs the sensor online + Pepper installed |

## 2. Novelty and creativity (30)

| Item | Pts | What we have (2+ needed for Excellent) | Status | Say it like this |
|---|---|---|---|---|
| X1 IoT extras | 6 | 4 sensors instead of 3; [calibration of TDS/pH: Munira]; sensor-offline detection (alert when a device stops sending) | ⚠️ | "We know when a sensor goes silent: after N minutes it is flagged offline and Pepper says so." Add the calibration method in one sentence |
| X2 Data extras | 6 | Cloud sync (Supabase); data cleaning (only fresh, valid readings are used, stale ones are marked); national data joined to live data (farm census, FAO crop limits) | ✅ | "Readings older than an hour, or invalid, never reach a decision." |
| X3 Dashboard extras | 6 | **Alerts with a recommendation** (the rubric's own example); trend charts; unusual-change detection; recommendations through the AI chat; speech on the website | ✅ | "The alert says what the reading means and what to do, and which crops still tolerate it." |
| X4 Predictive AI | 6 | Crop risk on live data: the expected yield loss for each crop at the current salinity (FAO 29 crop tolerance); early warning (threshold + unusual change); tested (results table) | ⚠️ | Weakest area: no forecast yet. **Lift it**: "at this rate of rise, the water passes the date-palm limit in about N minutes" (1-1.5 h, see below) |
| X5 Robot extras | 6 | **Voice AI** with live data; **proactive inspection** (speaks alerts unprompted); the live dashboard on its tablet with captions | ✅ (once installed) | "Pepper doesn't wait to be asked: it watches the wells and speaks up." |

## 3. Understanding and Q&A (20)

| Item | Pts | How we get Excellent | Status |
|---|---|---|---|
| Understanding of the system | 10 | Each member explains their own part **and** the whole chain in one sentence: "probe → ESP32 → Supabase → dashboard → AquaMaa → Pepper". Practise once each | ⚠️ |
| Design choices and limits | 6 | Why local Qwen (data stays on the laptop, no cost); why facts by code (no invented numbers); why Fanar (Qatari dialect); why Pepper in the ministry, not at the farm. **Limits said by us** (one kit, turbidity uncalibrated, Fanar needs internet, no forecast yet) | ✅ |
| Quality of answers | 4 | Short, accurate; "we don't know yet" when true | ✅ |

## 4. Presentation and impact (15)

| Item | Pts | How we get full marks | Status |
|---|---|---|---|
| Problem definition | 3 | Who (well farms), where (north of Qatar), what goes wrong (salinity found too late), **measurable target** (dashboard ≤ 5 s, alert ≤ 10 s) | ✅ |
| Problem-solution fit | 4 | Each feature tied to the problem **with a test result** (Results table) | ⚠️ fill the measured times |
| Structure and video | 4 | 5 sections in order; video 2:30 | ⚠️ film today |
| Time management | 2 | Rehearse once with a timer: slides 8 min, demo 5 | ⚠️ |
| Team contribution | 2 | Each member speaks their part (slide 3) and has a live role (sensors, dashboard, Pepper, website) | ✅ |

## What would add the most points today (in order)
1. **Sensor online + Pepper installed** → unlocks M1, M4, M5, end-to-end and X5: about 30 points depend on it
2. **Measure and show the times** (dashboard delay, alert delay) → M3, Results, Problem-solution fit
3. **pH giving valid readings** → M1 "3 or more sensors stable"
4. **Early warning by rate of rise** → X4 from Fair to Good/Excellent (Roaa, 1-1.5 h)
5. **One sentence on calibration** → X1
6. **Rehearse with a timer** → Time management, Understanding
