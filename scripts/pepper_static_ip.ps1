# A fixed address for the laptop on Pepper's Wi-Fi (HUAWEI-89AB), so Pepper and the team always find it at
# 192.168.8.20 (14 Nov: the address changed from .113 to .109 after reconnecting).
# Windows keeps this setting on the Wi-Fi adapter for every network, so run it with -Off before going back to UDST
# or any other Wi-Fi. If the router or the internet doesn't answer after the change, it goes back to automatic itself.
#   On:   powershell -ExecutionPolicy Bypass -File scripts\pepper_static_ip.ps1
#   Off:  powershell -ExecutionPolicy Bypass -File scripts\pepper_static_ip.ps1 -Off
# Needs administrator rights (Windows asks).
param([switch]$Off, [string]$Ip = "192.168.8.20")

$adapter = "Wi-Fi"
$ip = $Ip; $gateway = "192.168.8.1"

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
        [Security.Principal.WindowsBuiltInRole]::Administrator)) {
    # Run again as administrator, and wait for it
    $args = "-ExecutionPolicy Bypass -File `"$PSCommandPath`" -Ip $Ip" + $(if ($Off) { " -Off" } else { "" })
    Start-Process powershell -Verb RunAs -ArgumentList $args -Wait
    Get-NetIPAddress -InterfaceAlias $adapter -AddressFamily IPv4 | Select-Object IPAddress, PrefixOrigin | Format-Table
    exit
}

Start-Transcript -Path (Join-Path (Split-Path $PSScriptRoot) "logs\static_ip.log") -Append | Out-Null

function Automatic {
    netsh interface ipv4 set address name="$adapter" source=dhcp | Out-Null
    netsh interface ipv4 set dnsservers name="$adapter" source=dhcp | Out-Null
    Write-Host "Wi-Fi address back to automatic (DHCP)."
}

if ($Off) { Automatic; Start-Sleep 3; exit }

# Pepper's router, whatever name its Wi-Fi shows (14 Nov: the same router appeared as HUAWEI-89AB and HUAWEI-8983)
$onPepper = Get-NetIPAddress -InterfaceAlias $adapter -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -like "192.168.8.*" }
if (-not $onPepper -or -not (Test-Connection $gateway -Count 1 -Quiet)) {
    Write-Host "The laptop isn't on Pepper's network (192.168.8.x with the router at $gateway): nothing changed."; Start-Sleep 5; exit 1 }

Write-Host "Setting $ip on $adapter (gateway $gateway)..."
netsh interface ipv4 set address name="$adapter" static $ip 255.255.255.0 $gateway | Out-Null
netsh interface ipv4 set dnsservers name="$adapter" static $gateway primary | Out-Null
netsh interface ipv4 add dnsservers name="$adapter" 8.8.8.8 index=2 | Out-Null
# Windows needs a few seconds to reconnect with the new address (14 Nov: a check after 6 s failed and rolled back):
# try the router for up to 30 s
$router = $false
for ($i = 0; $i -lt 15 -and -not $router; $i++) {
    Start-Sleep 2
    $router = (ping -n 1 -w 1000 $gateway | Select-String "TTL=") -ne $null
}
$internet = (ping -n 1 -w 2000 8.8.8.8 | Select-String "TTL=") -ne $null
if (-not $router) {
    Write-Host "The router didn't answer at ${ip}: going back to automatic."
    Automatic; Start-Sleep 5; exit 1
}
Write-Host "Done: the laptop is $ip on Pepper's Wi-Fi. Router: ok. Internet: $(if ($internet) { 'ok' } else { 'not available' })."
Write-Host "Before going back to UDST, run this script with -Off."
Start-Sleep 5
