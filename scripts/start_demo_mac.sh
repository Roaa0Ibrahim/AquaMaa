#!/bin/bash
# One command to start everything for the demo on a Mac (14 Nov, for Deema's laptop).
#   1. Wi-Fi: this Mac's address on Pepper's network
#   2. the AI model (Ollama)
#   3. stops old copies of the website and AquaMaa
#   4. starts the website (dashboard) at http://localhost:3000
#   5. starts AquaMaa (the AI) for the website AND for Pepper
#   6. asks one question so the model is loaded, then opens the website
# Run from the AquaMaa code folder:   bash scripts/start_demo_mac.sh
# The website's folder: DASHBOARD_DIR (default: ../aquamaa-dashboard), e.g.
#   DASHBOARD_DIR=~/Documents/AquaMaa-website bash scripts/start_demo_mac.sh
# Logs: logs/api_demo.log and logs/dashboard_demo.log. Stop with:  bash scripts/stop_demo_mac.sh
set -u
cd "$(dirname "$0")/.."
AGENT_DIR=$(pwd)
DASHBOARD_DIR=${DASHBOARD_DIR:-"$AGENT_DIR/../aquamaa-dashboard"}
mkdir -p logs
ok()  { printf "   \033[32mOK\033[0m  %s\n" "$1"; }
bad() { printf "   \033[33m!!\033[0m  %s\n" "$1"; }
answers() { for _ in $(seq 1 "$2"); do curl -s -m 3 -o /dev/null "$1" && return 0; sleep 2; done; return 1; }

echo "== 1. Wi-Fi"
IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)
case "$IP" in
  192.168.8.*) ok "on Pepper's network: this Mac is $IP";;
  *) bad "this Mac is '${IP:-offline}', not on Pepper's Wi-Fi (192.168.8.x): the website works here, but Pepper can't reach it";;
esac

echo "== 2. The AI model (Ollama)"
if ! answers http://127.0.0.1:11434/api/tags 1; then
  open -a Ollama 2>/dev/null || (ollama serve >/dev/null 2>&1 &)
  answers http://127.0.0.1:11434/api/tags 20 && ok "Ollama started" || { bad "Ollama didn't start: open the Ollama app, then run this again"; exit 1; }
else ok "Ollama is running"; fi

echo "== 3. Stopping old copies"
for port in 3000 8000; do lsof -ti tcp:$port | xargs kill 2>/dev/null; done
sleep 1; ok "ports 3000 and 8000 are free"

echo "== 4. The website ($DASHBOARD_DIR)"
if [ ! -f "$DASHBOARD_DIR/server/index.js" ]; then bad "no website found there: set DASHBOARD_DIR to the website's folder"; exit 1; fi
( cd "$DASHBOARD_DIR" && npm install --no-audit --no-fund >/dev/null 2>&1; npm run seed >/dev/null 2>&1
  nohup node server/index.js > "$AGENT_DIR/logs/dashboard_demo.log" 2>&1 & )
answers http://localhost:3000/api/auth/demo-accounts 40 && ok "website running at http://localhost:3000" \
  || bad "the website didn't start: see logs/dashboard_demo.log"

echo "== 5. AquaMaa (for the website and Pepper)"
AQUAMAA_API_HOST=0.0.0.0 nohup .venv/bin/python api.py > logs/api_demo.log 2>&1 &
answers http://127.0.0.1:8000/health 60 && ok "AquaMaa running (if macOS asks to allow incoming connections for Python, click Allow)" \
  || { bad "AquaMaa didn't start: see logs/api_demo.log"; exit 1; }

echo "== 6. Loading the AI model (about 30-60 s, once)"
curl -s -m 300 -X POST http://127.0.0.1:8000/ask -H 'Content-Type: application/json' \
  -d '{"question": "What is the salinity now?", "role": "officer", "live": true}' | head -c 160; echo

echo "== 7. Ready"
[ -n "${IP:-}" ] && ok "Pepper: ADB OFF on the tablet, open the AquaMaa app (it finds this Mac at $IP by itself)"
[ -n "${IP:-}" ] && ok "phones on Pepper's Wi-Fi: http://$IP:3000"
ok "officer@aquamaa.demo / farmer@aquamaa.demo, password AquaMaa-Demo-2026"
open http://localhost:3000
printf "\n   \033[32mREADY.\033[0m Leave this Mac on, on Pepper's Wi-Fi. Stop later with: bash scripts/stop_demo_mac.sh\n"
