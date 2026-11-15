# What farmers and officers ask, and how to make Pepper useful (research, 13 Nov 2026)

Builds on the Ooredoo field insight (daily EC, pH and water-level change from farm wells, with no analysis on top)
and on context/research/simplification-for-farmers.md. Sources at the end.

## 1. What farmers need from well sensors
- **Two kinds of information:** real-time alerts to act on now, and seasonal trends for planning (a commercial
  well-monitoring service, Water Strategies). Alerts the user can set, and tracked changes.
- **Salinity alerts protect crops:** a Thai project built low-cost EC sensors and app alerts with 30 farmers, to
  protect high-value crops; smallholders lack affordable real-time salinity monitoring (PBRU journal).
- **Local and simple:** Punjab's groundwater alerts were location-specific, and reached farmers through WhatsApp, SMS,
  workshops and video, not only a dashboard (PreventionWeb). India's MyWell pilot found farmers want village-level
  results (Western Sydney University). The Dutch salinity tools give farmers reliable measurements to decide with
  (FAO Agritech Observatory).
- **Questions this implies (farmer):**
  - "What is my water like now? Can I irrigate with it today?" (live reading + meaning)
  - "Is my well getting saltier / is the level dropping?" (trend over days, like Ooredoo's daily change)
  - "Which crops can I grow with this water?" (suitability)
  - "What should I do?" (one action: switch crop, mix water, flush the soil, test in a lab)
  - "Why is it getting saltier?" (explanation)

## 2. What officers need
- **Data exists, but not framed for decisions:** New York permit holders use water data mainly for compliance, not for
  operational or risk decisions (The Nature Conservancy survey). Lusaka's utilities lacked capacity to use
  hydrogeological data at abstraction decisions (core.ac.uk). A Berkeley report: data must be presented in a way
  relevant to decision makers, built around their needs.
- **Questions this implies (officer):**
  - "Which wells or devices need attention now?" and "Which sensors are offline?"
  - "How has salinity changed this week / this season?"
  - "How does pumping compare with the safe yield?" and "Which municipalities are most affected?"
  - "What are the options, and their trade-offs?" (licensing, recharge, crop restrictions)

## 3. How responsive Pepper must be
- **People expect quick turns:** gaps beyond about 2 seconds start to feel unnatural, and silences over 4 seconds
  disrupt the conversation; classic HCI puts attention loss at about 10 seconds (arXiv 2507.22352, 2404.16053).
- **Fillers help, icons don't:** in a VR voice-agent study, natural spoken fillers improved perceived response time when
  delays were long, while a processing icon and sound did not (arXiv 2507.22352).
- **LLMs on Pepper are typically 3.8-9 s** per reply, because speech-to-text, the model and text-to-speech run one after
  another (FHNW, arXiv 2603.21013).
- **Pepper in real settings is hard:** capabilities depend on the environment and on Pepper's own limits (MDPI
  Applied Sciences 14/1/110). No agriculture deployments of Pepper were found.

## 4. Implications for AquaMaa
1. **Fast path under about 5 s** for the farmers' top questions (live reading, suitability, trend, what to do);
   the deep path only for open questions.
2. **Pepper speaks a filler at once,** with a gesture ("Let me check the sensor…"), so the silence never passes
   4 seconds even when the answer takes longer.
3. **Pepper becomes proactive:** when a new reading crosses a limit, Pepper says it unprompted ("The salinity just went
   up to 2,400; this water is now too salty for tomatoes"). This is the "proactive inspection" in the rubric (X5), and
   gives the robot a job a screen doesn't do.
4. **Trend answers from the dashboard's history** (her grounding already holds the series), for "is it getting
   saltier?".
5. **Officer answers from the dashboard's status:** devices needing attention and offline devices are already in her
   grounding.
6. **Channels beyond the dashboard** (WhatsApp or SMS alerts) are future work, worth naming in "impact and next steps".

## Sources
- Water Strategies, well monitoring (operational and seasonal information): https://issuu.com/waterstrategies/docs/janmuni2019shelby/s/52405
- PBRU journal, IoT salinity alerts with Thai farmers: https://li01.tci-thaijo.org/index.php/scijPBRU/article/download/267478/180427/1111980
- PreventionWeb, Punjab groundwater alerts: https://www.preventionweb.net/quick/101408
- Western Sydney University, MyWell / MARVI app: https://www.westernsydney.edu.au/newscentre/news_centre/story_archive/2019/marvi_app
- FAO Agritech Observatory, AquaPin, AquaMobile and Fixeau: https://agritechobservatory.review.fao.org/ru/aquapin-aquamobile-and-fixeau
- The Nature Conservancy, water data use by permit holders (New York): https://www.conservationgateway.org/collections/freshwater/water-data-use-permit-holders-new-york-state-survey/
- Lusaka water utilities' hydrogeological information needs: https://core.ac.uk/download/74409966.pdf
- Berkeley, Data for water decision making: https://www.law.berkeley.edu/wp-content/uploads/2018/01/DataForWaterDecisionMaking.pdf
- Stanford, groundwater management survey: https://water.stanford.edu/research/projects/groundwater-management-survey
- Mitigating response delays in LLM virtual agents: https://arxiv.org/pdf/2507.22352
- Human latency in conversational turns: https://arxiv.org/abs/2404.16053
- FHNW, low-latency Pepper framework: https://arxiv.org/abs/2603.21013
- MDPI Applied Sciences, Pepper's real-world capabilities and limits: https://mdpi.com/2076-3417/14/1/110
