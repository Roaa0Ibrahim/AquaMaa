# Stops the website and AquaMaa after the demo (started by "Start AquaMaa demo").
# Run by hand:  powershell -ExecutionPolicy Bypass -File scripts\stop_demo.ps1
foreach ($port in 3000, 8000) {
    Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
        ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
}
Write-Host "The website and AquaMaa are stopped."
Start-Sleep 3
