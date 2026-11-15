# Makes the mouse pointer bigger for presenting and recording the demo (15 Nov), and applies it at once.
#   Bigger:  powershell -ExecutionPolicy Bypass -File scripts\big_cursor.ps1
#   Normal:  powershell -ExecutionPolicy Bypass -File scripts\big_cursor.ps1 -Normal
# Same setting as Settings > Accessibility > Mouse pointer and touch > Size. Only this Windows account changes.
param([switch]$Normal, [int]$Size = 96)
$size = if ($Normal) { 32 } else { $Size }
Set-ItemProperty "HKCU:\Control Panel\Cursors" -Name CursorBaseSize -Type DWord -Value $size
Add-Type @"
using System; using System.Runtime.InteropServices;
public static class Pointer { [DllImport("user32.dll")] public static extern bool SystemParametersInfo(int a, int b, IntPtr c, int d); }
"@
[Pointer]::SystemParametersInfo(0x57, 0, [IntPtr]::Zero, 0x03) | Out-Null    # SPI_SETCURSORS: reload the pointers now
Write-Host "Mouse pointer size: $size (normal is 32)."
