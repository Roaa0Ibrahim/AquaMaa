# What is running: the dashboard, the agent service, Ollama and any model job (eval, agent).
# Run from the project folder:  powershell -ExecutionPolicy Bypass -File scripts\show_status.ps1

"Dashboard (port 3000):     " + [bool](Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue)
"Agent service (port 8000): " + [bool](Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue)
try {
    $tags = Invoke-RestMethod http://127.0.0.1:11434/api/tags -TimeoutSec 5
    "Ollama:                    up (" + (($tags.models | ForEach-Object { $_.name }) -join ", ") + ")"
} catch {
    "Ollama:                    not reachable"
}
$jobs = Get-CimInstance Win32_Process -Filter "Name='python.exe'" | Where-Object { $_.CommandLine -match 'eval_|agent.py|api.py' }
if ($jobs) { $jobs | ForEach-Object { "Running: $($_.ProcessId) $($_.CommandLine)" } } else { "Running:                   no model jobs" }
