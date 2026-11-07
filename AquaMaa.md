# AquaMaa

Our working file, last updated 7 November 2026.

## Core contributions

1. An assistant that understands the field and the Qatar context
2. Arabic text-to-speech
3. Simplified analysis for non-technical officers
4. Recommendations that don't force a direction

## Milestones (agreed 7 November)

Roaa builds each milestone. Claude explains, reviews and runs the checks.

Each milestone is frozen as a version once its checks pass. Fixes to earlier milestones go into the next version.

Base code: the official LangGraph agentic RAG tutorial (https://docs.langchain.com/oss/python/langgraph/agentic-rag, MIT), running on local Qwen through Ollama.

### [x] Milestone 1: Open-source code functioning with the Qwen model (v1, 7 Nov)
- The tutorial code runs unchanged, except that `qwen3:14b` through Ollama replaces the hosted model
- **Done when:** the tutorial example runs end to end on the laptop, with the answers saved
- **v1 also fixes three tutorial faults found on the first run:**
  - the grader rejected relevant text, so it was replaced by a quote check adapted from Ai2 ScholarQA, which Python verifies against the chunks
  - the rewrite added chat, so it now returns only the question
  - the answer could skip the search, so the rewrite now forces a search, with one rewrite at most
- Evidence: `fresh-start/run_v1.txt` (tutorial as published) and `run_v1_1.txt` (v1)
- Carried to Milestone 2: page clutter in chunks, and no minimum similarity score
- Carried to Milestone 3: a rewrite can return the question unchanged

### [ ] Milestone 2: Add the knowledge base
- Our sources (Kahramaa, NPC, PSA, NDS3, census, ANND), plus `limits.csv` and `facts.json`
- Chunked and embedded with `bge-m3`, which handles Arabic, and stored in Chroma, with the file and page on every chunk
- **Done when:** every source is indexed, and a search returns the right file for 10 test questions

### [ ] Milestone 3: Retrieval pipeline with proper routing and different types of retrieval
- Routes by question type, following Meta's CRAG benchmark ([arXiv 2406.04744](https://arxiv.org/abs/2406.04744)):
  - simple, simple with a condition, set, comparison, aggregation, multi-hop, post-processing, false premise
- Retrieval methods the routes use: structured lookup, keyword search (BM25), vector search, hybrid
- Search headings first, then full text, and rerank results with `bge-reranker-v2-m3` (check its licence)
- Out-of-scope questions get a general answer, labeled as outside AquaMaa's sources, not a refusal
- **Done when:**
  - 24 labeled questions, 3 per type, are routed correctly in at least 22 of 24
  - the right file is in the top 3 for at least 19 of 24
  - faithfulness, answer relevancy, context precision and context recall are reported, so results compare with WaterCopilot ([similar projects](similar-projects.md))
- Optional: test general hydrology knowledge of `qwen3:14b` against `qwen2.5:3b` with the [HydroLLM benchmark](https://github.com/uihilab/HydroLLM-Benchmark) (MIT)

### [ ] Milestone 4: Agentic ReAct loops in place
- The model picks a tool or route, reads the result, and decides to continue or stop, with a step limit and a saved trace
- **Done when:** in 20 questions, every number comes from a tool, and the drinkable-water question gets a useful, honest answer

### [ ] Milestone 5: Error-handling routing
- Each failure gets its own route:
  - a failed tool
  - an empty or weak retrieval, where the agent rewrites the query and retries once
  - a number not found in the evidence
  - too little evidence, where the answer says so
  - the model being down, with a clear message
- **Done when:** each failure, forced on purpose, takes its route, and none produces an invented answer
  - faithfulness is reported again, before and after the error routes, to show what they change

### [ ] Milestone 6: Simplification prompting
- The checked answer is rewritten for non-technical officers, with the same numbers and conclusion
- For decisions, it gives 2 or 3 options with trade-offs, and the officer chooses
- **Done when:** the numbers match before and after, and 3 non-technical readers restate the main finding correctly
  - the same readers rate completeness on a 1–5 scale (can they understand and act on it?), following Nakarmi et al. 2026 ([arXiv 2609.06222](https://arxiv.org/abs/2609.06222))

### [ ] Milestone 7: Arabic text-to-speech deployed to the website
- Diacritics are added (tashkeel), numbers are spoken as words, and a local voice (Piper `ar_JO`) speaks, after we check its licence
- **Done when:** a native Arabic speaker rates 10 spoken answers as clear, and it works with no robot

### [ ] Milestone 8: Reading the dashboard from the website and integrating it into the pipeline
- The agent reads the same data the dashboard shows, through Deema's data endpoint
- **Done when:** for 5 charts, the agent's numbers match the chart exactly

### [ ] Milestone 9: Connection to the robot
- Pepper hears the question, the laptop transcribes it (faster-whisper), the pipeline answers, and Pepper speaks
- Check Pepper's NAOqi version and Arabic support first
- **Done when:** at least 8 of 10 spoken questions per language work in a noisy room, and the website still works when Pepper is off

### [ ] Milestone 11: Sensor-fault and trend statistics
- Python checks whether readings can be trusted before the agent uses them:
  - stuck sensor: the same value repeated over a set window
  - drift: a slow, steady change with no matching change at neighbouring stations
  - spike: a single jump, using rolling statistics
  - change points: PELT, from the `ruptures` library (check its licence first)
- Trends use the Mann-Kendall test with Sen's slope. Too few readings gives "not enough readings", never a trend
- Results feed Milestone 5's "too little evidence" route, so a doubtful reading is reported as doubtful
- **Done when:**
  - on simulated series with injected faults (stuck, drift, spike, real rise, no fault), each fault is flagged correctly in at least 9 of 10 cases per type
  - the trend test matches a hand-checked answer on 5 series, including one with too few readings

## Decided together

- **Names:** the product is **AquaMaa**. The team stays **AquaNova**, to avoid registration problems.
- **Concept, accepted by the team:** AquaMaa is a groundwater decision-support platform for Qatar. It combines live monitoring, research data and national statistics to show how groundwater is changing, which uses each source could support, and how confident the evidence is, with a tailored view for each institution.
- **Future work, not in the demo:** forecasting and climate scenarios.
- **Product:** groundwater decisions and water-use matching together, with evidence-graded insights. It says "insufficient data" when the evidence is thin.
- **Main view:** Kahramaa, for now.
- **Demo data:** one live station, labeled synthetic stations based on published statistics, and national context from official datasets.
- **UDST research:** cited as background, with no partnership claim. We won't ask that team about it.
- **National goals:** AquaMaa links its findings to Qatar Vision, NDS3, ministry goals and the SDGs. The links are our own mapping, not an official endorsement.
- **Stack (adopted 7 November, after the review in [similar-projects.md](similar-projects.md)):** one LangGraph graph built on v1, running locally.
  - Models: `qwen3:14b` for the agent, router and answers, with `qwen3:8b` tested for voice speed. Native-speaker review for Arabic, and an Arabic model such as ALLaM only if needed. No fine-tuning
  - Retrieval: `bge-m3` embeddings, hybrid BM25 plus vector search with reciprocal rank fusion, the `bge-m3` reranker, headings searched first, tables kept as data, and the v1 quote check
  - Statistics: sensor-fault checks and Mann-Kendall trends (Milestone 11), a TF-IDF router baseline, and calculations in Python
  - Speech: faster-whisper, tashkeel, and Piper `ar_JO` once its licence is checked
  - Evaluation: CRAG question types, faithfulness, answer relevancy, context precision and recall, and human completeness ratings
  - Not adopted: fine-tuning, multiple agents, a deep-learning quality predictor, proprietary models
  - Replaces the earlier 16-component design ([agent-design.md](context/reference/agent-design.md), kept as a record)
- **Roaa also owns:** the suitability engine.
- **QR explainer:** visitors scan a dashboard QR code with a phone, and the robot explains that chart. Start with three or four charts.
- **Dashboard first:** it shows charts and insights without waiting for a question. Questions are for more specialized answers.
- **User categories:** executive, technical and operational, with several view versions of the same information.
- **Two answers:** one for the website and one for robot text-to-speech, from the same evidence.
- **Analysis first, then options:** the dashboard shows analysis. The assistant can recommend, with evidence and trade-offs, and the officer decides.
- **Language:** English and Arabic, including Arabic speech.
- **Team:** Mais on data, Munira on sensors and hardware, Roaa on the agent, Deema on the website and integration, and Mohammed on visuals and video.
- **Freeze:** 15:00 on Thursday 5 November.

## Still to decide

| Decision | My recommendation | Why |
|---|---|---|
| Problem statement | The draft below | It covers both parts of the product and uses current official numbers |
| Subtitle | AquaMaa: Groundwater Decision Support for Qatar | It matches the accepted concept. "Resource allocation" overclaims, because Kahramaa makes those decisions. |
| Backend API and login | Mais | It sits next to the database |
| Robot | Munira, with the robot expert | It needs hands-on time in A25 |
| Tech stack | FastAPI, Supabase, Next.js, Leaflet | It matches Deema's diagram. Test first that Supabase stays awake while unattended. |
| Qatar_MWDVF data | Use it for realistic station values, and credit it clearly. Don't present it as current or as your own. | It has 201 real locations from 2020, but no open licence, and one of its authors may be reviewing you |
| Which robot | The one whose software can reach the backend | Older robot software may fail on HTTPS, so one test call would decide this |
| Deema's diagram | Change the name to AquaMaa, and make the seven bigger changes in [notes](context/reference/notes.md#review-of-deemas-architecture-diagram) | The chain is right, but it misses "insufficient data", role views and non-sensor data |
| 15 November | Find out who can attend, and prepare a recorded demo either way | The deck puts external reviewers on the 15th, but our plan is built around the 12th |

### Final problem statement (team, 7 November)

> Qatar faces significant pressure on its limited groundwater resources due to scarce rainfall, increasing water demand, and excessive extraction. Qatar's renewable freshwater availability is estimated at only 29 m³ per capita annually, significantly below the global water poverty threshold of 1,000 m³. Furthermore, groundwater abstraction is estimated to be 3–5 times the natural recharge rate, contributing to groundwater depletion and seawater intrusion, which progressively deteriorate water quality. The severity of this issue is reflected in research indicating that up to 95% of tested groundwater samples were unsuitable for agricultural irrigation, with over 60% exhibiting salinity levels likely to harm agricultural activities. Furthermore, agricultural groundwater extraction remains approximately 226–230 million m³ annually, highlighting the continued pressure on these resources. Despite ongoing government initiatives to rehabilitate groundwater wells and enhance aquifer replenishment, there is a need to strengthen groundwater-quality monitoring and transform collected data into accessible, understandable, and actionable insights. This is essential to support informed decision-making, assess groundwater conditions, and promote the sustainable management of Qatar's groundwater resources.

Resources: [Hukoomi, water and desalination](https://hukoomi.gov.qa/en/articles/water-and-desalination), [HBKU QEERI article](https://www.hbku.edu.qa/en/news/QEERI-SUST-WWDQGC), [Kahramaa water sector](https://www.km.qa/AboutUs/Pages/WaterSector.aspx)

**Source check (7 November):**

| Claim | Source | Note |
|---|---|---|
| 29 m³ per capita | Hukoomi page, not opened (403) | A 2011 figure ([Oxford Business Group 2014](https://oxfordbusinessgroup.com/reports/qatar/2014-report/economy/demand-and-opportunity-moves-towards-conservation-and-reuse-of-limited-resources)). The [UN SDG 6 portal](https://www.sdg6data.org/en/country-or-area/Qatar) gives 22 m³ for 2017 |
| 3–5 times recharge | QEERI article, Lawler, 22 Mar 2022 | Matches the 2019–2022 estimate of 250 (3.3 times recharge, 5 times safe yield). The revised 2023 estimate of 200 gives 2.7 and 4 times |
| 95% unsuitable, over 60% harmful salinity | QEERI article, 2022 | The article gives no sample count or sampling year |
| 226–230 million m³ for agriculture | QEERI article, "unchanged since 2005" | Kahramaa 2023 estimates about 200 total, 90% from farms, so about 180 |
| Seawater intrusion | QEERI article | Stated as a mechanism, not a measured finding |

## Key facts

- **Abstraction:** Kahramaa estimated 250 million m³ a year, then revised it to [200 using groundwater modeling](https://km.qa/MediaCenter/Publications/SR2023-English.pdf). These are estimates, so don't say pumping fell. Wells aren't metered yet, and flowmeters are planned within three years.
- **Safe yield:** [49.6 million m³ a year](https://www.npc.qa/en/statistics/Statistical%20Releases/Environmental/Water/Water_Statistics_2023_EN.pdf), a 1998-2023 average from NPC's newest report. The 2021 edition said 54.2.
- **Groundwater balance:** -49 million m³ in 2023 and -184 in 2021. 2023 uses a new modeling method and was a wet year, so don't present this as improvement.
- **Existing systems:** [Law 23 of 2025](https://www.almeezan.qa/LawView.aspx?opt=&LawID=10163&language=ar) requires a water resources database linked to geographic information, and a [2025 report](context/reference/source-documents/ANND_Right_to_Water_in_Qatar.pdf) says Kahramaa keeps a central one. So we shouldn't claim that no shared system exists. [TASMU's Smart Water Network](https://tasmu.gov.qa/the-playbook/smart-water-network) covers network operations and leaks.
- **Kahramaa's legal role:** [Amiri Decision 46 of 2015](context/reference/source-documents/Amiri_Decision_46_2015.pdf) tasks it with building a water resources database and running monitoring networks, and with analyzing their data for assessing and managing resources "for different uses" (my translation).
- **Law:** Law No. 23 of 2025 is in force, with 90 articles. I've confirmed only Articles 2 and 76 from the official portal, so check any other article before quoting it.
- **What Kahramaa wants:** its [Aqua-Intelligence challenge](https://qoi.qrdi.org.qa/en/challenges/aqua-intelligence-the-smart-water-quality-innovation-challenge/pages/challenge-statements?lang=en) seeks continuous quality monitoring with alerts and dashboards, but for the drinking network, not groundwater.
- **UDST research:** the [2026 review](https://doi.org/10.1007/s12665-026-13023-y) comes from a project behind this challenge, and three authors are on the committee.
- **Suitability:** studies conflict, so quote each with its own study. Sensors alone can't prove a use is suitable.
- **Security:** Azure Qatar Central is [in scope for Qatar's NIA certification](https://learn.microsoft.com/en-us/azure/compliance/offerings/offering-qatar-nia). The [Cloud First policy](https://hukoomi.gov.qa/-/media/df/assets/documents/p005_cloudfirst_v100_en_0.pdf) sets data classes from C0 to C4.

## National goals

All 41 goals, with sources, are in [policy-goals.csv](context/reference/policy-goals.csv). The ones closest to AquaMaa:

- **[Qatar National Vision 2030](context/reference/source-documents/Qatar_National_Vision_2030.pdf), p.32:** "Preserving and protecting the environment, including air, land, water and biological diversity." It also names "diminishing water" resources as a local issue (p.30).
- **[NDS3](context/reference/source-documents/Qatar_NDS3.pdf), p.27:** "Groundwater extraction reduced by 70%" by 2030. No baseline is given.
- **NDS3:** groundwater metering, protection zones, and "regular and effective monitoring" of all water sources with consistent quality standards.
- **NDS3:** water use per ton of crop improved by 40%.
- **[Qatar NDC 3.0](context/reference/source-documents/Qatar_NDC_3.pdf), p.18 (proposed):** real-time monitoring "through a national water database". It also proposes AI in monitoring tools (p.13).
- **[Environment strategy](https://www.gulf-times.com/story/703337/pm-launches-qatars-national-environment-climate-strategy):** reduce groundwater extraction by 60%. NDS3 says 70%. The NDC says this strategy was later aligned with NDS3, but I haven't seen the update, so name the source each time.
- **[Kahramaa 2026-2030](https://www.km.qa/MediaCenter/Pages/NewsDetails.aspx?ItemID=508):** water security, resource sustainability and digital transformation.
- **[NDS3 outcomes](https://www.npc.qa/en/planning/nds3/Pages/strategicalnationaloutcome.aspx):** "Launch centralized data/AI/cloud capabilities" and "drive cross-policy collaboration."
- **[Ministry of Municipality 2024-2030](https://thepeninsulaqatar.com/article/14/06/2024/ministry-of-municipality-launches-strategy-2024-2030):** food security, digital services and quality of life.
- **SDG 6:** targets 6.3 (quality), 6.4 (sustainable withdrawals), 6.5 (integrated management) and 6.6 (ecosystems, including aquifers).

I found no separate published visions for individual municipalities, so they fall under the Ministry of Municipality strategy.

## National data for the demo

Show these as national context only, never as one well's condition:

- [Total groundwater abstraction](context/reference/datasets/total-abstraction-from-ground-water.csv)
- [Abstraction by well type](context/reference/datasets/total-water-storage-2023.csv) (the source title is misleading)
- [Aquifer water balance](context/reference/datasets/natural-water-balance-of-qatar-s-aquifers-annual-average-2014-2021.csv)
- [Farms and wells](context/reference/datasets/number-of-farms-and-wells-by-farm-status-and-number-of-wells-class.csv)
- [Wells by municipality](context/reference/datasets/number-of-farms-and-wells-by-type-of-the-farm-and-municipality.csv), 2016-2025: real figures for the Municipality view, such as 1,482 wells on working farms in Al Khor

## Research data on hand

[Qatar_MWDVF](context/reference/Qatar_MWDVF/SOURCE.txt) is downloaded for reference. The main file is [Geochemistry_Dataset.xlsx](context/reference/Qatar_MWDVF/Data/Geochemistry_Dataset.xlsx), with 201 locations from 2020, including coordinates, EC, TDS, pH and major ions. Its TDS is exactly half its EC in every row, so TDS looks calculated. It has no boron or nitrate.

## Hardware checks

The exact sensor models aren't confirmed, so these depend on what's in the kit:

- **TDS:** a common probe stops at 1000 ppm, while the 205-well survey averaged 4,598 mg/L.
- **Turbidity:** a common module outputs up to 4.5 V, which is above the ESP32's 3.3 V limit. Measure it before wiring.

## Where things are

Everything else is in [reference/](context/reference/), which I keep up to date, so you don't need to open it.
