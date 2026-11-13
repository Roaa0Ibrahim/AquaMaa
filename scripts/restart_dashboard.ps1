# Restarts the dashboard in ..\aquamaa-dashboard on its current branch, so code changes there take effect.
# Run from the project folder:  powershell -ExecutionPolicy Bypass -File scripts\restart_dashboard.ps1

Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Confirm:$false -ErrorAction SilentlyContinue }
$env:AQUAMAA_DASHBOARD_BRANCH = $null
& (Join-Path $PSScriptRoot "start_dashboard.ps1")
