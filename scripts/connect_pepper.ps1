# Connects Pepper to AquaMaa in one go, with no internet needed (14 Nov). Start it on any Wi-Fi, then switch the
# laptop to Pepper's Wi-Fi (HUAWEI-89AB): it waits for the switch, then
#   1. finds this laptop's address on Pepper's network (192.168.8.x)
#   2. writes it into the Pepper app (strings.xml: agent_url and dashboard_url)
#   3. rebuilds the app offline (everything was downloaded before)
#   4. installs it on Pepper's tablet over ADB and opens it   (ADB must be ON on the tablet; tap "Allow" if asked)
#   5. starts AquaMaa for Pepper (api.py on all network interfaces) and leaves it running in this window
# Then: turn ADB OFF on the tablet and open the AquaMaa app (with ADB on, Pepper can't speak or listen).
# Everything is also written to logs\connect_pepper.log.
# Run from the project folder:  powershell -ExecutionPolicy Bypass -File scripts\connect_pepper.ps1

$PepperTablet = "192.168.8.101"
$root = Split-Path $PSScriptRoot
$app = Join-Path $root "pepper\PepperWaterQuality"
$adb = Join-Path $env:LOCALAPPDATA "Android\Sdk\platform-tools\adb.exe"
$log = Join-Path $root "logs\connect_pepper.log"
New-Item -ItemType Directory -Force (Split-Path $log) | Out-Null
function Say($text) { $line = "$(Get-Date -Format HH:mm:ss)  $text"; Write-Host $line; Add-Content -Encoding utf8 $log $line }

Say "1. Waiting for Pepper's Wi-Fi (HUAWEI-89AB). Switch the laptop's Wi-Fi now if you haven't."
$ip = $null
for ($i = 0; $i -lt 180 -and -not $ip; $i++) {
    $ip = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
           Where-Object { $_.IPAddress -like "192.168.8.*" } | Select-Object -First 1).IPAddress
    if (-not $ip) { Start-Sleep -Seconds 2 }
}
if (-not $ip) { Say "No 192.168.8.x address after 6 minutes. Is the laptop on HUAWEI-89AB?"; exit 1 }
Say "   This laptop is $ip on Pepper's network."

Say "2. Writing the laptop's address into the Pepper app"
$strings = Join-Path $app "app\src\main\res\values\strings.xml"
$xml = Get-Content -Raw -Encoding utf8 $strings
$xml = $xml -replace 'http://[0-9.]+:8000', "http://${ip}:8000" -replace 'http://[0-9.]+:3000', "http://${ip}:3000"
Set-Content -Encoding utf8 -NoNewline $strings $xml
Say "   agent_url = http://${ip}:8000 ; dashboard_url = http://${ip}:3000/#/dashboard"

Say "3. Building the app (offline)"
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17.0.21.9-hotspot"
Push-Location $app
& .\gradlew.bat assembleDebug --offline --console=plain 2>&1 | Select-String "BUILD|^e: |error" | ForEach-Object { Say "   $($_.Line)" }
Pop-Location
$apk = Join-Path $app "app\build\outputs\apk\debug\app-debug.apk"
if (-not (Test-Path $apk)) { Say "Build failed: see the lines above."; exit 1 }

Say "4. Installing on Pepper's tablet ($PepperTablet). ADB must be ON on the tablet; tap Allow if it asks."
& $adb connect "${PepperTablet}:5555" 2>&1 | ForEach-Object { Say "   $_" }
& $adb -s "${PepperTablet}:5555" install -r $apk 2>&1 | ForEach-Object { Say "   $_" }
& $adb -s "${PepperTablet}:5555" shell am start -n com.example.pepperwater/com.example.pepperwater.MainActivity 2>&1 |
    ForEach-Object { Say "   $_" }

Say "5. Starting AquaMaa for Pepper at http://${ip}:8000 (leave this window open)."
Say "   Now turn ADB OFF on the tablet, wait for 'Connected to Pepper', and open the AquaMaa app."
Say "   If Windows asks about the firewall for Python, allow it."
$env:AQUAMAA_API_HOST = "0.0.0.0"
Set-Location $root
& .venv\Scripts\python.exe api.py
