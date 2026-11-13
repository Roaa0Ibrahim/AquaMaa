# Results of scripts\run_m5_close.ps1: the error tests, the wells answers and the dashboard check.
# Run from the project folder:  powershell -ExecutionPolicy Bypass -File scripts\show_m5_results.ps1

"===== Error tests (logs\m5_live_errors.txt)"
Get-Content logs\m5_live_errors.txt -Encoding utf8 | Select-String -Pattern '^(PASS|FAIL)|forced'

"`n===== Wells questions (latest run in runs\)"
$run = Get-ChildItem runs\agent_*.json | Sort-Object LastWriteTime -Descending | Select-Object -First 1
$data = Get-Content $run.FullName -Encoding utf8 -Raw | ConvertFrom-Json
"$($run.Name), complete: $($data.run.complete)"
foreach ($a in $data.answers) {
    "-- $($a.id) ($($a.seconds) s; tools: $($a.tools_used -join ', '))"
    $a.answer
}

"`n===== Dashboard check (logs\m5_dashboard.txt)"
Get-Content logs\m5_dashboard.txt -Encoding utf8 | Select-String -Pattern '^(PASS|FAIL)|charts'
