# AquaMaa assistant

The AI assistant behind AquaMaa, team AquaNova's groundwater decision-support platform for Qatar (UDST Smart WaterBot Challenge 2026). It answers questions about Qatar's groundwater from a curated knowledge base, and runs entirely on a local open model.

The plan and the progress on each milestone are in [AquaMaa.md](AquaMaa.md).

## What you need
- **Windows 10 or 11,** with about 15 GB free disk space
- **Python 3.13.** Python 3.14 is too new for some of the packages
- **[Ollama](https://ollama.com/download),** which runs the AI models on your own computer
- **A GPU with 12 GB or more is recommended.** The main model, `qwen3:14b`, is about 9 GB, and it runs slowly on a CPU alone

## Get the code
The repository is private, so ask Roaa to add you as a collaborator, then accept the email invitation.

```powershell
git clone https://github.com/Roaa0Ibrahim/AquaMaa.git
cd AquaMaa
```
After that, run `git pull` inside the folder to get the latest changes.

## Set up, once
Open PowerShell in this folder, then run:

```powershell
# 1. Download the two models (about 10 GB in total)
ollama pull qwen3:14b
ollama pull bge-m3

# 2. Create a private Python environment and install the packages
py -3.13 -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

- **If `ollama` isn't recognised,** use the full path instead: `& "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe" pull qwen3:14b`
- **If `py -3.13` isn't found,** use the full path to your Python 3.13 instead, for example `C:\Users\<you>\anaconda3\python.exe -m venv .venv`
- **If PowerShell blocks `Activate.ps1`,** run `Set-ExecutionPolicy -Scope Process Bypass` first. It only affects that window.

## Run it
Every time you open a new PowerShell window, activate the environment first with `.venv\Scripts\Activate.ps1`. Ollama must be running too; it starts automatically after installation.

| Step | Command | What it does | Time |
|---|---|---|---|
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
| 3. Routing and retrieval | in progress | Question type right for 26 of 27. Right file in the top 3 for 26 of 27. Context recall 0.96, context precision 0.83 |

To see the code exactly as it was at a version, run `git checkout v2`, for example. Run `git checkout main` to return.

## Known issues
- **Chroma doesn't run on these laptops.** Windows Application Control blocks one of its DLLs, so the knowledge base uses LangChain's built-in vector store instead. Chroma is still listed in `requirements.txt` but isn't used.
- **The first question after starting is slow,** about 5–10 seconds, while Ollama loads the model.

## Data use
Some of the data in `database/` has **no open licence**: the 201-well survey files from the Qatar_MWDVF repository, originally from Shomar and Sankaran (2024). They're for private team use only, and must be cited. Each source's licence is listed in `database/sources.json`. **Don't make this repository public** without first removing those files.
