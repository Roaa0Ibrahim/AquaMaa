# AquaMaa: giving Qatar's wells a voice

**Team AquaNova · UDST Smart WaterBot Challenge 2026**

Farm wells in Qatar are getting saltier: in the north the saline front advances inland every year, and many wells
already have sensors, but nobody reads them in time. The farmer finds out when the crops suffer. **AquaMaa turns each
reading into its meaning and an action**, for the ministry officer and for the farm owner, on a live dashboard, through
an AI assistant in Arabic and English, and through a Pepper robot in the monitoring room that speaks up when a well
goes wrong.

Our key word is **trust**:
1. **Real data:** live, timely readings from real sensors, every reading stored with its time.
2. **Meaning from sources, not AI guessing:** facts and verdicts are computed by code from cited sources (WHO, FAO 29,
   Qatar's water law, national statistics); the language model only puts them into words, and a check rejects any number
   or source that is not in the facts.
3. **Words each user understands:** plain answers for the farm owner, figures and options for the officer.
4. **Made for Qatar:** Arabic and English, including Qatari dialect (Fanar, from QCRI), by text or by voice.

---

## What it does

| Part | What the user sees |
|---|---|
| **Officer dashboard** | All wells at a glance: live pH, temperature, salinity (TDS), turbidity index, water quality index (CCME WQI), water level, alerts, trends, map, national statistics. Arabic and English. |
| **Farmer view (My Farm)** | Each of the farmer's wells as a drawing coloured by water quality, gauges with thresholds, a verdict for **his crop**, **what this water is good for** (each crop and drinking, ticked or crossed), **what to do**, and alerts on the phone (Telegram). |
| **AquaMaa assistant** | A chat on every page: any question about wells, water quality, crops, law and statistics, answered from live data and cited sources, in the question's language, by text or voice; it explains the page you are on. |
| **Alerts** | Salinity or pH outside its range (critical levels flagged as urgent), sensor silent for 30 minutes, unusual changes, water quality index; each with what it means and what to do. |
| **Pepper robot** | Stands in the ministry's monitoring room, shows the live dashboard on its tablet, speaks alerts by itself and answers spoken questions with the live readings. |

## How it fits together

```
 probes (TDS, pH, temperature, turbidity, water level)
   -> ESP32 (Wi-Fi, no cable)  -> database (Supabase: every reading with its time)
   -> website (Node/Express dashboard, officer + farmer views, alerts, Telegram)
   -> AquaMaa AI service (Python, FastAPI, on the laptop)  <-  Pepper app (Android, QiSDK) on the same Wi-Fi
```

## Repository layout

| Where | What |
|---|---|
| **this branch** (`main` / `milestone-6`) | The **AquaMaa AI** (`agent.py`, `api.py`, `fastpath/`, `steps/`), the knowledge base (`database/`), the **Pepper app** (`pepper/PepperWaterQuality`), the **sensor firmware** (`sensor/AquaNova.ino`) and its **calibration record** ([sensor/SENSOR_CALIBRATION.md](sensor/SENSOR_CALIBRATION.md)), tests, scripts and guides |
| branch **`deema-development`** | The **website**: dashboard, farmer view, alerts, Telegram bot, Supabase schema (`server/`, `public/`, `config/thresholds.json`, `supabase/`) |
| **Release** `v1.0-submission` | One zip with everything: AI, website, Pepper app (APK) and sensor firmware |

## The AI, briefly

- **Local open models** through Ollama: `qwen3:14b` for answers, `qwen2.5:3b` for quick English farm answers,
  `bge-m3` for search (Arabic and English). Nothing leaves the laptop except optional Fanar and voice calls.
- **Fast path (most questions, about 1-7 s):** the question type is found by meaning; Python builds the facts and the
  verdicts from live data and the knowledge base (e.g. FAO 29 crop tolerance -> "date palms: no yield loss"); one
  short model call words them; a check keeps only the facts' numbers and sources.
- **Deep path (open questions):** a LangGraph ReAct agent (search, tables, dashboard, calculator), then a verifier that
  repairs or removes unsupported sentences.
- **Understanding the question:** Qatari dialect rewritten to standard Arabic (Fanar), misheard speech corrected
  from AquaMaa's own vocabulary, and questions that look unrelated re-read as the relevant question they probably are.
- **Two readers:** the account's role picks the farmer or officer answer style; Arabic questions get Arabic-only answers.
- **Voice:** speech-to-text with Fanar (Gulf Arabic), natural Qatari Arabic voice for spoken answers.
- Based on the LangGraph agentic RAG tutorial (MIT), extended in milestones documented in [AquaMaa.md](AquaMaa.md).

## Results (measured)

| What | Result |
|---|---|
| Common questions (fast path) | about 4-7 s; farm verdicts about 1-2 s; Pepper's live reading about 0.1 s |
| Answer in the question's language | 21 of 21 test questions (English, Arabic, Qatari dialect) |
| Right source in the top 3 | 26 of 27 labelled questions |
| Forced failures (bad tool, missing evidence, model down, invented number or citation...) | 11 of 11 handled with no invented answer |
| Dashboard figures read by the AI | 5 of 5 charts exactly |
| Dashboard refresh | every 5 s from the database |

Test scripts: `scripts/run_regression.ps1`, `eval_personas.py`, `eval_errors.py`, `test_pepper_topics.py`; outputs in `logs/`.

## Run it

**Windows (one click):** double-click **Start AquaMaa demo** (`scripts/start_demo.ps1`): it starts the model, the
website and AquaMaa for Pepper, loads the model and opens the website. Full guide: [DEMO_DAY_SETUP.md](DEMO_DAY_SETUP.md).

**Mac:** `bash scripts/setup_mac.sh` once, then `bash scripts/start_demo_mac.sh` ([SETUP_FOR_DEEMA_MAC.md](SETUP_FOR_DEEMA_MAC.md)).

**By hand:**
```
python -m pip install -r requirements.txt        # Python 3.13; Ollama with qwen3:14b, qwen2.5:3b, bge-m3
python build_kb.py                               # builds the knowledge base (vector_store.json, chunks.jsonl)
python api.py                                    # AquaMaa at http://127.0.0.1:8000 (AQUAMAA_API_HOST=0.0.0.0 for Pepper)
```
The website (branch `deema-development`): `npm install`, `npm run seed`, `node server/index.js` -> http://localhost:3000
(demo accounts `officer@aquamaa.demo` and `farmer@aquamaa.demo`). Settings go in `.env` files that are not in the
repository: `FANAR_API_KEY` (optional) here; the Supabase URL and publishable key for the website.

**Pepper:** install `AquaMaa_Pepper.apk` (`adb install -r`), switch ADB off, open AquaMaa; it finds the laptop on the
Wi-Fi by itself ([pepper/INSTALL_FOR_MUNIRA.txt](pepper/INSTALL_FOR_MUNIRA.txt)).

## Limits (honest)

- One sensor kit on a test sample, not yet a farm well; the farm view uses one example farm.
- Turbidity has no validated NTU calibration (shown as an index); pH needs regular buffer calibration.
- The registered-wells map, extraction and water-level history are demonstration data until the official feeds are
  connected; they are labelled as such.
- Pepper's speech recognition works by keywords in English (the robot's recognizer needs a vocabulary); the website
  takes any wording in Arabic or English.
- Fanar and the natural voice need internet; without it AquaMaa falls back to its local model and the browser voice.
- Forecasting is not built yet; alerts are thresholds, unusual-change detection and the water quality index.

## Team

| Member | Contribution |
|---|---|
| **Roaa** | AquaMaa AI (agent, fast path, checks, Arabic and dialect, voice), Pepper app integration, alerts service |
| **Deema** | Website: officer and farmer dashboards, database schema, water quality index, Water Card, alerts, Telegram bot |
| **Munira** | Sensors and ESP32 firmware, wiring and calibration, Pepper robot setup |
| **Mais** | Knowledge and data: national statistics, crop tolerance, answer checks |

Acknowledgements: LangGraph (MIT), Ollama, Qwen, BGE-M3, Fanar (QCRI), edge-tts, QiSDK (Aldebaran).
