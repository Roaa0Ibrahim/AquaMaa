# One click to start everything for the demo on this laptop (14 Nov: for the team, when Roaa isn't there).
#   1. checks the AI model (Ollama) runs, and starts it if not
#   2. stops old copies of the website and AquaMaa
#   3. starts the website (dashboard) at http://localhost:3000, in its own window
#   4. starts AquaMaa (the AI) for the website AND for Pepper, in its own window
#   5. waits until both answer, and asks one question so the model is loaded (the first real answer is then fast)
#   6. shows this laptop's address on Pepper's Wi-Fi and opens the website in Microsoft Edge
# Started by "Start AquaMaa demo" on the Desktop. Leave the two windows it opens running during the demo.
# Run by hand:  powershell -ExecutionPolicy Bypass -File scripts\start_demo.ps1

$ErrorActionPreference = "Continue"
$project = Split-Path -Parent $PSScriptRoot
Set-Location $project
$host.UI.RawUI.WindowTitle = "AquaMaa demo: starting"
function Step($t) { Write-Host ""; Write-Host "== $t" -ForegroundColor Cyan }
function Ok($t) { Write-Host "   OK  $t" -ForegroundColor Green }
function Bad($t) { Write-Host "   !!  $t" -ForegroundColor Yellow }
function Answers($url, $seconds) {
    for ($i = 0; $i -lt $seconds; $i += 2) {
        try { Invoke-WebRequest -UseBasicParsing $url -TimeoutSec 3 | Out-Null; return $true } catch { Start-Sleep 2 }
    }
    return $false
}

Step "1. Wi-Fi"
$ssid = (netsh wlan show interfaces | Select-String "^\s+SSID\s+:" | Select-Object -First 1).Line -replace '.*:\s*', ''
$ip = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -like "192.168.8.*" } |
       Select-Object -First 1).IPAddress
if ($ip) { Ok "on '$ssid' (Pepper's network), this laptop is $ip" }
else { Bad "not on Pepper's Wi-Fi (now: '$ssid'). The website works, but Pepper can't reach this laptop. Connect to HUAWEI-89AB / HUAWEI-8983 and run this again." }

Step "2. The AI model (Ollama)"
if (-not (Answers "http://127.0.0.1:11434/api/tags" 2)) {
    $app = Join-Path $env:LOCALAPPDATA "Programs\Ollama\ollama app.exe"
    if (Test-Path $app) { Start-Process $app } else { Start-Process "ollama" "serve" -WindowStyle Minimized }
    if (Answers "http://127.0.0.1:11434/api/tags" 40) { Ok "Ollama started" } else { Bad "Ollama didn't start: open 'Ollama' from the Start menu, then run this again"; Read-Host "Press Enter to close"; exit 1 }
} else { Ok "Ollama is running" }

Step "3. Stopping old copies"
foreach ($port in 3000, 8000) {
    Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
        ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
}
Ok "ports 3000 and 8000 are free"

Step "4. Starting the website (its own window: leave it open)"
& powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "start_dashboard.ps1") | Out-Null
if (Answers "http://localhost:3000/api/auth/demo-accounts" 60) { Ok "website running at http://localhost:3000" } else { Bad "the website didn't answer: look at its window for the error" }

Step "5. Starting AquaMaa for the website and Pepper (its own window: leave it open)"
$cmd = "`$host.UI.RawUI.WindowTitle = 'AquaMaa (keep this window open)'; `$env:AQUAMAA_API_HOST = '0.0.0.0'; Set-Location '$project'; & .venv\Scripts\python.exe api.py"
Start-Process powershell -ArgumentList "-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $cmd
if (Answers "http://127.0.0.1:8000/health" 90) { Ok "AquaMaa running" } else { Bad "AquaMaa didn't answer: look at its window for the error"; Read-Host "Press Enter to close"; exit 1 }

Step "6. Loading the AI model (about 30 s, once)"
try {
    $body = '{"question": "What is the salinity now?", "role": "officer", "live": true}'
    $r = Invoke-RestMethod -Uri "http://127.0.0.1:8000/ask" -Method Post -ContentType "application/json" -Body $body -TimeoutSec 240
    Ok "the AI answered: $($r.answer.Substring(0, [Math]::Min(120, $r.answer.Length)))..."
} catch { Bad "the first question failed ($($_.Exception.Message)); the website and Pepper may still work, try a question" }

Step "7. Ready"
if ($ip) {
    Ok "Pepper: ADB OFF on the tablet, open the AquaMaa app (it finds this laptop at $ip by itself)"
    Ok "phones on Pepper's Wi-Fi can open the website at http://${ip}:3000"
}
Ok "officer@aquamaa.demo / farmer@aquamaa.demo, password AquaMaa-Demo-2026"
$edge = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
if (Test-Path $edge) { Start-Process $edge "http://localhost:3000" } else { Start-Process "http://localhost:3000" }
$host.UI.RawUI.WindowTitle = "AquaMaa demo: READY"
Write-Host ""
Write-Host "   READY. Keep the 'AquaMaa' window and the website's window open during the demo." -ForegroundColor Green
Read-Host "Press Enter to close this window"
