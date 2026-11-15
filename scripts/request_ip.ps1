# Asks Pepper's router (by the normal automatic way, DHCP) to give this laptop a chosen address again, such as the
# one the Pepper app installed on the robot expects (14 Nov: the app looks for .113, the laptop got .109).
# Windows asks for its previous address when it reconnects, so this records the wanted address as the previous one
# and reconnects the Wi-Fi; the router agrees if the address is free. The address stays automatic: nothing can lock
# the laptop out. Up to 3 tries. Log: logs\request_ip.log
# Run:  powershell -ExecutionPolicy Bypass -File scripts\request_ip.ps1 [-Ip 192.168.8.113]   (administrator; Windows asks)
param([string]$Ip = "192.168.8.113")

$adapter = "Wi-Fi"
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
        [Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Start-Process powershell -Verb RunAs -ArgumentList "-ExecutionPolicy Bypass -File `"$PSCommandPath`" -Ip $Ip" -Wait
    exit
}
Start-Transcript -Path (Join-Path (Split-Path $PSScriptRoot) "logs\request_ip.log") -Append | Out-Null

function Current { (Get-NetIPAddress -InterfaceAlias $adapter -AddressFamily IPv4 -ErrorAction SilentlyContinue).IPAddress }
$ssid = (netsh wlan show interfaces | Select-String "^\s+SSID\s+:" | Select-Object -First 1).Line -replace '.*:\s*', ''
$guid = (Get-NetAdapter -Name $adapter).InterfaceGuid
$key = "HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters\Interfaces\$guid"
Write-Host "Now: $(Current) on '$ssid'. Wanted: $Ip"

for ($try = 1; $try -le 3 -and (Current) -ne $Ip; $try++) {
    Write-Host "Try ${try}: ask the router for $Ip"
    Set-ItemProperty -Path $key -Name DhcpIPAddress -Value $Ip
    netsh interface set interface name="$adapter" admin=disabled | Out-Null
    Start-Sleep 3
    Set-ItemProperty -Path $key -Name DhcpIPAddress -Value $Ip       # still the wanted one when the Wi-Fi comes back
    netsh interface set interface name="$adapter" admin=enabled | Out-Null
    Start-Sleep 8
    if ($ssid) { netsh wlan connect name="$ssid" | Out-Null }          # back on Pepper's Wi-Fi, not another one
    for ($i = 0; $i -lt 15 -and -not ((Current) -like "192.168.8.*"); $i++) { Start-Sleep 2 }
    Write-Host "   got: $(Current)"
}
$now = Current
Write-Host $(if ($now -eq $Ip) { "Done: the laptop is $Ip again." } else { "The router gave $now; $Ip wasn't granted." })
Stop-Transcript | Out-Null
