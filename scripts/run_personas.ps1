# Realistic farmer and officer questions, with every step and its time logged (13 Nov). Needs Ollama.
# Stop api.py first, so nothing else uses the model.
# Run from the project folder:  powershell -ExecutionPolicy Bypass -File scripts\run_personas.ps1
# Output: logs\personas.txt (full log: each step with its time, and each answer), logs\eval_personas.json

$python = ".venv\Scripts\python.exe"
New-Item -ItemType Directory -Force logs | Out-Null
$env:PYTHONIOENCODING = "utf-8"

& $python eval_personas.py 2>&1 | Out-File -Encoding utf8 logs\personas.txt
