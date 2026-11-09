# Checks after adding the screen step (9 Nov). Model jobs run one after another, never in parallel.
#   1. eval_errors.py      verifier tests, no model (the two new checks must not break the 5 old ones)
#   2. eval_screen.py      6 questions from dashboard pages and outside the website
#   3. eval_dashboard.py   Milestone 8: the 5 dashboard charts must still match exactly
#   4. eval_routing.py     Milestone 3: the router prompt changed, so the 27 routing questions again
# Needs Ollama and the dashboard running. Stop api.py first so nothing else uses the model.
# Run from the project folder:  powershell -ExecutionPolicy Bypass -File scripts\run_screen_checks.ps1
# Only some checks:             ... -File scripts\run_screen_checks.ps1 eval_screen.py eval_dashboard.py
param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Checks)
if (-not $Checks) { $Checks = @("eval_errors.py", "eval_screen.py", "eval_dashboard.py", "eval_routing.py") }

$python = ".venv\Scripts\python.exe"
New-Item -ItemType Directory -Force logs | Out-Null
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$env:PYTHONIOENCODING = "utf-8"

foreach ($check in $Checks) {
    Write-Host "===== $check"
    & $python $check 2>&1 | Out-File -Encoding utf8 "logs\$($check -replace '\.py$', '').txt"
    Get-Content "logs\$($check -replace '\.py$', '').txt" -Encoding utf8 -Tail 4
}
# eval_routing.py writes eval_routing_v3.json, the frozen Milestone 3 result: keep the new one in logs, restore v3
if ($Checks -contains "eval_routing.py") {
    Move-Item -Force eval_routing_v3.json logs\eval_routing_screen.json
    git checkout -- eval_routing_v3.json
}
