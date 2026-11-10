# Checks to close Milestone 5 (9 Nov). Model jobs run one after another, never in parallel. Needs Ollama and the dashboard.
#   1. eval_errors.py --live: the 7 offline tests plus model down, a failed tool and missing evidence
#   2. tests\m5_regression.csv: the website wells questions
#   3. eval_dashboard.py: Milestone 8 still holds
# Run from the project folder:  powershell -ExecutionPolicy Bypass -File scripts\run_m5_close.ps1
# Output: logs\m5_live_errors.txt, logs\m5_regression.txt, logs\m5_dashboard.txt; answers in runs\

$python = ".venv\Scripts\python.exe"
New-Item -ItemType Directory -Force logs | Out-Null
$env:PYTHONIOENCODING = "utf-8"

& $python eval_errors.py --live 2>&1 | Out-File -Encoding utf8 logs\m5_live_errors.txt
& $python eval_agent.py tests\m5_regression.csv 2>&1 | Out-File -Encoding utf8 logs\m5_regression.txt
& $python eval_dashboard.py 2>&1 | Out-File -Encoding utf8 logs\m5_dashboard.txt
