#!/bin/bash
# One-time setup of AquaMaa (the AI) on a Mac, so it runs there instead of Roaa's laptop (14 Nov, for Deema).
# Needs internet (it downloads the AI models, a few GB): run it the evening before.
#   1. checks Python 3 and Ollama are installed
#   2. creates the Python environment (.venv) and installs AquaMaa's packages
#   3. picks the AI model size from this Mac's memory and downloads the models
#   4. checks the knowledge base files and the .env file from the setup kit are in place
# Run from the AquaMaa code folder (the milestone-6 branch):   bash scripts/setup_mac.sh
set -u
cd "$(dirname "$0")/.."
ok()  { printf "   \033[32mOK\033[0m  %s\n" "$1"; }
bad() { printf "   \033[33m!!\033[0m  %s\n" "$1"; }

echo "== 1. Python and Ollama"
PY=$(command -v python3.13 || command -v python3)
if [ -z "$PY" ]; then bad "Python 3 not found: install it from https://www.python.org/downloads/ (3.13), then run this again"; exit 1; fi
ok "Python: $($PY --version)"
if ! command -v ollama >/dev/null; then
  bad "Ollama not found: install it from https://ollama.com/download (Mac), open it once, then run this again"; exit 1
fi
ok "Ollama installed"
curl -s http://127.0.0.1:11434/api/tags >/dev/null || { open -a Ollama 2>/dev/null || (ollama serve >/dev/null 2>&1 &); sleep 5; }

echo "== 2. Python packages"
[ -d .venv ] || "$PY" -m venv .venv
.venv/bin/python -m pip install --quiet --upgrade pip
.venv/bin/python -m pip install --quiet -r requirements.txt && ok "packages installed" || { bad "package install failed (see above)"; exit 1; }

echo "== 3. AI models"
GB=$(( $(sysctl -n hw.memsize) / 1073741824 ))
if   [ "$GB" -ge 32 ]; then MODEL="qwen3:14b"
elif [ "$GB" -ge 16 ]; then MODEL="qwen3:8b"
else MODEL="qwen3:4b"; fi
ok "this Mac has ${GB} GB of memory: using $MODEL for the answers"
for m in "$MODEL" bge-m3 qwen2.5:3b; do
  echo "   downloading $m (once; can take a while)"
  ollama pull "$m" || { bad "could not download $m"; exit 1; }
done
# Remember the model choice (config.py reads .env)
touch .env
grep -q '^AQUAMAA_MODEL=' .env && sed -i '' "s/^AQUAMAA_MODEL=.*/AQUAMAA_MODEL=$MODEL/" .env || echo "AQUAMAA_MODEL=$MODEL" >> .env
ok "model saved in .env"

echo "== 4. Files from the setup kit"
for f in vector_store.json chunks.jsonl; do
  [ -s "$f" ] && ok "$f" || bad "$f missing: copy it from the setup kit into $(pwd)"
done
grep -q '^FANAR_API_KEY=' .env && ok "Fanar key in .env" || bad "no Fanar key in .env: copy the kit's .env lines in (Arabic dialect works without it, a little less well)"

echo ""
echo "Setup done. To start the demo:  bash scripts/start_demo_mac.sh"
