# Gets Deema's latest website into ..\aquamaa-dashboard and restarts it (13 Nov).
#   1. Stops the dashboard if it is running (the node process on port 3000)
#   2. Saves any local edits in that folder with git stash, so nothing is lost (git -C ..\aquamaa-dashboard stash list)
#   3. Switches the folder to deema-development and pulls her latest push
#   4. Creates .env from her .env.example if there is none (her Supabase URL and publishable key)
#   5. Starts it with start_dashboard.ps1 (packages, demo database, server at http://localhost:3000)
# Run from the project folder:  powershell -ExecutionPolicy Bypass -File scripts\update_dashboard.ps1

$project = Split-Path -Parent $PSScriptRoot
$dashboard = Join-Path (Split-Path -Parent $project) "aquamaa-dashboard"

Write-Host "1. Stopping the running dashboard"
Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Confirm:$false -ErrorAction SilentlyContinue }

Write-Host "2. Saving local edits (if any)"
$changes = git -C $dashboard status --porcelain -- server public
if ($changes) { git -C $dashboard stash push -m "local edits before Deema's 13 Nov update" -- server public }
# Files the running app changed (demo database, node_modules) are reset so the pull can go through
git -C $dashboard checkout -- data node_modules 2>$null

Write-Host "3. Switching to deema-development and pulling"
git -C $dashboard switch deema-development
git -C $dashboard pull --ff-only origin deema-development
git -C $dashboard log --oneline -1

Write-Host "4. Settings"
$envFile = Join-Path $dashboard ".env"
if (-not (Test-Path $envFile) -and (Test-Path (Join-Path $dashboard ".env.example"))) {
    Copy-Item (Join-Path $dashboard ".env.example") $envFile
    Write-Host "   Created .env from .env.example"
} else { Write-Host "   .env already exists" }

Write-Host "5. Starting"
$env:AQUAMAA_DASHBOARD_BRANCH = $null
& (Join-Path $PSScriptRoot "start_dashboard.ps1")
