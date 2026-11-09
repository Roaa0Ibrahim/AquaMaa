# AquaMaa assistant

The AI assistant behind AquaMaa, team AquaNova's groundwater decision-support platform for Qatar (UDST Smart WaterBot Challenge 2026). It answers questions about Qatar's groundwater from a curated knowledge base, and runs entirely on a local open model.

The plan and the progress on each milestone are in [AquaMaa.md](AquaMaa.md).

## What you need
- **Windows 10 or 11,** with about 15 GB free disk space and an internet connection for the downloads
- **16 GB of RAM or more.** A GPU with 12 GB or more makes answers much faster. Without one, use the smaller model (see step 5)

## Set up from scratch
Do these once, in order. Nothing here is assumed to be installed already.

**1. Install Git** from [git-scm.com/download/win](https://git-scm.com/download/win), keeping the default options.

**2. Install Python 3.13** from [python.org/downloads](https://www.python.org/downloads/). Choose a 3.13 version, not 3.14, which is too new for some packages.
On the first installer screen, **tick "Add python.exe to PATH"**. Then check in a new PowerShell window:
```powershell
py -3.13 --version
```
It should print `Python 3.13.x`. If it prints an error, rerun the installer and choose "Modify", then tick "py launcher".

**3. Install Ollama** from [ollama.com/download](https://ollama.com/download), then open the Ollama app once. It keeps running in the background and starts with Windows.

**4. Get the code.** The repository is private, so ask Roaa to add you as a collaborator, and accept the email invitation. Then:
```powershell
cd $HOME\Documents
git clone https://github.com/Roaa0Ibrahim/AquaMaa.git
cd AquaMaa
```

**5. Download the two AI models,** about 10 GB in total:
```powershell
ollama pull qwen3:14b
ollama pull bge-m3
```
- **If `ollama` isn't recognised,** close and reopen PowerShell, or use the full path: `& "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe" pull qwen3:14b`
- **On a laptop without a 12 GB GPU,** also download the smaller model with `ollama pull qwen3:8b`, and use it as shown in "Run it". It's faster but a little less accurate.

**6. Create the project's Python environment and install the packages:**
```powershell
py -3.13 -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```
- **If PowerShell blocks `Activate.ps1`,** run `Set-ExecutionPolicy -Scope Process Bypass` first. It only affects that window.
- After activating, the prompt starts with `(.venv)`. Run `(Get-Command python).Source`: it must end in `.venv\Scripts\python.exe`. If it shows another Python (for example MSYS2 or Anaconda), use `.venv\Scripts\python.exe` instead of `python` in every command.

**7. Build the knowledge base,** about 1 minute:
```powershell
python build_kb.py
```

**8. Check everything:**
```powershell
python check_setup.py
```
It checks Python, the packages, Ollama, the two models and the knowledge base, and for anything missing, prints exactly how to fix it. When it says "Everything is ready", the setup is done.

To get later changes from the team, run `git pull` in the folder, then `python build_kb.py` again if `database/` changed.

## Run it
Every time you open a new PowerShell window, go to the folder and activate the environment first:
```powershell
cd $HOME\Documents\AquaMaa
.venv\Scripts\Activate.ps1
```

**Ask the agent a question,** and watch each step it takes:
```powershell
python agent.py "How much rain recharges Qatar's aquifers each year?"
```
To use the smaller model, set it for that window first: `$env:AQUAMAA_MODEL = "qwen3:8b"`. The model names live in `config.py`.

| Step | Command | What it does | Time |
|---|---|---|---|
| Check the setup | `python check_setup.py` | Checks everything is installed and running | Seconds |
| Ask the agent | `python agent.py "question"` | Milestone 4: the agent answers, with live logs of each step | 10–20 seconds |
| Run a question set | `python eval_agent.py tests/dev_real_questions.csv` | Runs 30 real questions through the agent and saves every answer in `runs/` | About 10 minutes |
| See a run | `python show_run.py` | Lists the latest run's answers with their checks | Seconds |
| 1. Build the knowledge base | `python build_kb.py` | Reads `database/`, cleans and splits every document, and saves the searchable store (`vector_store.json` and `chunks.jsonl`) | About 1 minute |
| 2. Check the knowledge base | `python eval_kb.py` | Milestone 2 check: 10 questions, one in Arabic. Each should find its right file | About 30 seconds |
| 3. Compare search methods | `python compare_retrieval.py` | Compares keyword, meaning and hybrid search, and tries the table lookup | About 30 seconds |
| 4. Check routing and retrieval | `python eval_routing.py` | Milestone 3 check: 27 questions, 3 per question type. Saves `eval_routing_v3.json` | About 2 minutes |
| 5. Try the router | `python routing.py` | Shows the question type and search methods chosen for 10 sample questions | About 30 seconds |

**Run step 1 first.** The other steps need the files it creates. Those files aren't in Git, because they're large and rebuild from `database/` in about a minute. Run step 1 again whenever `database/` changes.

To save a script's output to a file without broken characters, run this first in the same window:
```powershell
[Console]::OutputEncoding = [Text.Encoding]::UTF8
python eval_routing.py > results.txt
```

## What's in this folder
| Path | What it is |
|---|---|
| `AquaMaa.md` | The plan: milestones, decisions, problem statement, key facts |
| `database/` | The knowledge base sources: 46 sources in 10 folders, catalogued in `database/sources.json`. Read `database/README.md` before reusing any data |
| `check_setup.py` | Checks the setup and says how to fix anything missing |
| `config.py` | The model names, in one place |
| `agent.py` | The agent: connects the steps into one graph, and runs it with `ask()` |
| `steps/` | The graph's steps, one file per stage: `route.py`, `figures.py` (key statistics), `react.py` (the ReAct loop), `verify.py` (checks, repair, conflict notes) |
| `tools.py`, `key_stats.py`, `verifier.py` | The logic behind the steps: the agent's tools, choosing key statistics, and the answer checks (Milestones 4 and 5) |
| `prompts.py`, `state.py`, `agent_log.py` | Every prompt in one place, the graph's state, and the live logs |
| `database/11-key-statistics/`, `database/12-known-conflicts/` | The 20 verified headline figures, and the known disagreements between sources |
| `eval_agent.py`, `checks.py`, `show_run.py` | Run a question set through the agent, check the answers, and list a run |
| `tests/dev_real_questions.csv` | 30 real development questions, with sources |
| `requirements.txt` | The packages the code needs. `requirements-full.txt` lists everything on the build laptop |
| `build_kb.py` | Builds the knowledge base (Milestone 2) |
| `retrieval.py` | The search methods: keyword (BM25), meaning (vector), hybrid, and exact table lookup (Milestone 3) |
| `routing.py` | Labels each question's type, then picks the search methods for it (Milestone 3) |
| `eval_kb.py`, `eval_routing.py`, `compare_retrieval.py` | The checks for Milestones 2 and 3 |
| `eval_kb_v2.txt`, `eval_routing_v3.txt`, `eval_routing_v3.json` | Saved check results |
| `agentic_rag.py`, `run_v1*.txt`, `agent.log` | Milestone 1: the LangGraph tutorial on local Qwen, with its results |
| `similar-projects.md` | Review of eight similar projects |
| `context/` | Background material: research notes, sources, datasets and documents |

## Results so far
| Milestone | Version | Result |
|---|---|---|
| 1. Open-source code on Qwen | `v1` | LangGraph agentic RAG tutorial running locally, with three of its faults fixed |
| 2. Knowledge base | `v2` | 1,406 chunks from 34 text sources. All 10 test questions find their right file in the top 10, and 9 in the top 3 |
| 3. Routing and retrieval | `v3` | Question type right for 26 of 27. Right file in the top 3 for 26 of 27. Context recall 0.96, context precision 0.83. Baseline faithfulness 0.854 |
| 4. Agent loop | in progress | On 30 real questions, invented citations fell from 7 to 0 between prompt v1 and v2 |

To see the code exactly as it was at a version, run `git checkout v2`, for example. Run `git checkout main` to return.

## When something goes wrong
| Message | Cause | Fix |
|---|---|---|
| `ModuleNotFoundError: No module named ...` | The environment isn't active, or a different Python is running | Activate it with `.venv\Scripts\Activate.ps1`, or use `.venv\Scripts\python.exe` instead of `python` |
| `can't open file ... No such file or directory` | You're in the wrong folder | `cd` into the `AquaMaa` folder first |
| `Connection refused` or `httpx.ConnectError` | Ollama isn't running | Open the Ollama app |
| `model "..." not found` | That model isn't downloaded | `ollama pull <model name>` |
| `The knowledge base hasn't been built yet` | `vector_store.json` is missing (it isn't in Git) | `python build_kb.py` |
| Answers take over a minute | The model is running on the CPU | Use the smaller model: `$env:AQUAMAA_MODEL = "qwen3:8b"` |
| Broken characters like `ΓÇö` in a saved file | PowerShell's file encoding | Run `[Console]::OutputEncoding = [Text.Encoding]::UTF8` before saving output |

If it's still not working, run `python check_setup.py` and send Roaa what it prints.

## Known issues
- **Chroma doesn't run on these laptops.** Windows Application Control blocks one of its DLLs, so the knowledge base uses LangChain's built-in vector store instead.
- **The first question after starting is slow,** about 5–10 seconds, while Ollama loads the model.

## Data use
Some of the data in `database/` has **no open licence**: the 201-well survey files from the Qatar_MWDVF repository, originally from Shomar and Sankaran (2024). They're for private team use only, and must be cited. Each source's licence is listed in `database/sources.json`. **Don't make this repository public** without first removing those files.
