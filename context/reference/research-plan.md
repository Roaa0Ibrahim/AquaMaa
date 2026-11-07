# AquaMa research plan (draft for Roaa to decide)

Drafted 4 November 2026. Nothing here is agreed yet.

## Research question
Can a verifier-gated, hypothesis-testing agent tell real groundwater change from unreliable evidence, and abstain when it can't? Does the LLM add measurable value over the verifier alone?

## Prior work we build on

| Work | What we take | Access | Checked |
|---|---|---|---|
| Tsegay and Peleato, [LLM-hydraulic-diagnosis](https://github.com/Biniam150/LLM-hydraulic-diagnosis) | The method: the LLM requests one hypothesis test at a time, and deterministic tests decide. Also the outcome set, including ambiguous, unknown and no-fault | Public code and saved results. **No licence file**, so cite and reimplement, don't copy. Manuscript venue not confirmed | Code and saved results read. Their code not run |
| [AgentAbstain](https://github.com/AntiQuality/agentabstain) (arXiv 2607.10059) | Paired act and abstain tasks, and paired accuracy as the metric | MIT code, CC-BY-4.0 [data](https://huggingface.co/datasets/antiquality/agentabstain) | README, leaderboard, dataset card read. Not run |
| Ma et al. 2026, Water Research 299, 125886, "Autonomous inverse modeling of complex groundwater systems via a physics-integrated LLM multi-agent framework" | Closest groundwater work, to position against | Paper page blocked. Code reported on GitHub, not located | Bibliographic details only. **Must read** |
| [Fisher-R1 / P-Bench](https://huggingface.co/papers/2608.07437.md) | How an agent should inspect data, check assumptions, then test | Release links not found | Summary read |
| [HydroAgent](https://chrimerss.github.io/HydroAgent/static/pdfs/paper.pdf) | Reported domain grounding gap in frontier agents | Paper and model | Search summary only |
| [Archer et al. 2003](https://papers.neurips.cc/paper_files/paper/2003/hash/30aaf34d6afd4b11cc3b3ac4704c7908-Abstract.html) | Salinity alone can't separate real decline from early bio-fouling | Paper | Search summary only |

## What the Tsegay and Peleato results show
From their saved result files. Their 60 cases are synthetic, on pipe networks.

| Approach | Exact-outcome accuracy |
|---|---|
| LLM alone (rows read) | 11% to 48% |
| Classical, Anytown (rows read) | Up to 56% (random forest) |
| Deterministic verifier | 72% Anytown, 62% Net3, 76% BWN-II |

- The verifier's accepted diagnoses had 100% precision and 0% false attribution on these cases.
- LLM search order did not raise accuracy. On Anytown all five models scored 72.2%.
- LLM order saved simulations: about 16 to 32% on Anytown and 7% on Net3 (rows read).
- Their own caution: finite synthetic results don't guarantee precision in real networks.

## Proposed contribution
1. **Method transfer:** bring verifier-gated diagnosis from pipe networks, which have a hydraulic simulator, to sparse groundwater monitoring, which has no calibrated simulator. This needs new deterministic tests.
2. **Benchmark:** paired groundwater cases, with faults injected into real measurements and real conflicts in official figures.
3. **Ablation:** measure what the LLM adds, rather than assume it helps.

## Hypothesis families
Real salinity change, stuck sensor, drift, calibration offset, spike or fouling, evidence conflict, no fault, unknown cause.

## Candidate deterministic tests
Change-point and persistence tests, neighbor comparison, ion charge balance, and source version and comparability checks.

Warning: in Mais's dataset TDS = EC/2, so TDS is derived. An EC against TDS check tells us nothing there.

## Baselines
1. Plain RAG
2. Current fixed pipeline in `agent/aquama/`
3. Standard ReAct agent
4. Verifier with fixed test order, no LLM
5. Classical classifier
6. Proposed agent, built in LangGraph

Run across several open models, with repeated seeds.

## Metrics
Paired accuracy, over-answer rate, accepted-diagnosis precision, false attribution, unknown-cause recall, number of tests used, latency, tokens.

## Reproduction levels
- **R0:** read saved results and compare with the README. Done for the three verifier accuracies.
- **R1:** run their validation, summary and test scripts. Needs Roaa's approval.
- **R2:** rerun one network with a local model.

## Risks
- Real measurements are thin: one year, 201 rows, no time series. Temporal faults would be injected into simulated series unless real series are found.
- The Qatar_MWDVF data has no open licence. Use with credit needs a decision.
- No field-verified sensor faults yet. Munira's hardware could supply real ones.
- Novelty isn't confirmed until the related-work review, including Ma et al., is complete.
