# Checks the re-read layer (agent.ask: a question that seems out of scope is re-read once as a relevant one),
# then the regression. Model jobs one after another. Stop api.py first.
# Run from the project folder:  powershell -ExecutionPolicy Bypass -File scripts\run_reread.ps1
# Output: logs\reread.txt, then logs\fast.txt and logs\arabic.txt (from run_regression.ps1)

$python = ".venv\Scripts\python.exe"
$env:PYTHONIOENCODING = "utf-8"
& $python -m py_compile agent.py guess.py
if (-not $?) { "Compile failed"; exit 1 }
& $python eval_personas.py tests\reread_questions.csv 2>&1 | Out-File -Encoding utf8 logs\reread.txt
"===== logs\reread.txt"
Select-String -Path logs\reread.txt -Encoding utf8 -Pattern '^farmer:|^officer:|REREAD|GUESS|understood|I understood|outside' | ForEach-Object { $_.Line }
& powershell -ExecutionPolicy Bypass -File scripts\run_regression.ps1
