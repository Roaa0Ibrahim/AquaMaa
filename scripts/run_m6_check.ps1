# Milestone 5 confirmation and the first Milestone 6 check (13 Nov). Model jobs one after another. Needs Ollama.
#   1. eval_errors.py --live: all error routes (offline and live)
#   2. eval_simplify.py: 6 farmer questions, English and Arabic, before and after simplification
# Run from the project folder:  powershell -ExecutionPolicy Bypass -File scripts\run_m6_check.ps1
# Output: logs\m5_live_errors.txt, logs\m6_simplify.txt and logs\eval_simplify.json

$python = ".venv\Scripts\python.exe"
New-Item -ItemType Directory -Force logs | Out-Null
$env:PYTHONIOENCODING = "utf-8"

& $python eval_errors.py --live 2>&1 | Out-File -Encoding utf8 logs\m5_live_errors.txt
& $python eval_simplify.py 2>&1 | Out-File -Encoding utf8 logs\m6_simplify.txt
