# Starts the AquaMaa agent service so Pepper can reach it over Wi-Fi (not only this laptop).
#   1. Prints this laptop's Wi-Fi address: put it in pepper\...\res\values\strings.xml as agent_url, e.g.
#      http://192.168.8.100:8000, then build and install the app (Ala's guide)
#   2. Starts python api.py listening on all network interfaces (AQUAMAA_API_HOST=0.0.0.0)
# Windows may ask to allow Python through the firewall: allow it on private networks.
# The laptop and Pepper must both be on Pepper's Wi-Fi (HUAWEI-89AB).
# Run from the project folder:  powershell -ExecutionPolicy Bypass -File scripts\start_for_pepper.ps1

$addresses = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" -and $_.PrefixOrigin -ne "WellKnown" }
Write-Host "This laptop's addresses (use the one on Pepper's Wi-Fi, usually 192.168.8.x):"
$addresses | ForEach-Object { Write-Host "   http://$($_.IPAddress):8000   ($($_.InterfaceAlias))" }

$env:AQUAMAA_API_HOST = "0.0.0.0"
Write-Host "Starting the agent service for Pepper (leave this window open)"
& .venv\Scripts\python.exe api.py
