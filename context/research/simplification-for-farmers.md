# How AquaMaa should simplify answers for farmers (research for Milestone 6)

Researched 13 November 2026 for Milestone 6 (simplification prompting), with farmers as the target user.
Input for Mais's Knowledge Milestone 2 (how we answer). Sources at the end; claims from preprints or news are marked.

## 1. Who "the farmer" is in Qatar
- **Two different people.** Qatari owners usually hold other jobs and hire managers and workers to run the farm
  (Wikipedia, "Agriculture in Qatar", undated, so treat as background). The 2024 labour data lists 32,126 skilled
  agricultural and fishery workers in Qatar, and none of them Qatari (GLMM, 2024).
- **Workers are mostly South Asian.** A farm case study near Doha: Qatari owner, 21 Nepali, 3 Bangladeshi and 3 Indian
  workers (Donini, Political Development journal). A 2012 Weill Cornell study ranked Nepali, Urdu, Hindi, English and
  Arabic as Qatar's most spoken languages, and found many of these workers know little English and no Arabic (cited in
  arXiv 1610.02633). Bangladeshi workers also lease farms themselves (Korea Herald / Daily Star).
- **What it means for us:** the **owner or manager** reads Arabic or English and makes the decisions (which crops,
  treat the water or not). The **worker** acts on them and may read neither. AquaMaa's answers in Arabic and English
  fit the owner or manager. For workers, Pepper speaking helps, but their languages are out of scope before 15 Nov.

## 2. What works in farm advice
- **Short, repeated and actionable.** A meta-analysis of six SMS programmes reaching 128,000 farmers in Kenya and
  Rwanda found modest but cost-effective effects that lasted while the messages continued; saying that advice was
  tailored to local soil did not make farmers follow it more (VoxDev / PxD). An Indian two-way voice service (Ama Krushi)
  helped farmers avoid costly crop losses (PxD, 2025). Voice lessons in Mali reached farmers without literacy and
  raised knowledge and uptake (FAO Agroecology Knowledge Hub).
- **Understanding is the weak point.** In a user study of 800+ smallholders using an AI advisory chatbot (Farmer.Chat),
  33% said the information was not easy to understand, more so with less education (60 Decibels, reported by
  Rural 21 / Digital Green).
- **Facts first, wording second.** Digital Green's design keeps retrieval of facts separate from a final layer that
  turns them into a culturally appropriate, safety-aware reply, and checks the facts against expert ground truth
  (arXiv 2603.03294, preprint). AquaMaa already does this: verify the answer, then simplify it.

## 3. How to present water-quality numbers
- **Give a verdict level, with the source of each threshold.** Extension guides grade each water result as a level of
  concern (Arkansas FS-2017-03: low, moderate, high). New Mexico's guide W-102 gives three EC bands for irrigation
  water: usually no problem below 0.7 dS/m, increasing problems from 0.7 to 3.0, severe limits above 3.0. That maps
  onto green, amber and red, the same bands as FAO 29, which is in our knowledge base.
- **The verdict depends on use, crop and soil.** Limits are slightly higher in sandy, fast-draining soils and half in
  heavy clays (NSW DPI Primefact 1344). Maryland's guide warns that recommendations vary, so each threshold must cite
  its source and be checked against crop tolerance. Qatar's farm soils are mostly sandy.
- **Use few numbers, each with its meaning.** CDC's Clear Communication Index asks whether each number is needed for
  the main message and is one the audience already uses. Low-numeracy guidance: only necessary numbers, converted for
  the reader, with labels such as low, normal or high; numbers alone are a barrier, and words alone ("low risk") are
  vague, so give both (CDC numeracy research; National Health Council training). Avoid percent where a reader may not
  know it.
- **Pretest with real users.** The CDC guide says guidelines cannot replace testing with the intended audience.

## 4. Known risk: simplification changes numbers
- LLM simplification improves readability but can add errors or over-simplify (CLEF 2025 SimpleText summary).
  Shared-task teams forbid paraphrasing numerals in the prompt ("2000 people" must not become "many people";
  CardiffNLP at CLEARS-2025) and add checks that numbers, dates and negations are kept (CLEF 2026 SimpleText papers).
  A Nov 2025 preprint reports that Qwen 2.5 32B struggles to balance readability against factual accuracy
  (arXiv 2511.05080, from its abstract and a third-party summary).
- **For AquaMaa:** the planned Python number check (keep the checked answer if any number changes) follows this
  practice, and is needed with Qwen.

## 5. Measuring "simple"
- **English:** Flesch reading ease or grade level. **Arabic:** OSMAN, an open-source Arabic readability metric that
  correlates with Flesch on 73,000 parallel UN sentences and works with or without diacritics (El-Haj and Rayson,
  LREC 2016; Java tool on SourceForge).
- **People:** the Milestone 6 check stays: 3 non-technical readers restate the main finding and rate completeness 1-5.

## 6. Proposed answer shape for farmers (for Milestone 6 and Mais's draft)
1. **Verdict first, for their use:** "Your well water is too salty to drink, and fine only for salt-tolerant crops."
   One level per use (drinking, irrigation), from the meaning table, with its source.
2. **One thing to do next:** "Grow salt-tolerant crops such as date palm or barley, or treat the water before drinking."
3. **The number, with its label:** "Salinity: 2,400 mg/L (high)." Only the numbers that support the verdict.
4. **Why, in one line,** only if asked or needed.
5. **Source tag on the website; no labels when Pepper speaks.** At most 4 sentences written, 2-3 spoken.
6. **Decisions as options, not orders:** 2-3 options with one trade-off each; the farmer chooses (core contribution 4).
7. **Language:** Arabic (simple Modern Standard Arabic) or English, as asked. Workers' languages: after 15 Nov.

## Sources
- University of Arkansas, FS-2017-03 Irrigation water quality: https://awrc.uada.edu/files/2022/10/FS-2017-03_Irrigation_V4.pdf
- University of Nevada, Reno extension: https://extension.unr.edu/publication.aspx?PubID=6972
- New Mexico State University, Guide W-102 (via USDA eFOTG): https://efotg.sc.egov.usda.gov/references/public/NM/water21b.pdf
- University of Maryland, Salinity matters (FS-1128): https://extension.umd.edu/agnr.umd.edu/sites/extension.umd.edu/files/publications/Salinity%20Matters%20for%20High%20Tunnels%20and%20Growing%20Media%20%283%29.pdf
- NSW DPI, Interpreting water quality test results: https://dpird-web.matrix.squiz.cloud/__data/assets/pdf_file/0007/523618/interpreting-water-quality-test-results.pdf
- Digital Green, Farmer.Chat paper (preprint): https://arxiv.org/pdf/2603.03294
- Hugging Face, Digital Green LLM-as-a-judge case study: https://www.huggingface.co/blog/digital-green-llm-judge
- Rural 21, Testing AI advisory services (FarmerChat): https://www.rural21.com/english/news/detail/article/testing-ai-advisory-services-insights-from-farmerchat-in-india-and-kenya.html
- AEA RCT Registry, Farmer.Chat in Kenya: https://www.socialscienceregistry.org/trials/17035
- VoxDev, Customised agricultural advice at scale: https://voxdev.org/topic/agriculture/customised-agricultural-advice-scale-how-digital-extension-helps-indian-farmers
- PxD, Customized advisory services in India (2025): https://precisiondev.org/wp-content/uploads/2025/03/Customized-Advisory-Services-in-India-PxD-March-2025.pdf
- FAO Agroecology Knowledge Hub (voice lessons in Mali): https://www.fao.org/agroecology/new-knowledge-module/publications/detail/1681529b/en
- CDC Clear Communication Index user guide: https://Cdc.gov/ccindex/pdf/clear-communication-user-guide.pdf
- CDC health numeracy research: https://www.cdc.gov/healthliteracy/researchevaluate/numeracy.html
- National Health Council, health literacy training resources: https://nationalhealthcouncil.org/wp-content/uploads/2021/10/Summary-Resources-for-NHC-Health-Literacy-Training-3.pdf
- CardiffNLP at CLEARS-2025: https://arxiv.org/pdf/2508.03240
- Readability and meaning in LLM simplification (preprint): https://arxiv.org/abs/2511.05080v3
- CLEF SimpleText papers: https://ceur-ws.org/Vol-4283/paper473.pdf
- OSMAN Arabic readability metric: https://eprints.lancs.ac.uk/id/eprint/78553
- GLMM, Qatar employed population by occupation 2024: https://gulfmigration.grc.net/qatar-employed-population-15-years-and-above-by-nationality-qatari-non-qatari-and-occupation-2024/?print=pdf
- Donini, Nepali workers in Qatar: https://journals.openedition.org/poldev/3077?lang=en
- Korea Herald, Bangladeshi migrants and Qatar's agriculture: https://www.koreaherald.com/article/10517698
- Languages spoken in Qatar (cited 2012 Weill Cornell study): https://arxiv.org/pdf/1610.02633
