# Milestone 4 checks, one run after the other (running them at the same time slows both and hides problems):
#   1. the 30 real development questions  -> logs\dev_<name>_console.txt, logs\dev_<name>_answers.txt
#   2. the 28 labelled questions           -> logs\labelled_<name>_console.txt, logs\labelled_<name>_answers.txt
# Every answer is also saved in runs\agent_<time>.json, after each question.
#
# Run from the project folder:   powershell -ExecutionPolicy Bypass -File scripts\run_m4_checks.ps1 run3

param([string]$Name = "run")

$project = Split-Path -Parent $PSScriptRoot
$python = Join-Path $project ".venv\Scripts\python.exe"
[Console]::OutputEncoding = [Text.Encoding]::UTF8
Push-Location $project

Write-Host "Checking that Ollama answers before starting"
& $python check_setup.py | Select-String "Ollama|FIX|ready"

Write-Host "1/2 Development questions (about 10 minutes). Live steps: logs\agent.log"
& $python eval_agent.py tests\dev_real_questions.csv 2>&1 | Out-File -Encoding utf8 "logs\dev_$($Name)_console.txt"
& $python show_run.py | Out-File -Encoding utf8 "logs\dev_$($Name)_answers.txt"
Get-Content "logs\dev_$($Name)_console.txt" -Tail 5

Write-Host "2/2 Labelled questions (about 10 minutes)"
& $python eval_agent.py 2>&1 | Out-File -Encoding utf8 "logs\labelled_$($Name)_console.txt"
& $python show_run.py | Out-File -Encoding utf8 "logs\labelled_$($Name)_answers.txt"
Get-Content "logs\labelled_$($Name)_console.txt" -Tail 5

Pop-Location
