# Shows the agent service's alert messages (GET /alerts) and the watcher's lines in the service log.
# Run from the project folder:  powershell -ExecutionPolicy Bypass -File scripts\show_alerts.ps1

$r = Invoke-RestMethod "http://127.0.0.1:8000/alerts?after=0" -TimeoutSec 5
"Messages so far: $($r.messages.Count) (last seq $($r.last))"
$r.messages | ForEach-Object { "  [$($_.at) $($_.kind)] $($_.text)" }
"Watcher lines in logs\agent.log:"
Get-Content logs\agent.log -Encoding utf8 -Tail 400 | Select-String "ALERT" | Select-Object -Last 5 | ForEach-Object { "  $($_.Line)" }
