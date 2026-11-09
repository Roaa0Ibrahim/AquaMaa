# Runs Deema's dashboard locally, for Milestone 8, without touching this project's own files.
#   1. Checks out the deema-development branch into a separate folder next to this one: ..\aquamaa-dashboard
#      (a git worktree: same repository, its own folder, so main stays as it is)
#   2. Installs its packages and seeds its demonstration database
#   3. Starts it at http://localhost:3000 in its own window
#
# Run from the project folder:   powershell -ExecutionPolicy Bypass -File scripts\start_dashboard.ps1
# Needs Node.js 22.13 or newer. Pull Deema's latest changes first with:  git -C ..\aquamaa-dashboard pull

$project = Split-Path -Parent $PSScriptRoot
$dashboard = Join-Path (Split-Path -Parent $project) "aquamaa-dashboard"

if (-not (Test-Path $dashboard)) {
    Write-Host "1. Checking out deema-development into $dashboard"
    git -C $project fetch origin
    git -C $project worktree add $dashboard deema-development
} else {
    Write-Host "1. $dashboard already exists"
}

Push-Location $dashboard
Write-Host "2. Installing packages and seeding the demonstration database"
npm install --no-audit --no-fund
npm run seed

Write-Host "3. Starting the dashboard at http://localhost:3000 (close its window to stop it)"
# node directly: on Windows "npm" is a .cmd wrapper that Start-Process doesn't find
Start-Process -FilePath "node" -ArgumentList "server/index.js" -WorkingDirectory $dashboard
Pop-Location

Write-Host "4. Waiting for it to answer"
foreach ($i in 1..20) {
    try {
        $r = Invoke-WebRequest -UseBasicParsing "http://localhost:3000/api/auth/demo-accounts" -TimeoutSec 3
        Write-Host "   The dashboard is running: open http://localhost:3000"
        Write-Host "   Sign in with any demo account listed on the login page. They all share the password AquaMaa-Demo-2026"
        Write-Host "   (from Deema's README; demonstration mode only). The agent signs in on its own as the researcher account."
        exit 0
    } catch { Start-Sleep -Seconds 1 }
}
Write-Host "   The dashboard didn't start. Run 'node server/index.js' in $dashboard to see the error."
exit 1
