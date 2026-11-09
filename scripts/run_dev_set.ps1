# Runs the 30 real development questions through the agent, saving the console output to a file,
# then lists the answers with their checks.
#
# Run from the project folder:   powershell -ExecutionPolicy Bypass -File scripts\run_dev_set.ps1 run4
# The name (run4) labels the output files: logs\dev_run4_console.txt and logs\dev_run4_answers.txt

param([string]$Name = "run")

$project = Split-Path -Parent $PSScriptRoot
$python = Join-Path $project ".venv\Scripts\python.exe"
[Console]::OutputEncoding = [Text.Encoding]::UTF8
Push-Location $project

Write-Host "Running tests\dev_real_questions.csv (about 10 minutes). Live steps: logs\agent.log"
& $python eval_agent.py tests\dev_real_questions.csv 2>&1 | Out-File -Encoding utf8 "logs\dev_$($Name)_console.txt"
Get-Content "logs\dev_$($Name)_console.txt" -Tail 5

& $python show_run.py | Out-File -Encoding utf8 "logs\dev_$($Name)_answers.txt"
Get-Content "logs\dev_$($Name)_answers.txt" -Tail 3
Pop-Location
