# Regression after changes to the question layers (guessing, dialect) and the fast path. Model jobs one after another.
#   tests\fast_questions.csv (12 farmer and officer questions) and tests\arabic_questions.csv (7 Arabic and dialect)
# Stop api.py first, so nothing else uses the model.
# Run from the project folder:  powershell -ExecutionPolicy Bypass -File scripts\run_regression.ps1
# Output: logs\fast.txt, logs\arabic.txt; then the summary lines and every GUESS / DIALECT rewrite

$python = ".venv\Scripts\python.exe"
$env:PYTHONIOENCODING = "utf-8"
& $python eval_personas.py tests\fast_questions.csv 2>&1 | Out-File -Encoding utf8 logs\fast.txt
& $python eval_personas.py tests\arabic_questions.csv 2>&1 | Out-File -Encoding utf8 logs\arabic.txt
foreach ($f in "logs\fast.txt", "logs\arabic.txt") {
    "===== $f"
    Select-String -Path $f -Encoding utf8 -Pattern '^farmer:|^officer:|GUESS|DIALECT|path=deep' | ForEach-Object { $_.Line }
}
