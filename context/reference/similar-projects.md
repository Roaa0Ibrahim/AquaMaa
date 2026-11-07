# Similar projects

Read 7 November 2026. Each entry says how much was read. "Full" means the paper's text was read, not only its abstract.

## Summary

| # | Project | Read | Open resources | Closest to AquaMa in |
|---|---|---|---|---|
| 1 | WaterCopilot (IWMI and Microsoft Research) | Full | None | Documents plus live data, RAGAS evaluation |
| 2 | Relevance is not enough (Nakarmi et al., NJIT) | Full | None | Plain answers for non-experts, completeness |
| 3 | Mounce et al., ACQUIRE | Full | None | Regulatory reports as the knowledge base |
| 4 | HydroLLM benchmark (Kizilkaya et al.) | Full text, but its scores are only in figures I couldn't read | [HydroLLM-Benchmark](https://github.com/uihilab/HydroLLM-Benchmark), MIT | Test questions from a textbook and articles |
| 5 | LLM-EPANET (Goldshtein et al.) | Abstract and repository only | [LLMs-in-WDS-Modeling](https://github.com/yinon-gold/LLMs-in-WDS-Modeling), MIT | Agent turns questions into code and runs it |
| 6 | Paneru and Paneru | Full | None | A water quality RAG chatbot, as a simple baseline |
| 7 | WaterGPT (Ren et al.) | Not opened: the publisher's site returned 403 | None found | Qwen-based water model with agents |
| 8 | Nityandal, Iowa State thesis | Talk abstract only | None | Groundwater governance plus a regulatory RAG |

**Gap still open:** none of the eight covers groundwater quality in Qatar, Arabic speech, or recommendations that leave the decision to the officer. That isn't proof of novelty, because this isn't a full literature review.

---

## 1. WaterCopilot
Vickneswaran, Dickens, Garcia Andarcia, Silva and Retief. *WaterCopilot: An AI-Driven Virtual Assistant for Water Management.* arXiv [2601.08559](https://arxiv.org/abs/2601.08559), 2026.

- **What it does:** a virtual assistant for the Limpopo River Basin, built with Microsoft Research.
- **Knowledge base:**
  - **Documents:** water management reports, transboundary policy frameworks, hydrological model documentation and environmental flow studies.
  - **Live data:** rainfall, river flow, reservoir levels, environmental flow alerts, water accounting and irrigation use, through APIs and regularly updated CSV files.
- **Method:**
  - **Two tool plugins:** one for document search through Azure AI Search, and one that queries the live databases.
  - **Extraction:** Azure Document Intelligence pulls out text and tables, then labels each piece as a paragraph, header or table, then chunks it.
  - **Model:** a GPT model with tool calling.
  - **Answers:** in English, Portuguese and French, with source references, calculations and charts.
- **Evaluation:**
  - **Questions:** 30, in three levels:
    - **Level 1:** factual lookups (13 questions)
    - **Level 2:** analysis of documents (8)
    - **Level 3:** real-time analysis (9)
  - **RAGAS scores:**

    | Metric | Score |
    |---|---|
    | Faithfulness | 0.7877 |
    | Answer relevancy | 0.8571 |
    | Context precision | 0.8009 |
    | Context recall | 0.7763 |
- **Limitations the authors state:**
  - It can't read tables or images in documents.
  - It's tied to GPT models, so switching to Llama would need a redesign.
  - Accuracy in other languages depends on the GPT model.
  - It was evaluated with RAGAS only, with no human evaluation.
- **Lessons for AquaMa:**
  - It has the same two-part design: documents plus live data.
  - Its three difficulty levels map onto our question types.
  - Its table limitation supports our plan to keep tables as tables.
  - Its missing human evaluation is a gap our reader tests fill.

## 2. Relevance is not enough
Nakarmi, Battula, Diaz and Dasgupta (NJIT and Newark Water Coalition). *Relevance is not enough: A Communication-Oriented Retrieval System for Consequential Scientific Question Answering.* arXiv [2609.06222](https://arxiv.org/abs/2609.06222), 2026. The paper is CC BY 4.0.

- **Main idea:** for questions with real consequences, such as "is my water test result harmful?", an answer can be relevant and correct yet still leave a non-expert unable to act. The authors propose **completeness** as the measure: enough context and stated uncertainty for a non-expert to understand and act.
- **Knowledge base:** water quality guidance, contamination regulations and public health guidance, stored as JSON organised by headings and subheadings.
- **Method:**
  1. **Retrieval:** `all-MiniLM-L6-v2` matches the question to section headings first, and falls back to full text if no heading scores above a cosine similarity of 0.51.
  2. **Relevance check:** gpt-4o-mini scores each chunk from 0 to 3, and only chunks scoring 2 or more go forward.
  3. **Gap check:** Mistral-7B labels the question as causal, regulatory, comparative or explanatory. It then checks the evidence against questions for that label, fills gaps from the discarded chunks or from new searches, and stops after 2 rounds.
  4. **Answer:** GPT-5.2 writes evidence-based claims, states what isn't known, then rewrites them for a persona: "caring neighbor" or "city hall translator".
  5. **Judge:** a Qwen2.5-7B model fine-tuned with LoRA to predict human completeness ratings.
- **Evaluation:**
  - **Questions:** 500, created by GPT-5.2 playing a concerned member of the public.
  - **Human ratings:** two raters scored 648 answers, with agreement κ = 0.65.

  | Pipeline | Context size | Completeness |
  |---|---|---|
  | Baseline | 56,032 | 0.600 |
  | Relevance check | 2,243 | 0.751 |
  | Gap check, explicit | 2,226 | 0.749 |

  - **Relevance doesn't predict completeness:** relevance metrics explained only 1.4% of the variation in completeness (R² = 0.014).
  - **The fine-tuned judge matched humans better:** a correlation of ρ = 0.73, against 0.41 for the default judge.
  - **Personas changed tone, not completeness:** the "caring neighbor" persona drew an emotional response in over 50% of answers. The personas didn't change completeness.
- **Limitations the authors state:**
  - It depends on proprietary models.
  - The gap-check questions are specific to water quality.
  - Most test questions were direct, so multi-step questions are untested.
- **Lessons for AquaMa:**
  - The strongest support for contribution 3, plain answers. It also gives us a measure to adopt, completeness, rather than relevance alone.
  - Its two personas match our executive and operational views.
  - Its 0–3 relevance score and gap check are an alternative to our quote check, so worth comparing.
- **Open resources:** none released.

## 3. Mounce et al., ACQUIRE
Mounce, Mounce and Boxall. *AI-Augmented Water Quality Event Response: The Role of Generative Models for Decision Support.* Water 17(22), 3260, 2025. [doi:10.3390/w17223260](https://doi.org/10.3390/w17223260). The paper is CC BY.

- **What it is:** mostly a review of AI in the water sector, with one case study.
- **Case study:** ACQUIRE builds chatbots from England's drinking water regulator's reports on water quality incidents. An earlier study built a database of over 2,300 past incidents from 14 years of reports. The chatbot retrieves past interventions that worked and turns them into a generic response plan.
- **Method:** RAG over "a curated and high-provenance document corpus" of versioned regulatory reports, which gives an audit trail. The paper names the models in general terms only: commercial ones such as GPT 5.1, and open ones such as Llama 3.3 and Mistral 7B.
- **Evaluation:** qualitative only: three months of feedback from a real UK water company control room, with no numerical metrics.
  - **New staff:** they found it most useful as "a functional roadmap or starting point".
  - **Experienced managers:** they used it in the background to double-check their own plans, and it sometimes suggested actions they'd missed.
  - **Response plans:** its output was used to revise the company's printed incident response plans.
- **Challenges the authors note:**
  - **Under-representation of non-English documents and local contexts,** which leads to bias.
  - **Quality standards that differ by region.**
  - **The need for human oversight, explainability and audit trails.**
- **Lessons for AquaMa:**
  - A peer-reviewed precedent for grounding answers in official reports, with an audit trail.
  - The language-bias point supports contribution 2, Arabic.
  - The finding that it helps new staff most fits our non-technical officers.
- **Open resources:** none. Its data availability statement says all material is in the article.

## 4. HydroLLM benchmark
Kizilkaya, Sajja, Sermet and Demir. *Toward HydroLLM: a benchmark dataset for hydrology-specific knowledge assessment for large language models.* Environmental Data Science 4, e31, 2025. [doi:10.1017/eds.2025.10006](https://doi.org/10.1017/eds.2025.10006). The paper is CC BY 4.0.

- **How the dataset was built:**
  - **Sources:** one textbook, *Fundamentals of Hydrology* (Davie and Quinn, 2019), and 2,000 Elsevier articles from 2022–2024.
  - **Generation:** gpt-4o-mini wrote the questions.

  | Question format | From articles | From the textbook |
  |---|---|---|
  | True/false | 1,124 | 224 |
  | Multiple choice | 1,001 | 209 |
  | Fill in the blank | 997 | 225 |
  | Open-ended | 2,001 | 220 |

  - **Filtering:** questions tied to one article's details, such as a location or a number, were removed.
- **Models tested:** gpt-4o-mini scored highest, Llama3.1 70B was close behind, and Llama3 8B was lowest. The scores are only in the figures, which I couldn't read.
- **Limitations the authors state:**
  - gpt-4o-mini made "B" the right answer about 70% of the time in the multiple-choice questions.
  - The models struggled with hydrology jargon and ambiguous terms such as "flow".
  - They were weak at numbers and spatial reasoning.
  - Results changed with the prompt wording.
  - Questions may have leaked into the models' training data.
  - There's no real-world validation.
- **Companion paper:** about 8,800 question-answer pairs, with models from 1.5B to 32B parameters fine-tuned using LoRA. The best was an 8B model, and the 32B model overfit. This is from a search summary only.
- **Lessons for AquaMa:**
  - Textbook knowledge is a recognised data type, which supports the glossary.
  - The models' weakness with numbers supports doing calculations in Python.
  - The ambiguous-term problem applies to Arabic water terms too.
- **Open resource:** [github.com/uihilab/HydroLLM-Benchmark](https://github.com/uihilab/HydroLLM-Benchmark), MIT. Usable for testing general hydrology knowledge, not Qatar knowledge.

## 5. LLM-EPANET
Goldshtein, Perelman, Schuster and Ostfeld (Technion). *Large Language Models for Water Distribution Systems Modeling and Decision-Making.* arXiv [2503.16191](https://arxiv.org/abs/2503.16191), EWRI Congress 2025. The paper is CC BY-NC-ND 4.0.

- **What it does:** multiple agents with RAG turn natural-language questions into code for EPANET, a water pipe network simulator, run it, and return structured results.
- **Evaluation:** 69 benchmark questions, scoring 56–81% depending on the model, and over 90% on simpler questions.
- **Lessons for AquaMa:** the gap between simple and complex questions is what our question types are meant to measure.
- **Open resource:** [github.com/yinon-gold/LLMs-in-WDS-Modeling](https://github.com/yinon-gold/LLMs-in-WDS-Modeling), MIT, with code and the benchmark questions.
- **Not read:** the full text. I only read the abstract page and checked the repository.

## 6. Paneru and Paneru
Paneru and Paneru. *AI for Water Sustainability: Global Water Quality Assessment and Prediction with Explainable AI with LLM Chatbot for Insights.* arXiv [2409.10898](https://arxiv.org/abs/2409.10898), 2024–2025.

- **Prediction:**
  - **Data:** the CCME water quality dataset, 2.82 million records from Canada, China, the UK, the USA and Ireland.
  - **Models:** CatBoost, XGBoost, Extra Trees, and a model combining CNN and LSTM layers.
  - **Reported results:** an RMSE of 1.2 and an R² of 0.99 for the water quality index, and 99% classification accuracy.
- **Chatbot:** RAG over one PDF of water quality and model information, using the OpenAI API. It has no evaluation of its own.
- **Limitations the authors state:** a fuller assessment needs chemical and microbiological analysis. Later work could add Internet of Things sensors, edge devices and real-time monitoring.
- **Lessons for AquaMa:** a thin chatbot built on top of a model. It's useful as an example of what we go beyond. Its near-perfect scores on a general global dataset also show why we report honest, unfiltered results.
- **Open resources:** none.

## 7. WaterGPT
Ren et al. *WaterGPT.* Water 16(21), 3075, 2024. [doi:10.3390/w16213075](https://doi.org/10.3390/w16213075).

- **Not opened:** MDPI returned 403. Everything below comes from search summaries.
- **What it is:** a hydrology model built by further training Qwen2 on hydrology text, with a multi-agent tool layer called Water_Agent.
- **Evaluation:** EvalWater, its authors' own benchmark: 21 categories, about 10,000 questions, and a reported 83.09%, about 17.8 points above GPT-4.
- **The base model is unclear:** one summary says Qwen2-7B, while WaterCopilot's paper says "Qwen2-2B", so check before citing.
- **Open resources:** none found.
- **Don't confuse it with** arXiv [2407.21045](https://arxiv.org/abs/2407.21045), a separate benchmark called WaterER (983 water engineering tasks, 7 models).

## 8. Nityandal, Iowa State thesis
Nityandal. *LLM and Digital Twin–Aided Decision Making for Water Governance.* MS thesis defence, Iowa State University, 15 April 2026. Advisor: Simanta Mitra. [Event page](https://www.cs.iastate.edu/event/2026/ms-final-oral-exam-ananth-nityandal).

- **What it does:**
  - an interface for running and comparing MODFLOW groundwater simulations
  - Bayesian optimisation to search simulation settings
  - a RAG pipeline answering regulatory and policy questions
  - natural-language input that fills in simulation settings
- **Lessons for AquaMa:** the closest subject: groundwater governance with regulatory questions and answers. Unlike AquaMa, it's built on simulation, not monitoring data.
- **Open resources:** none. Only the talk abstract is available.

---

## Open resources found
| Resource | Licence | Possible use in AquaMa |
|---|---|---|
| [HydroLLM-Benchmark](https://github.com/uihilab/HydroLLM-Benchmark) | MIT | Test general hydrology knowledge: Qwen 14B against 3B |
| [LLMs-in-WDS-Modeling](https://github.com/yinon-gold/LLMs-in-WDS-Modeling) | MIT | Example of an agent that writes and runs code, and a benchmark format |
| [CRAG benchmark](https://github.com/facebookresearch/CRAG), found earlier | Data CC BY-NC 4.0 | Test the question-type router |
| RAGAS, used by WaterCopilot | Not checked | Score faithfulness, answer relevancy, context precision and recall |
| `all-MiniLM-L6-v2`, used by Nakarmi et al. | Not checked | A fast embedding model to compare with `bge-m3`, though it's English-only |

## Further reading
- *The Arizona Water Chatbot*, Rajan, Carradini and Lauer, CHI 2024 Extended Abstracts. It's cited by WaterCopilot as a public-facing water chatbot. Not read.
- *Hydro-SE Bench*, arXiv [2512.03672](https://arxiv.org/abs/2512.03672): 4,000 multiple-choice questions, in Chinese. Not read.
