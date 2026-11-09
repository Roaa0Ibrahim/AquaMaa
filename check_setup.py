"""Checks that everything AquaMaa needs is installed and running, and says how to fix anything that isn't.

Run it first, from this folder, with the environment active:
    python check_setup.py
It only reads and tests: it doesn't install or change anything.
"""
import importlib.metadata
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).parent
problems = []


def ok(message):
    print(f"  OK    {message}")


def fail(message, fix):
    print(f"  FIX   {message}\n        -> {fix}")
    problems.append(message)


print("\n1. Python")
v = sys.version_info
if (3, 10) <= (v.major, v.minor) <= (3, 13):
    ok(f"Python {v.major}.{v.minor}.{v.micro}")
else:
    fail(f"Python {v.major}.{v.minor} (needs 3.10 to 3.13; 3.13 recommended)",
         "Install Python 3.13 from https://www.python.org/downloads/ and tick 'Add python.exe to PATH', "
         "then create the environment again: py -3.13 -m venv .venv")
if sys.prefix == sys.base_prefix:
    fail("Not running inside the project's environment (.venv)",
         r"Run .venv\Scripts\Activate.ps1 first, or run this file with .venv\Scripts\python.exe check_setup.py")
else:
    ok(f"Inside an environment: {sys.prefix}")

print("\n2. Python packages")
wanted = [line.split("==")[0].strip() for line in (ROOT / "requirements.txt").read_text(encoding="utf-8").splitlines()
          if line.strip() and not line.startswith("#")]
missing = []
for name in wanted:
    try:
        ok(f"{name} {importlib.metadata.version(name)}")
    except importlib.metadata.PackageNotFoundError:
        missing.append(name)
if missing:
    fail(f"Missing packages: {', '.join(missing)}", "python -m pip install -r requirements.txt")

print("\n3. Ollama (runs the AI models on this computer)")
try:
    sys.path.insert(0, str(ROOT))
    from config import CHAT_MODEL, EMBED_MODEL, OLLAMA_URL
except ImportError:
    CHAT_MODEL, EMBED_MODEL, OLLAMA_URL = "qwen3:14b", "bge-m3", "http://127.0.0.1:11434"
models = None
try:
    with urllib.request.urlopen(f"{OLLAMA_URL}/api/tags", timeout=5) as r:
        models = [m["name"] for m in json.load(r)["models"]]
    ok(f"Ollama is running at {OLLAMA_URL}")
except (urllib.error.URLError, OSError):
    fail("Ollama isn't running, or isn't installed",
         "Install it from https://ollama.com/download, then open the Ollama app once so it runs in the background")

if models is not None:
    for name, purpose in ((CHAT_MODEL, "answers"), (EMBED_MODEL, "search")):
        if any(m == name or m == f"{name}:latest" for m in models):
            ok(f"Model {name} ({purpose})")
        else:
            fail(f"Model {name} ({purpose}) isn't downloaded",
                 f"ollama pull {name}   (if 'ollama' isn't recognised: "
                 rf'& "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe" pull {name})')

print("\n4. Knowledge base")
if (ROOT / "database" / "sources.json").exists():
    ok("database/ is present")
else:
    fail("database/ is missing", "Get the latest code: git pull")
if (ROOT / "vector_store.json").exists() and (ROOT / "chunks.jsonl").exists():
    ok("Knowledge base is built (vector_store.json, chunks.jsonl)")
else:
    fail("Knowledge base isn't built yet (it isn't stored in Git)", "python build_kb.py   (about 1 minute, needs Ollama)")

print("\n5. A quick live test")
if models is not None and not problems:
    try:
        from langchain_ollama import OllamaEmbeddings
        vector = OllamaEmbeddings(model=EMBED_MODEL).embed_query("groundwater")
        ok(f"{EMBED_MODEL} works ({len(vector)} numbers per text)")
    except Exception as error:   # report any failure in plain words
        fail(f"{EMBED_MODEL} didn't respond: {error}", "Restart the Ollama app, then run this check again")
else:
    print("  SKIP  fix the items above first")

print()
if problems:
    print(f"{len(problems)} thing(s) to fix. Fix them in order, then run python check_setup.py again.")
else:
    print("Everything is ready. Try: python agent.py \"How much rain recharges Qatar's aquifers each year?\"")
