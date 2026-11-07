# AquaMa agent design

Agreed with Roaa on 4 November 2026. Working design that we can change together.

## Decisions
- LangGraph for orchestration, with Pydantic models for the data passed between components
- Open model: Ollama for development, a hosted open model for the demo
- Five knowledge paths: live data, rules, facts registry, goals table, document search
- Hybrid search in Postgres: full-text search plus pgvector
- English for the demo, Arabic later
- Read-only tools, no free-form SQL
- Roaa owns the agent and the suitability engine
- Built in small explained steps, because the team must be able to explain all code

## Place in AquaMa
Sources -> ingestion -> data layer -> analytics and rules -> **agent** -> backend API -> website and robot.

The agent writes only to its audit log. The required chain must keep working if the agent fails, and `/robot/say` stays a direct route to live values.

## Pipeline 1: knowledge preparation (offline)
1. Document processor: text, scans, chunks by section with page numbers
2. Fact extractor: proposes registry facts for human review
3. Conflict register: superseded figures and disagreements
4. Indexer: keyword and vector indexes with metadata

## Pipeline 2: answering (live)
| Stage | Components |
|---|---|
| Understand | 5 Access gateway, 6 Query analyzer, 7 Scope guard, 8 Lane router |
| Plan | 9 Planner with a role-permission check |
| Gather (parallel) | 10a Observation analyst, 10b Suitability analyst, 10c Knowledge retriever, 10d Context analyst |
| Judge | 11 Evidence ledger, 12 Conflict resolver, 13 Confidence scorer, 14 Sufficiency gate |
| Answer | 15 Role composer, 16 Two-layer verifier |

LLM components: 6, 7 (part), 9, 10c, 15, and the critic in 16. Everything else is code.

## Lanes
- Fast: direct tool result, no LLM
- Standard: one station and one use, one evidence pass
- Deep: full plan with up to two extra evidence passes

## Tools
`get_latest`, `get_history`, `compare_stations`, `get_alerts`, `get_suitability`, `what_if`, `get_facts`, `get_policy_goals`, `search_documents`

## Facts registry fields
`fact`, `value`, `unit`, `period`, `status` (measured, estimated, modeled, proposed, target), `source_id`, `page`, `superseded`, `conflict_note`

## Decision brief
Finding, drivers, comparison, uncertainty, evidence and related goals. Next steps appear only when asked for.

## Dashboard first
The dashboard never waits for a question. It shows charts and short insights as soon as it opens. A question is only for a more specialized answer.

- **Always on:** code turns current data into panels and insights. It doesn't need an LLM, so the dashboard still works if the agent fails.
- **On question:** the live pipeline runs and returns a deeper answer.
- **Decision brief:** analysis comes first: finding, drivers, comparison and uncertainty. Next steps appear only when asked for.

## User categories and view versions
The same information has several versions. Two settings choose what a person sees:
- **Institution:** Kahramaa, Municipality, MECC (the topics)
- **Category:** executive, technical, operational (the depth)

Each chart is built once. A settings file lists which panels and which version each combination sees.

## Two answers
Every answer has two versions built from the same evidence:
- `web_answer`: full answer for the website and phone
- `robot_speech`: short plain text for text-to-speech, up to 300 characters

## QR explainer
A visitor scans a QR code on the dashboard with a phone. The phone guide is linked to that view, and the visitor taps a question. The agent explains the view from its live data, the phone shows text, and the robot speaks and gestures.

Additions: view context per chart, short-lived view-only QR session, phone guide, `explain_view` intent, robot queue. Start with three or four charts. A public QR opens a limited demo role.

## Build tiers for the 5 Nov freeze
- Full quality: 5, 8, 10a, 10b, 10d, 11, 12, 13, 14, code verifier
- Simple version: 6, 7, 9, 10c, 15
- After the challenge: LLM critic, automated fact extraction

## Evaluation
Retrieval, numeric accuracy, abstention, conflict handling, role limits, injection resistance.

## Rules found in testing
- The LLM never chooses severity words. The rules engine supplies labels, and the verifier rejects anything else, such as "high salinity" or "safe level".
- `insufficient_data` means "we cannot tell yet". The verifier rejects "cannot be used".
- Reading real answers matters: tool and status checks passed while wording was still wrong.

## Built so far (4 Nov 2026)
`agent/aquama/`: `logic.py` (rules and flags), `tools.py` (six of the nine tools), `verifier.py`, `graph.py` (plan, gather, judge, compose, verify, fallback), `api.py` (`POST /agent/ask` and the demo page). Not built yet: `search_documents`, `what_if`, `get_alerts`, login, hosted model.
