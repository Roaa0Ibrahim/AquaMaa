# Milestone 5 check after prompt v3.3 and the two new verifier checks (9 Nov).
#   1. eval_errors.py: the 5 offline verifier tests must still pass (no model)
#   2. tests\m5_regression.csv: the website questions that failed, one after another on the model
#   3. eval_dashboard.py: Milestone 8 still holds (needs the dashboard running)
# Questions are read from the UTF-8 file, never passed on the command line: Windows PowerShell garbles Arabic arguments.
# Run from the project folder:  powershell -ExecutionPolicy Bypass -File scripts\run_m5_wells.ps1
# Output: logs\m5_errors.txt and logs\m5_regression.txt; answers in runs\agent_<time>.json

$python = ".venv\Scripts\python.exe"
New-Item -ItemType Directory -Force logs | Out-Null
$env:PYTHONIOENCODING = "utf-8"

& $python eval_errors.py 2>&1 | Out-File -Encoding utf8 logs\m5_errors.txt
& $python eval_agent.py tests\m5_regression.csv 2>&1 | Out-File -Encoding utf8 logs\m5_regression.txt
& $python show_run.py 2>&1 | Out-File -Encoding utf8 -Append logs\m5_regression.txt
# Milestone 8 must still hold: the search-first guard touches every question
& $python eval_dashboard.py 2>&1 | Out-File -Encoding utf8 logs\m5_dashboard.txt
