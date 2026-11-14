# Demo and presentation plan (draft, Roaa edits)

**The rule that decides everything:** judges score only what we show. Video alone can reach "Good" at most;
"Excellent" needs at least 20% of our features shown live. So we only polish what appears below.

**Time:** 13 min in total = about 8 min of slides + up to 5 min of demo (a 2.5 min video + about 2 min live). Then 5 min of Q&A.

## The one problem (say it the same way everywhere)
Farms in Qatar depend on groundwater wells, most of them brackish. When a well's salinity rises, the farmer finds
out too late, after the crops are damaged. **Target:** a salinity change shows on the dashboard within 5 s, and
Pepper says the alert in the ministry's monitoring room without being asked, in under 10 s *(measure today)*.
Farmers ask follow-up questions in Arabic or English and get an answer in about 5 s.

## The hook (first 30 seconds, said by one person, no slides needed)
> "In the north of Qatar, the sea is moving under the farms: the saline front advances about 4-5 km a year
> (Elobaid 2017, in our knowledge base). Farm wells already have sensors, and they send readings every day.
> But nobody reads them. The farmer learns the water turned salty when the palms turn brown.
> **The well can't speak. We gave it a voice.**"

Then two people carry the story through the demo:
- **Salem, a farmer** with a well near Al Khor: asks on his phone, in his own dialect, by voice
- **Noura, an officer** in the ministry's monitoring room: Pepper sits beside her and speaks up when a well goes wrong

**Tagline:** *Reading → meaning → action.* Every number on screen comes with what it means and what to do.

## The story (one sample, one chain)
Tap water → salty water. The same sample change travels the whole chain:
**probe → ESP32 (Wi-Fi, away from the laptop) → database → dashboard (within 5 s) → alert → Pepper speaks it
with a gesture → the officer asks Pepper → the farmer asks the website in Qatari dialect, by voice**

## Video, 2.5 min (film today)

| # | Time | Scene | What's on screen | Rubric |
|---|---|---|---|---|
| 1 | 0:00-0:15 | The problem | A farm well photo + one line: "Salinity rises unnoticed" | Problem |
| 2 | 0:15-0:40 | Setup | Probes in a cup of tap water; the ESP32 on its own power, across the room, **no USB cable**; dashboard shows the readings with units | M1, M4 |
| 3 | 0:40-1:05 | Sample change | Pour salt into the water; a **visible timer**; TDS rises on the dashboard within 5 s; the history chart shows the jump | M1, M2, M3 |
| 4 | 1:05-1:30 | Alert | The dashboard alert appears; **Pepper says the alert unprompted, with a gesture**: the value, what it means, and the advice | X3, X5, end-to-end |
| 5 | 1:30-2:00 | Officer asks Pepper | "What is the salinity now?" → value + meaning. "Can farmers still use this water for date palms?" → yes/no + crops | M5 |
| 6 | 2:00-2:25 | Farmer on the website | By voice, in dialect: «شكثر الاملاح في بيري؟» → «فهمت سؤالك على أنه…» + the answer, read aloud | X5 voice AI, Arabic |
| 7 | 2:25-2:30 | Close | "AquaMaa: the well's reading, its meaning, and what to do" | |

## Live part, about 2 min (on the day)
1. Pour salt live → the dashboard updates (judges watch the timer) → Pepper speaks the alert
2. A judge or a team member asks Pepper one question about the current salinity
3. One Arabic question on the website by voice
**Backup:** if anything fails live, say so and point to the same moment in the video.

## Questions we use (rehearsed, tested on the system)
- Pepper (English): "What is the salinity now?" · "Is this water safe to drink?" · "Can I use it for date palms?"
- Website, farmer, Arabic voice: «شكثر الاملاح في بيري؟» · «أقدر أسقي النخل بهالماي؟»
- Website, officer, English: "Which municipality has the most wells?" (real national data: the farm census)

## Slides, about 8 min (5 sections, in this order)
| # | Section | Content | Who |
|---|---|---|---|
| 1 | Introduction and problem | who (well farms), where (Qatar, the north), what goes wrong today, the target | Roaa |
| 2 | Proposed solution | what exists (sensors send readings, nobody analyses them) and the gap; our features against it | Roaa |
| 3 | Architecture and methodology | one chain diagram; sensors and calibration; database schema; dashboard; the AI method (facts by code, words by the model; checks on numbers and sources); Pepper | Munira (sensors, Pepper), Deema (database, dashboard), Roaa (AI), Mais (knowledge) |
| 4 | Results | latency (dashboard, alert, answer); accuracy; reliability (see below) | Roaa |
| 5 | Impact and conclusion | users (farmers, ministry officers), cost of the kit, scale; limits; next steps; who built what | all |

### Results we can already show
- Answers: 21 of 21 test questions answered in the question's language; 20 on the fast path, about 4-7 s
- Retrieval: the right source in the top 3 for 26 of 27 questions
- Error handling: 11 of 11 forced failures took the right route, no invented answer
- Dashboard data: 5 of 5 charts read exactly by the AI
- **To measure today:** dashboard delay after the sample change; alert delay to Pepper; sensor readings in tap vs salty water (Munira)

### Limits we say ourselves (judges reward this)
- One sensor kit, not a real farm well; the farm view is one example farm
- Turbidity has no validated calibration yet
- Fanar (Arabic dialect) needs internet; without it AquaMaa falls back to the local model
- Forecasting is not built; alerts are thresholds plus unusual-change detection

## What to fix before filming (only what is seen)
1. **The sensor online** (Munira): without it there is no demo. Check it stays online for 10 min, away from the laptop
2. **Pepper gesture** (Roaa, Munira): an explicit animation when Pepper says an alert or a reading; the automatic gestures may not count as "a gesture"
3. **Pepper's spoken answers short** (Roaa): the value + meaning in 1-2 sentences; test the 3 Pepper questions with the live sensor
4. **Time it**: a timer on screen for the dashboard update and for the alert
5. **Laptop fully charged and plugged in** (at 5% the AI is 2x slower); Ollama warm before filming

## Enhancements that fit in 2 hours (only what judges see)
| # | Change | Who | Time | Rubric |
|---|---|---|---|---|
| 1 | **Latency shown on the dashboard:** "updated 2.1 s after the sensor reading" (now − `created_at`), so the 5 s target is proven on screen, not claimed | Deema | 30 min | M3, Results |
| 2 | **AquaMaa's alert on the dashboard:** show the alert text from `GET /alerts` (value, meaning, advice, crops that still tolerate it) as the banner, the same words Pepper says | Deema | 45 min | X3 (alert with recommendation) |
| 3 | **Pepper's gesture:** an explicit animation when it says an alert or a reading | Roaa, Munira | 30 min | M5, X5 |
| 4 | *Optional:* **early warning:** from the last readings' rate of rise, "at this rate, the water passes the date-palm limit in about N minutes", computed by code | Roaa | 1-1.5 h | X4 |

Not now: Arabic on Pepper, forecasting models, new pages.

## Filming plan today
| Step | Who | Needs |
|---|---|---|
| Sensor online, readings checked in tap and salty water | Munira | ESP32, probes, salt, 2 cups |
| Dashboard open with the history chart, alerts on | Deema | laptop or second screen |
| Pepper on the laptop's Wi-Fi, app running, alerts on | Munira, Roaa | `scripts/start_for_pepper.ps1` |
| Film scenes 2-6 (phone on a stand, screen recording for the dashboard) | Mais | phone, screen recorder |
| Edit to 2.5 min, add the timer and captions | Mais / Roaa | |

## Q&A: each member explains their own part
- Munira: sensors, calibration, ESP32, Wi-Fi, Pepper app
- Deema: database, dashboard, thresholds, alerts on the dashboard
- Mais: the knowledge (national data, crop tolerance, cards), how it was checked
- Roaa: the AI agent, the fast path, the checks, Arabic and dialect, why local Qwen + Fanar
