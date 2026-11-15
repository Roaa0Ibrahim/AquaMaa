# Fast-path questions for farmers and officers, English and Arabic, with every step and its time (13 Nov).
# Stop api.py first, so nothing else uses the model.
# Run from the project folder:  powershell -ExecutionPolicy Bypass -File scripts\run_fast.ps1
# Output: logs\fast.txt (log and answers), logs\eval_fast_questions.json

$python = ".venv\Scripts\python.exe"
New-Item -ItemType Directory -Force logs | Out-Null
$env:PYTHONIOENCODING = "utf-8"

& $python eval_personas.py tests\fast_questions.csv 2>&1 | Out-File -Encoding utf8 logs\fast.txt
