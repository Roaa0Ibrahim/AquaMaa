#!/bin/bash
# Stops the website and AquaMaa started by start_demo_mac.sh.   bash scripts/stop_demo_mac.sh
for port in 3000 8000; do lsof -ti tcp:$port | xargs kill 2>/dev/null; done
echo "The website and AquaMaa are stopped."
